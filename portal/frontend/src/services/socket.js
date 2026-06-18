import { io } from 'socket.io-client';

let authSocket;

export function connectSocket(token) {
  if (authSocket?.connected) return authSocket;

  authSocket = io(import.meta.env.VITE_API_URL || undefined, {
    auth: { token },
    autoConnect: true,
  });

  authSocket.emit('join', 'leaderboard');
  authSocket.emit('join', 'matches');

  return authSocket;
}

export function disconnectSocket() {
  authSocket?.disconnect();
  authSocket = undefined;
}

export function getSocket() {
  return authSocket;
}

export function connectDisplaySocket() {
  return io(import.meta.env.VITE_API_URL || undefined, { autoConnect: true });
}
