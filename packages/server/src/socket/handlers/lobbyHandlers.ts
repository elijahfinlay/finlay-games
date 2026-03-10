import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@finlay-games/shared';
import { roomManager } from '../../state/RoomManager.js';
import { getPlayerInfo } from '../../state/PlayerManager.js';
import { startGame, handleGameInput } from '../../game/GameManager.js';

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export function registerLobbyHandlers(io: Server, socket: TypedSocket) {
  socket.on('lobby:updateSettings', (data, callback) => {
    const info = getPlayerInfo(socket.id);
    if (!info) return callback({ ok: false, error: 'Not in a room' });

    const result = roomManager.updateSettings(info.roomCode, info.playerId, data.settings);
    if ('error' in result) return callback({ ok: false, error: result.error });

    io.to(info.roomCode).emit('lobby:settingsUpdated', { settings: result.settings });
    callback({ ok: true });
  });

  socket.on('lobby:changeColor', (data, callback) => {
    const info = getPlayerInfo(socket.id);
    if (!info) return callback({ ok: false, error: 'Not in a room' });

    const ok = roomManager.changeColor(info.roomCode, info.playerId, data.color);
    if (!ok) return callback({ ok: false, error: 'Color not available' });

    io.to(info.roomCode).emit('lobby:colorChanged', {
      playerId: info.playerId,
      color: data.color,
    });
    callback({ ok: true });
  });

  socket.on('lobby:addBot', (callback) => {
    const info = getPlayerInfo(socket.id);
    if (!info) return callback({ ok: false, error: 'Not in a room' });

    const result = roomManager.addBot(info.roomCode, info.playerId);
    if ('error' in result) return callback({ ok: false, error: result.error });

    io.to(info.roomCode).emit('room:playerJoined', { player: result.player });
    callback({ ok: true });
  });

  socket.on('lobby:removeBot', (data, callback) => {
    const info = getPlayerInfo(socket.id);
    if (!info) return callback({ ok: false, error: 'Not in a room' });

    const ok = roomManager.removeBot(info.roomCode, info.playerId, data.playerId);
    if (!ok) return callback({ ok: false, error: 'Could not remove bot' });

    io.to(info.roomCode).emit('room:playerLeft', { playerId: data.playerId });
    callback({ ok: true });
  });

  socket.on('lobby:startGame', async (callback) => {
    const info = getPlayerInfo(socket.id);
    if (!info) return callback({ ok: false, error: 'Not in a room' });

    const result = roomManager.canStartGame(info.roomCode, info.playerId);
    if ('error' in result) return callback({ ok: false, error: result.error });

    const room = roomManager.getRoom(info.roomCode);
    console.log(`[GAME] Starting ${room?.settings.gameType ?? 'game'} in room ${info.roomCode}`);
    try {
      await startGame(io, info.roomCode);
      io.to(info.roomCode).emit('lobby:gameStarting');
      callback({ ok: true });
    } catch (err) {
      console.error('[GAME] Failed to start game:', err);
      callback({ ok: false, error: 'Failed to start game' });
    }
  });

  socket.on('game:input', (data) => {
    const info = getPlayerInfo(socket.id);
    if (!info) return;
    handleGameInput(info.roomCode, info.playerId, data.input);
  });
}
