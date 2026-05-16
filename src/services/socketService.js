import { io } from 'socket.io-client';
import { SOCKET_URL } from '../config/api';

let _socket = null;

/**
 * Connect (or return existing) socket with rider JWT.
 * Non-blocking — returns immediately, connects in background.
 */
export function connectSocket(token) {
  if (_socket?.connected) return _socket;

  // Disconnect stale socket if it exists
  if (_socket) {
    _socket.removeAllListeners();
    _socket.disconnect();
    _socket = null;
  }

  // ⚡ Create socket — connects in background (non-blocking)
  _socket = io(SOCKET_URL, {
    auth: { token },
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
    // Disconnect immediately so the socket stops trying to reconnect with the revoked session.
    if (_socket) {
      _socket.removeAllListeners();
      _socket.disconnect();
      _socket = null;
    }
    const { showForcedLogoutAlert } = await import('../utils/logoutAlert');
    const authStore = (await import('../store/authStore')).default;
    await showForcedLogoutAlert(async () => {
      await authStore.getState().logout();
    });
  });

  return _socket;
}

export function getSocket() {
  return _socket;
}

export function disconnectSocket() {
  if (_socket) {
    _socket.removeAllListeners();
    _socket.disconnect();
    _socket = null;
  }
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
