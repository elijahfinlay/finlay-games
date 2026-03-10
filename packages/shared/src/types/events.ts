import type { Player, PlayerColor } from './player.js';
import type { Room, RoomPeek, RoomSettings } from './room.js';
import type { BlastZoneState, GameInput } from './blastzone.js';
import type { FinlayBrosState, BrosInput } from './bros.js';
import type { FinlayKartState, KartInput } from './kart.js';
import type { GameType } from './game.js';

export interface MatchPlacement {
  playerId: string;
  name: string;
  color: PlayerColor;
  score: number;
  placement: number;
  detail?: string;
}

export interface MatchResult {
  matchId: string;
  gameType: GameType;
  outcome?: 'winner' | 'cleared' | 'failed';
  title?: string;
  subtitle?: string;
  placements: MatchPlacement[];
}

export interface ClientToServerEvents {
  'room:create': (
    data: { playerName: string; color: PlayerColor; gameType?: GameType },
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
    callback: (
      response:
        | { ok: true; room: Room; gameState?: BlastZoneState | FinlayKartState | FinlayBrosState }
        | { ok: false; error: string },
    ) => void,
  ) => void;

  'lobby:updateSettings': (
    data: { settings: Partial<RoomSettings> },
    callback: (response: { ok: true } | { ok: false; error: string }) => void,
  ) => void;

  'lobby:changeColor': (
    data: { color: PlayerColor },
    callback: (response: { ok: true } | { ok: false; error: string }) => void,
  ) => void;

  'lobby:addBot': (
    callback: (response: { ok: true } | { ok: false; error: string }) => void,
  ) => void;

  'lobby:removeBot': (
    data: { playerId: string },
    callback: (response: { ok: true } | { ok: false; error: string }) => void,
  ) => void;

  'lobby:startGame': (
    callback: (response: { ok: true } | { ok: false; error: string }) => void,
  ) => void;

  'tv:join': (
    data: { roomCode: string },
    callback: (
      response:
        | { ok: true; room: Room; gameState?: BlastZoneState | FinlayKartState | FinlayBrosState }
        | { ok: false; error: string },
    ) => void,
  ) => void;

  'game:input': (data: { input: GameInput | KartInput | BrosInput }) => void;
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

  'game:state': (data: { state: BlastZoneState | FinlayKartState | FinlayBrosState }) => void;
  'game:over': (data: { result: MatchResult }) => void;
  'game:backToLobby': () => void;
}
