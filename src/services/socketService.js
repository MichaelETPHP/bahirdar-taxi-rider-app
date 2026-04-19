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
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,  // Reduced from 1500ms
    timeout: 8000,  // Reduced from 10000ms
    connect_timeout: 5000,  // Faster timeout
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

/**
 * Join the rider's personal room so the server can target this device.
 */
export function joinRiderRoom(riderId) {
  if (_socket?.connected) {
    // Support both legacy and current backend room namespaces.
    _socket.emit('join:room', `rider:${riderId}`);
    _socket.emit('join:room', `user:${riderId}`);
  } else if (_socket) {
    _socket.once('connect', () => {
      _socket.emit('join:room', `rider:${riderId}`);
      _socket.emit('join:room', `user:${riderId}`);
    });
  }
}
