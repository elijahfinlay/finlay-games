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
  GameType,
  GAME_INFO,
  ROUND_TIME_OPTIONS,
  ROUNDS_OPTIONS,
  TOTAL_LAPS_OPTIONS,
} from '@finlay-games/shared';
import crypto from 'node:crypto';

function isRoundTimeOption(value: number): value is (typeof ROUND_TIME_OPTIONS)[number] {
  return ROUND_TIME_OPTIONS.includes(value as (typeof ROUND_TIME_OPTIONS)[number]);
}

function isLapOption(value: number): value is (typeof TOTAL_LAPS_OPTIONS)[number] {
  return TOTAL_LAPS_OPTIONS.includes(value as (typeof TOTAL_LAPS_OPTIONS)[number]);
}

function isBlastZoneRoundOption(value: number): value is (typeof ROUNDS_OPTIONS)[number] {
  return ROUNDS_OPTIONS.includes(value as (typeof ROUNDS_OPTIONS)[number]);
}

class RoomManager {
  private rooms = new Map<string, Room>();
  private expiryTimers = new Map<string, NodeJS.Timeout>();
  private deleteListeners = new Set<(roomCode: string) => void>();

  createRoom(playerName: string, color: PlayerColor, gameType?: GameType): { room: Room; playerId: string } {
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
      settings: { ...DEFAULT_ROOM_SETTINGS, ...(gameType && GAME_INFO[gameType]?.available ? { gameType } : {}) },
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
  ): { settings: RoomSettings } | { error: string } {
    const room = this.rooms.get(roomCode);
    if (!room) return { error: 'Room not found' };
    if (room.hostId !== playerId) return { error: 'Only the host can change settings' };

    const nextGameType = settings.gameType ?? room.settings.gameType;
    if (!(nextGameType in GAME_INFO)) {
      return { error: 'Unknown game type' };
    }
    if (!GAME_INFO[nextGameType].available) {
      return { error: 'That game is not available yet' };
    }

    const nextSettings: RoomSettings = { ...room.settings, gameType: nextGameType };

    if (settings.roundTime !== undefined) {
      if (!isRoundTimeOption(settings.roundTime)) {
        return { error: 'Unsupported round timer' };
      }
      nextSettings.roundTime = settings.roundTime;
    }

    if (nextGameType === GameType.FinlayKart) {
      const requestedRounds = settings.rounds ?? nextSettings.rounds;
      nextSettings.rounds = isLapOption(requestedRounds)
        ? requestedRounds
        : TOTAL_LAPS_OPTIONS[0];
    } else if (nextGameType === GameType.BlastZone) {
      const requestedRounds = settings.rounds ?? nextSettings.rounds;
      nextSettings.rounds = isBlastZoneRoundOption(requestedRounds)
        ? requestedRounds
        : ROUNDS_OPTIONS[1];
      if (settings.powerUps !== undefined) {
        nextSettings.powerUps = settings.powerUps;
      }
    }

    room.settings = nextSettings;
    return { settings: room.settings };
  }

  canStartGame(roomCode: string, playerId: string): { ok: true } | { error: string } {
    const room = this.rooms.get(roomCode);
    if (!room) return { error: 'Room not found' };
    if (room.hostId !== playerId) return { error: 'Only host can start the game' };
    if (!GAME_INFO[room.settings.gameType].available) {
      return { error: 'Selected game is not available' };
    }
    const connectedPlayers = room.players.filter((p) => p.connected);
    if (connectedPlayers.length < 1) return { error: 'Need at least 1 player' };
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

  scheduleExpiry(code: string) {
    this.clearExpiry(code);
    const timer = setTimeout(() => {
      const room = this.rooms.get(code);
      if (room && room.state !== 'lobby') {
        // Game in progress — reschedule instead of deleting
        this.scheduleExpiry(code);
        return;
      }
      this.deleteRoom(code);
    }, ROOM_EXPIRY_MS);
    this.expiryTimers.set(code, timer);
  }

  onDelete(listener: (roomCode: string) => void) {
    this.deleteListeners.add(listener);
    return () => {
      this.deleteListeners.delete(listener);
    };
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
    for (const listener of this.deleteListeners) {
      listener(code);
    }
  }
}

export const roomManager = new RoomManager();
