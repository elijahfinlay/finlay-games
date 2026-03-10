import type { PlayerColor } from './player.js';

export interface BrosPoint {
  x: number;
  y: number;
}

export interface BrosRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BrosCheckpoint extends BrosRect {
  id: number;
}

export interface BrosLevel {
  width: number;
  height: number;
  spawn: BrosPoint;
  checkpointSpawns: BrosPoint[];
  platforms: BrosRect[];
  hazards: BrosRect[];
  checkpoints: BrosCheckpoint[];
  goal: BrosRect;
}

export interface BrosCamera extends BrosRect {}

export interface BrosPlayer {
  id: string;
  name: string;
  color: PlayerColor;
  pos: BrosPoint;
  velocity: BrosPoint;
  facing: 'left' | 'right';
  grounded: boolean;
  finished: boolean;
  active: boolean;
  respawning: boolean;
  respawnAt: number | null;
  checkpoint: number;
  progress: number;
  deaths: number;
}

export interface FinlayBrosState {
  gameType: 'finlay-bros';
  phase: 'countdown' | 'playing' | 'gameOver';
  countdown: number;
  timeLeft: number;
  outcome: 'cleared' | 'failed' | null;
  teamCheckpoint: number;
  camera: BrosCamera;
  level: BrosLevel;
  players: BrosPlayer[];
}

export type BrosInput =
  | { type: 'brosKeyDown'; key: 'left' | 'right' }
  | { type: 'brosKeyUp'; key: 'left' | 'right' }
  | { type: 'brosJump' };

export const BROS_PLAYER_WIDTH = 24;
export const BROS_PLAYER_HEIGHT = 30;
export const BROS_VIEW_WIDTH = 960;
export const BROS_VIEW_HEIGHT = 576;
export const BROS_GRAVITY = 0.85;
export const BROS_MAX_FALL_SPEED = 18;
export const BROS_MOVE_SPEED = 12.5;
export const BROS_JUMP_VELOCITY = 14.2;
export const BROS_RESPAWN_MS = 1200;

export const FINLAY_BROS_LEVEL: BrosLevel = {
  width: 2280,
  height: 640,
  spawn: { x: 96, y: 474 },
  checkpointSpawns: [
    { x: 96, y: 474 },
    { x: 740, y: 474 },
    { x: 1460, y: 474 },
    { x: 1910, y: 474 },
  ],
  platforms: [
    { x: 0, y: 544, width: 470, height: 96 },
    { x: 560, y: 544, width: 620, height: 96 },
    { x: 1310, y: 544, width: 970, height: 96 },
    { x: 500, y: 500, width: 94, height: 20 },
    { x: 820, y: 468, width: 118, height: 20 },
    { x: 1210, y: 490, width: 104, height: 20 },
    { x: 1360, y: 436, width: 130, height: 20 },
    { x: 1680, y: 422, width: 130, height: 20 },
    { x: 1860, y: 380, width: 128, height: 20 },
  ],
  hazards: [
    { x: 470, y: 620, width: 90, height: 40 },
    { x: 1180, y: 620, width: 130, height: 40 },
    { x: 1520, y: 520, width: 104, height: 24 },
  ],
  checkpoints: [
    { id: 1, x: 560, y: 440, width: 56, height: 80 },
    { id: 2, x: 1330, y: 436, width: 56, height: 80 },
    { id: 3, x: 1840, y: 360, width: 56, height: 80 },
  ],
  goal: { x: 2140, y: 430, width: 34, height: 114 },
};
