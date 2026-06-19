import { Server } from 'socket.io';
import { createSocketCorsOptions } from '../config/corsOptions.js';

let io;

export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: createSocketCorsOptions(),
  });

  io.on('connection', (socket) => {
    socket.on('join', (room) => {
      if (typeof room === 'string') socket.join(room);
    });
  });

  return io;
}

export function getIo() {
  return io;
}

export function emitToRoom(room, event, payload) {
  io?.to(room).emit(event, payload);
}
