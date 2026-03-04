import type { Player, PlayerColor } from './player.js';
import type { Room, RoomPeek, RoomSettings } from './room.js';
import type { BlastZoneState, GameInput } from './blastzone.js';
import type { FinlayKartState, KartInput } from './kart.js';

export interface MatchResult {
  matchId: string;
  gameType: string;
  placements: { playerId: string; name: string; color: PlayerColor; score: number; placement: number }[];
}

export interface ClientToServerEvents {
  'room:create': (
    data: { playerName: string; color: PlayerColor },
    callback: (response: { ok: true; room: Room; playerId: string } | { ok: false; error: string }) => void,
  ) => void;

  'room:join': (
    data: { roomCode: string; playerName: string; color: PlayerColor },
    callback: (response: { ok: true; room: Room; playerId: string } | { ok: false; error: string }) => void,
  ) => void;

  'room:peek': (
    data: { roomCode: string },
    callback: (response: { ok: true; room: RoomPeek } | { ok: false; error: string }) => void,
  ) => void;

  'room:leave': () => void;

  'room:reconnect': (
    data: { playerId: string; roomCode: string },
    callback: (response: { ok: true; room: Room } | { ok: false; error: string }) => void,
  ) => void;

  'lobby:updateSettings': (
    data: { settings: Partial<RoomSettings> },
    callback: (response: { ok: true } | { ok: false; error: string }) => void,
  ) => void;

  'lobby:changeColor': (
    data: { color: PlayerColor },
    callback: (response: { ok: true } | { ok: false; error: string }) => void,
  ) => void;

  'lobby:startGame': (
    callback: (response: { ok: true } | { ok: false; error: string }) => void,
  ) => void;

  'tv:join': (
    data: { roomCode: string },
    callback: (response: { ok: true; room: Room } | { ok: false; error: string }) => void,
  ) => void;

  'game:input': (data: { input: GameInput | KartInput }) => void;
}

export interface ServerToClientEvents {
  'room:playerJoined': (data: { player: Player }) => void;
  'room:playerLeft': (data: { playerId: string }) => void;
  'room:playerDisconnected': (data: { playerId: string }) => void;
  'room:playerReconnected': (data: { playerId: string }) => void;
  'room:hostChanged': (data: { newHostId: string }) => void;
  'room:closed': () => void;

  'lobby:settingsUpdated': (data: { settings: RoomSettings }) => void;
  'lobby:colorChanged': (data: { playerId: string; color: PlayerColor }) => void;
  'lobby:gameStarting': () => void;

  'game:state': (data: { state: BlastZoneState | FinlayKartState }) => void;
  'game:over': (data: { result: MatchResult }) => void;
  'game:backToLobby': () => void;
}
