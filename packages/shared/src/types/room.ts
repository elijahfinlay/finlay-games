import type { Player } from './player.js';
import { GameType } from './game.js';

export interface RoomSettings {
  gameType: GameType;
  roundTime: number;
  rounds: number;
  powerUps: boolean;
}

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  gameType: GameType.BlastZone,
  roundTime: 120,
  rounds: 3,
  powerUps: true,
};

export interface Room {
  code: string;
  players: Player[];
  settings: RoomSettings;
  hostId: string;
  createdAt: number;
  state: 'lobby' | 'playing' | 'finished';
}

export interface RoomPeek {
  code: string;
  playerCount: number;
  takenColors: string[];
  state: Room['state'];
}
