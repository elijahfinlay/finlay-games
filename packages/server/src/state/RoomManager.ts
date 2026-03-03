import {
  type Room,
  type Player,
  type PlayerColor,
  type RoomSettings,
  type RoomPeek,
  DEFAULT_ROOM_SETTINGS,
  MAX_PLAYERS,
  ROOM_EXPIRY_MS,
  generateRoomCode,
  PLAYER_COLORS,
} from '@finlay-games/shared';
import crypto from 'node:crypto';

class RoomManager {
  private rooms = new Map<string, Room>();
  private expiryTimers = new Map<string, NodeJS.Timeout>();

  createRoom(playerName: string, color: PlayerColor): { room: Room; playerId: string } {
    let code: string;
    do {
      code = generateRoomCode();
    } while (this.rooms.has(code));

    const playerId = crypto.randomUUID();
    const player: Player = {
      id: playerId,
      name: playerName,
      color,
      isHost: true,
      connected: true,
      joinedAt: Date.now(),
    };

    const room: Room = {
      code,
      players: [player],
      settings: { ...DEFAULT_ROOM_SETTINGS },
      hostId: playerId,
      createdAt: Date.now(),
      state: 'lobby',
    };

    this.rooms.set(code, room);
    this.scheduleExpiry(code);
    return { room, playerId };
  }

  joinRoom(
    roomCode: string,
    playerName: string,
    color: PlayerColor,
  ): { room: Room; playerId: string } | { error: string } {
    const room = this.rooms.get(roomCode);
    if (!room) return { error: 'Room not found' };
    if (room.state !== 'lobby') return { error: 'Game already in progress' };

    const connectedPlayers = room.players.filter((p) => p.connected);
    if (connectedPlayers.length >= MAX_PLAYERS) return { error: 'Room is full' };

    if (room.players.some((p) => p.color === color && p.connected)) {
      return { error: 'Color already taken' };
    }

    const playerId = crypto.randomUUID();
    const player: Player = {
      id: playerId,
      name: playerName,
      color,
      isHost: false,
      connected: true,
      joinedAt: Date.now(),
    };

    room.players.push(player);
    return { room, playerId };
  }

  peekRoom(roomCode: string): RoomPeek | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;
    return {
      code: room.code,
      playerCount: room.players.filter((p) => p.connected).length,
      takenColors: room.players.filter((p) => p.connected).map((p) => p.color),
      state: room.state,
    };
  }

  getRoom(roomCode: string): Room | undefined {
    return this.rooms.get(roomCode);
  }

  removePlayer(roomCode: string, playerId: string): { hostChanged?: string } | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    room.players = room.players.filter((p) => p.id !== playerId);

    if (room.players.filter((p) => p.connected).length === 0) {
      this.deleteRoom(roomCode);
      return null;
    }

    if (room.hostId === playerId) {
      const newHost = room.players
        .filter((p) => p.connected)
        .sort((a, b) => a.joinedAt - b.joinedAt)[0];
      if (newHost) {
        newHost.isHost = true;
        room.hostId = newHost.id;
        return { hostChanged: newHost.id };
      }
    }

    return {};
  }

  disconnectPlayer(roomCode: string, playerId: string): boolean {
    const room = this.rooms.get(roomCode);
    if (!room) return false;
    const player = room.players.find((p) => p.id === playerId);
    if (!player) return false;
    player.connected = false;
    return true;
  }

  reconnectPlayer(roomCode: string, playerId: string): Room | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;
    const player = room.players.find((p) => p.id === playerId);
    if (!player) return null;
    player.connected = true;
    return room;
  }

  changeColor(
    roomCode: string,
    playerId: string,
    color: PlayerColor,
  ): boolean {
    const room = this.rooms.get(roomCode);
    if (!room) return false;
    if (!PLAYER_COLORS.includes(color)) return false;
    if (room.players.some((p) => p.id !== playerId && p.color === color && p.connected)) {
      return false;
    }
    const player = room.players.find((p) => p.id === playerId);
    if (!player) return false;
    player.color = color;
    return true;
  }

  updateSettings(
    roomCode: string,
    playerId: string,
    settings: Partial<RoomSettings>,
  ): RoomSettings | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;
    if (room.hostId !== playerId) return null;
    room.settings = { ...room.settings, ...settings };
    return room.settings;
  }

  canStartGame(roomCode: string, playerId: string): { ok: true } | { error: string } {
    const room = this.rooms.get(roomCode);
    if (!room) return { error: 'Room not found' };
    if (room.hostId !== playerId) return { error: 'Only host can start the game' };
    const connectedPlayers = room.players.filter((p) => p.connected);
    if (connectedPlayers.length < 2) return { error: 'Need at least 2 players' };
    return { ok: true };
  }

  findRoomByPlayerId(playerId: string): Room | undefined {
    for (const room of this.rooms.values()) {
      if (room.players.some((p) => p.id === playerId)) {
        return room;
      }
    }
    return undefined;
  }

  private scheduleExpiry(code: string) {
    this.clearExpiry(code);
    const timer = setTimeout(() => {
      this.deleteRoom(code);
    }, ROOM_EXPIRY_MS);
    this.expiryTimers.set(code, timer);
  }

  private clearExpiry(code: string) {
    const timer = this.expiryTimers.get(code);
    if (timer) {
      clearTimeout(timer);
      this.expiryTimers.delete(code);
    }
  }

  private deleteRoom(code: string) {
    this.rooms.delete(code);
    this.clearExpiry(code);
  }
}

export const roomManager = new RoomManager();
