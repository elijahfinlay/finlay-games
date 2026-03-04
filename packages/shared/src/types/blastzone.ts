import type { PlayerColor } from './player.js';

// Grid
export const GRID_COLS = 13;
export const GRID_ROWS = 11;
export const TILE_SIZE = 48;

export enum TileType {
  Empty = 0,
  Wall = 1,    // indestructible
  Brick = 2,   // destructible
}

export interface Position {
  x: number;
  y: number;
}

export interface BZPlayer {
  id: string;
  name: string;
  color: PlayerColor;
  pos: Position;
  alive: boolean;
  bombRange: number;
  maxBombs: number;
  activeBombs: number;
  speed: number;
}

export interface Bomb {
  id: string;
  ownerId: string;
  pos: Position;
  range: number;
  plantedAt: number;
  fuseMs: number;
}

export interface Explosion {
  cells: Position[];
  startedAt: number;
  durationMs: number;
}

export interface PowerUp {
  pos: Position;
  type: 'range' | 'bomb' | 'speed';
}

export interface BlastZoneState {
  gameType: 'blast-zone';
  grid: TileType[][];
  players: BZPlayer[];
  bombs: Bomb[];
  explosions: Explosion[];
  powerUps: PowerUp[];
  roundTimeLeft: number;
  round: number;
  totalRounds: number;
  phase: 'countdown' | 'playing' | 'roundEnd' | 'gameOver';
  countdown: number;
  scores: Record<string, number>;
  winnerId: string | null;
}

export type GameInput =
  | { type: 'move'; direction: 'up' | 'down' | 'left' | 'right' }
  | { type: 'bomb' };

// Spawn positions (corners + midpoints for up to 8 players)
export const SPAWN_POSITIONS: Position[] = [
  { x: 1, y: 1 },       // top-left
  { x: 11, y: 9 },      // bottom-right
  { x: 11, y: 1 },      // top-right
  { x: 1, y: 9 },       // bottom-left
  { x: 6, y: 1 },       // top-center
  { x: 6, y: 9 },       // bottom-center
  { x: 1, y: 5 },       // left-center
  { x: 11, y: 5 },      // right-center
];

export const BOMB_FUSE_MS = 2500;
export const EXPLOSION_DURATION_MS = 400;
export const GAME_TICK_MS = 66; // ~15fps
export const COUNTDOWN_SECONDS = 3;
export const POWERUP_CHANCE = 0.3;
