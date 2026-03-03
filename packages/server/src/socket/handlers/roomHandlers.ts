import type { Server, Socket } from 'socket.io';
import { validatePlayerName, isValidRoomCode } from '@finlay-games/shared';
import type { ClientToServerEvents, ServerToClientEvents } from '@finlay-games/shared';
import { roomManager } from '../../state/RoomManager.js';
import { registerSocket } from '../../state/PlayerManager.js';

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

// Simple rate limit: track last room creation per IP
const lastCreateByIp = new Map<string, number>();
const CREATE_COOLDOWN_MS = 3000;

export function registerRoomHandlers(io: Server, socket: TypedSocket) {
  socket.on('room:create', (data, callback) => {
    const nameError = validatePlayerName(data.playerName);
    if (nameError) return callback({ ok: false, error: nameError });

    // Rate limit
    const ip = socket.handshake.address;
    const lastCreate = lastCreateByIp.get(ip) ?? 0;
    if (Date.now() - lastCreate < CREATE_COOLDOWN_MS) {
      return callback({ ok: false, error: 'Please wait before creating another room' });
    }
    lastCreateByIp.set(ip, Date.now());

    const { room, playerId } = roomManager.createRoom(data.playerName.trim(), data.color);
    registerSocket(socket.id, playerId, room.code);
    socket.join(room.code);
    callback({ ok: true, room, playerId });
  });

  socket.on('room:join', (data, callback) => {
    const nameError = validatePlayerName(data.playerName);
    if (nameError) return callback({ ok: false, error: nameError });

    const code = data.roomCode.toUpperCase();
    if (!isValidRoomCode(code)) return callback({ ok: false, error: 'Invalid room code' });

    const result = roomManager.joinRoom(code, data.playerName.trim(), data.color);
    if ('error' in result) return callback({ ok: false, error: result.error });

    const { room, playerId } = result;
    registerSocket(socket.id, playerId, room.code);
    socket.join(room.code);

    const player = room.players.find((p) => p.id === playerId)!;
    socket.to(room.code).emit('room:playerJoined', { player });

    callback({ ok: true, room, playerId });
  });

  socket.on('room:peek', (data, callback) => {
    const code = data.roomCode.toUpperCase();
    if (!isValidRoomCode(code)) return callback({ ok: false, error: 'Invalid room code' });

    const peek = roomManager.peekRoom(code);
    if (!peek) return callback({ ok: false, error: 'Room not found' });

    callback({ ok: true, room: peek });
  });

  socket.on('tv:join', (data, callback) => {
    const code = data.roomCode.toUpperCase();
    if (!isValidRoomCode(code)) return callback({ ok: false, error: 'Invalid room code' });

    const room = roomManager.getRoom(code);
    if (!room) return callback({ ok: false, error: 'Room not found' });

    socket.join(code);
    callback({ ok: true, room });
  });
}
