import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@finlay-games/shared';
import { roomManager } from '../../state/RoomManager.js';
import {
  getPlayerInfo,
  unregisterSocket,
  registerSocket,
  startDisconnectTimer,
  clearDisconnectTimer,
} from '../../state/PlayerManager.js';
import { getActiveGameState } from '../../game/GameManager.js';

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export function registerConnectionHandlers(io: Server, socket: TypedSocket) {
  socket.on('room:leave', () => {
    const info = getPlayerInfo(socket.id);
    if (!info) return;

    const result = roomManager.removePlayer(info.roomCode, info.playerId);
    unregisterSocket(socket.id);
    socket.leave(info.roomCode);

    if (!result) {
      io.to(info.roomCode).emit('room:closed');
      return;
    }

    io.to(info.roomCode).emit('room:playerLeft', { playerId: info.playerId });
    if (result.hostChanged) {
      io.to(info.roomCode).emit('room:hostChanged', { newHostId: result.hostChanged });
    }
  });

  socket.on('room:reconnect', (data, callback) => {
    const room = roomManager.reconnectPlayer(data.roomCode, data.playerId);
    if (!room) return callback({ ok: false, error: 'Could not reconnect' });

    clearDisconnectTimer(data.playerId);
    registerSocket(socket.id, data.playerId, data.roomCode);
    socket.join(data.roomCode);

    socket.to(data.roomCode).emit('room:playerReconnected', { playerId: data.playerId });
    callback({ ok: true, room, gameState: getActiveGameState(data.roomCode) });
  });

  socket.on('disconnect', () => {
    const info = getPlayerInfo(socket.id);
    if (!info) return;

    roomManager.disconnectPlayer(info.roomCode, info.playerId);
    unregisterSocket(socket.id);

    io.to(info.roomCode).emit('room:playerDisconnected', { playerId: info.playerId });
    startDisconnectTimer(info.playerId, info.roomCode, io);
  });
}
