import { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@finlay-games/shared';
import { registerRoomHandlers } from './handlers/roomHandlers.js';
import { registerLobbyHandlers } from './handlers/lobbyHandlers.js';
import { registerConnectionHandlers } from './handlers/connectionHandlers.js';

export function initSocketIO(httpServer: HttpServer) {
  const allowedOrigins = process.env.CLIENT_URL
    ? [process.env.CLIENT_URL, 'http://localhost:5173']
    : '*';

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`[SOCKET] Connected: ${socket.id}`);

    registerRoomHandlers(io, socket);
    registerLobbyHandlers(io, socket);
    registerConnectionHandlers(io, socket);
  });

  return io;
}
