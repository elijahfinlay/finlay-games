import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@finlay-games/shared';
import { roomManager } from '../../state/RoomManager.js';
import { getPlayerInfo } from '../../state/PlayerManager.js';

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export function registerLobbyHandlers(io: Server, socket: TypedSocket) {
  socket.on('lobby:updateSettings', (data, callback) => {
    const info = getPlayerInfo(socket.id);
    if (!info) return callback({ ok: false, error: 'Not in a room' });

    const settings = roomManager.updateSettings(info.roomCode, info.playerId, data.settings);
    if (!settings) return callback({ ok: false, error: 'Only the host can change settings' });

    socket.to(info.roomCode).emit('lobby:settingsUpdated', { settings });
    callback({ ok: true });
  });

  socket.on('lobby:changeColor', (data, callback) => {
    const info = getPlayerInfo(socket.id);
    if (!info) return callback({ ok: false, error: 'Not in a room' });

    const ok = roomManager.changeColor(info.roomCode, info.playerId, data.color);
    if (!ok) return callback({ ok: false, error: 'Color not available' });

    socket.to(info.roomCode).emit('lobby:colorChanged', {
      playerId: info.playerId,
      color: data.color,
    });
    callback({ ok: true });
  });

  socket.on('lobby:startGame', (callback) => {
    const info = getPlayerInfo(socket.id);
    if (!info) return callback({ ok: false, error: 'Not in a room' });

    const result = roomManager.canStartGame(info.roomCode, info.playerId);
    if ('error' in result) return callback({ ok: false, error: result.error });

    console.log(`[GAME] Starting game in room ${info.roomCode} (Phase 1 — no-op)`);
    io.to(info.roomCode).emit('lobby:gameStarting');
    callback({ ok: true });
  });
}
