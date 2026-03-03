import { DISCONNECT_GRACE_MS } from '@finlay-games/shared';
import { roomManager } from './RoomManager.js';
import type { Server } from 'socket.io';

// Maps socket.id → { playerId, roomCode }
const socketToPlayer = new Map<string, { playerId: string; roomCode: string }>();
const disconnectTimers = new Map<string, NodeJS.Timeout>();

export function registerSocket(socketId: string, playerId: string, roomCode: string) {
  socketToPlayer.set(socketId, { playerId, roomCode });
}

export function unregisterSocket(socketId: string) {
  socketToPlayer.delete(socketId);
}

export function getPlayerInfo(socketId: string) {
  return socketToPlayer.get(socketId);
}

export function findSocketByPlayerId(playerId: string): string | undefined {
  for (const [socketId, info] of socketToPlayer.entries()) {
    if (info.playerId === playerId) return socketId;
  }
  return undefined;
}

export function startDisconnectTimer(
  playerId: string,
  roomCode: string,
  io: Server,
) {
  clearDisconnectTimer(playerId);

  const timer = setTimeout(() => {
    disconnectTimers.delete(playerId);
    const result = roomManager.removePlayer(roomCode, playerId);
    if (!result) {
      // Room was deleted (empty)
      io.to(roomCode).emit('room:closed');
      return;
    }
    io.to(roomCode).emit('room:playerLeft', { playerId });
    if (result.hostChanged) {
      io.to(roomCode).emit('room:hostChanged', { newHostId: result.hostChanged });
    }
  }, DISCONNECT_GRACE_MS);

  disconnectTimers.set(playerId, timer);
}

export function clearDisconnectTimer(playerId: string) {
  const timer = disconnectTimers.get(playerId);
  if (timer) {
    clearTimeout(timer);
    disconnectTimers.delete(playerId);
  }
}
