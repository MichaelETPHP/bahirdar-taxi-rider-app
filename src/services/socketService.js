import { io } from 'socket.io-client';
import { SOCKET_URL } from '../config/api';

let _socket = null;

/**
 * Lazily creates the ONE socket instance for the app's lifetime and attaches
 * its listeners exactly once. Every screen that calls `getSocket()`/
 * `connectSocket()` gets the SAME object back, so a `.on()` handler attached
 * by one screen (e.g. TripActiveScreen's `trip:completed` listener) is never
 * silently orphaned by a later reconnect elsewhere in the app — reconnects
 * happen ON this object (`.disconnect()` + `.connect()`), never by throwing
 * it away and creating a new one. Before this, any reconnect (a network
 * blip, backgrounding — not rare on mobile data) meant already-attached
 * listeners stopped receiving events for the rest of that session, which is
 * why the completion screen would intermittently fall back to the stale
 * upfront fare estimate instead of the real final amount.
 */
function ensureSocket() {
  if (_socket) return _socket;

  _socket = io(SOCKET_URL, {
    autoConnect: false,
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 8000,
    connect_timeout: 5000,
  });

  if (__DEV__) {
    _socket.on('connect', () => {
      console.log(`[SOCKET] ✓ Connected       id=${_socket.id?.slice(0, 8) ?? '?'}`);
    });
    _socket.on('disconnect', (reason) => {
      console.warn(`[SOCKET] ✗ Disconnected   reason=${reason}`);
    });
    _socket.on('reconnect', (attempt) => {
      console.log(`[SOCKET] ↺ Reconnected    attempt=${attempt}`);
    });
    _socket.on('connect_error', (err) => {
      console.warn(`[SOCKET] ✗ Connect error  ${err?.message ?? err}`);
    });
  }

  // Single-session enforcement: server fires this when the same account logs in elsewhere.
  _socket.on('auth:force_logout', async () => {
    if (__DEV__) console.warn('[SOCKET] 🚫 Force logout — account signed in on another device');
    // Disconnect immediately so the socket stops trying to reconnect with the
    // revoked session — the object itself stays alive for the next login.
    _socket?.disconnect();
    const { showForcedLogoutAlert } = await import('../utils/logoutAlert');
    const authStore = (await import('../store/authStore')).default;
    await showForcedLogoutAlert(async () => {
      await authStore.getState().logout();
    });
  });

  return _socket;
}

/**
 * Connect (or reconnect) the shared socket with the rider's current JWT.
 * Non-blocking — returns immediately, connects in background.
 */
export function connectSocket(token) {
  const socket = ensureSocket();
  socket.auth = { token };
  if (!socket.connected) socket.connect();
  return socket;
}

export function getSocket() {
  return _socket;
}

export function disconnectSocket() {
  _socket?.disconnect();
}

export function isSocketConnected() {
  return _socket?.connected === true;
}

/**
 * Join the rider's personal room so the server can target this device.
 */
/**
 * Register a one-time handler for the trip:fare_adjustment event.
 * Stores the adjustment data in the ride store so TripCompleteScreen can display it.
 */
export function listenForFareAdjustment(onAdjustment) {
  if (!_socket) return;
  _socket.off('trip:fare_adjustment');
  _socket.on('trip:fare_adjustment', (data) => {
    if (__DEV__) {
      console.log(
        `[SOCKET] ⚡ Fare adjustment  confirmed=${data.confirmed_fare}  adj=+${data.adjustment}  final=${data.final_fare}  model=${data.pricing_model}`
      );
    }
    onAdjustment?.(data);
  });
}

export function removeFareAdjustmentListener() {
  _socket?.off('trip:fare_adjustment');
}

export function listenForLiveFareUpdate(onUpdate) {
  if (!_socket) return;
  _socket.off('trip:fare_update');
  _socket.on('trip:fare_update', (data) => {
    onUpdate?.(data);
  });
}

export function removeLiveFareUpdateListener() {
  _socket?.off('trip:fare_update');
}

/**
 * Fires whenever the rider's wallet balance changes server-side (top-up
 * credited, withdrawal, trip fare deducted) — lets balance/transaction UI
 * update live with no pull-to-refresh. Payload: { balance, transaction }.
 *
 * Pass the SAME function reference to removeWalletUpdateListener() to stop
 * listening — matches addEventListener/removeEventListener semantics, so
 * more than one independent listener (a global balance sync in the auth
 * store, plus whichever wallet screen is currently open) can coexist
 * without one's cleanup silently killing another's.
 */
export function listenForWalletUpdate(onUpdate) {
  if (!_socket) return;
  _socket.on('wallet:updated', onUpdate);
}

export function removeWalletUpdateListener(onUpdate) {
  _socket?.off('wallet:updated', onUpdate);
}

export function joinRiderRoom(riderId) {
  if (!_socket) return;

  const join = () => {
    _socket.emit('join:room', `rider:${riderId}`);
    _socket.emit('join:room', `user:${riderId}`);
    if (__DEV__) console.log(`[SOCKET] ◎ Joined rooms  rider:${riderId.slice(0, 8)}  user:${riderId.slice(0, 8)}`);
  };

  if (_socket.connected) {
    join();
  } else {
    _socket.once('connect', join);
  }

  // Re-join automatically on every reconnect (server drops rooms on disconnect)
  _socket.off('reconnect', join);
  _socket.on('reconnect', join);
}
