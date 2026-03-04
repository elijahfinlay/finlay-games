import type { PlayerColor } from './player.js';

// ── Grid & Canvas ───────────────────────────────────────────────
export const KART_TILE_SIZE = 16;
export const KART_GRID_COLS = 50; // 800px canvas
export const KART_GRID_ROWS = 38; // 608px canvas

// ── Physics ─────────────────────────────────────────────────────
export const KART_MAX_SPEED = 3.0;
export const KART_ACCELERATION = 0.12;
export const KART_BRAKE_FORCE = 0.15;
export const KART_FRICTION = 0.03;
export const KART_TURN_SPEED = 0.065; // radians per tick
export const KART_GRASS_PENALTY = 0.5; // max-speed multiplier on grass
export const KART_WALL_BOUNCE = 0.3;
export const KART_DRIFT_FACTOR = 0.92;

export const TOTAL_LAPS_OPTIONS = [3, 5, 7] as const;

// ── Track tiles ─────────────────────────────────────────────────
export enum KartTile {
  Road = 0,
  Grass = 1,
  Wall = 2,
  Boost = 3,
}

// ── Track layout (50 x 38) ─────────────────────────────────────
// Oval circuit with inner walls. Road = 0, Grass = 1, Wall = 2, Boost = 3
function buildTrack(): KartTile[][] {
  const R = KartTile.Road;
  const G = KartTile.Grass;
  const W = KartTile.Wall;
  const B = KartTile.Boost;

  // Start with all grass
  const grid: KartTile[][] = [];
  for (let y = 0; y < KART_GRID_ROWS; y++) {
    grid.push(new Array(KART_GRID_COLS).fill(G));
  }

  // Helper to fill a rect
  const fill = (x1: number, y1: number, x2: number, y2: number, t: KartTile) => {
    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) {
        if (y >= 0 && y < KART_GRID_ROWS && x >= 0 && x < KART_GRID_COLS) {
          grid[y][x] = t;
        }
      }
    }
  };

  // Outer wall border
  fill(0, 0, 49, 0, W);        // top
  fill(0, 37, 49, 37, W);      // bottom
  fill(0, 0, 0, 37, W);        // left
  fill(49, 0, 49, 37, W);      // right

  // ── Outer road ring (oval track) ──
  // Top straight: y=3..6, x=5..44
  fill(5, 3, 44, 6, R);
  // Bottom straight: y=31..34, x=5..44
  fill(5, 31, 44, 34, R);
  // Left straight: x=2..5, y=5..32
  fill(2, 5, 5, 32, R);
  // Right straight: x=44..47, y=5..32
  fill(44, 5, 47, 32, R);

  // Top-left corner: curved road
  fill(2, 3, 5, 6, R);
  fill(3, 2, 6, 3, R);
  // Top-right corner
  fill(44, 3, 47, 6, R);
  fill(43, 2, 46, 3, R);
  // Bottom-left corner
  fill(2, 31, 5, 34, R);
  fill(3, 34, 6, 35, R);
  // Bottom-right corner
  fill(44, 31, 47, 34, R);
  fill(43, 34, 46, 35, R);

  // ── Inner wall (creates the oval hole) ──
  fill(10, 10, 39, 10, W);     // inner top wall
  fill(10, 27, 39, 27, W);     // inner bottom wall
  fill(10, 10, 10, 27, W);     // inner left wall
  fill(39, 10, 39, 27, W);     // inner right wall

  // ── Inner grass (inside the oval) ──
  fill(11, 11, 38, 26, G);

  // ── Widen road on straights for better racing ──
  // Top approach
  fill(5, 2, 44, 2, R);
  fill(5, 7, 44, 7, R);
  // Bottom approach
  fill(5, 30, 44, 30, R);
  fill(5, 35, 44, 35, R);
  // Left approach
  fill(1, 5, 1, 32, R);
  fill(6, 7, 6, 30, R);
  // Right approach
  fill(48, 5, 48, 32, R);
  fill(43, 7, 43, 30, R);

  // ── Add road between outer ring and inner wall ──
  // Fill the gap areas with road
  fill(7, 7, 9, 9, R);     // inner top-left approach
  fill(40, 7, 42, 9, R);   // inner top-right approach
  fill(7, 28, 9, 30, R);   // inner bottom-left approach
  fill(40, 28, 42, 30, R); // inner bottom-right approach

  // Full road fill between rings
  fill(7, 8, 42, 9, R);    // above inner top wall
  fill(7, 28, 42, 29, R);  // below inner bottom wall
  fill(7, 10, 9, 27, R);   // left of inner left wall
  fill(40, 10, 42, 27, R); // right of inner right wall

  // ── Boost pads ──
  // Top straight mid
  grid[4][24] = B;
  grid[4][25] = B;
  // Bottom straight mid
  grid[33][24] = B;
  grid[33][25] = B;
  // Left straight mid
  grid[18][3] = B;
  grid[19][3] = B;
  // Right straight mid
  grid[18][46] = B;
  grid[19][46] = B;

  return grid;
}

export const KART_TRACK: KartTile[][] = buildTrack();

// ── Checkpoints ─────────────────────────────────────────────────
// Zones the player must pass through in order (AABB: x, y in pixels)
export interface CheckpointZone {
  x: number;      // left edge (pixels)
  y: number;      // top edge (pixels)
  width: number;  // pixels
  height: number; // pixels
}

export const KART_CHECKPOINTS: CheckpointZone[] = [
  // CP0: Top straight mid (start/finish line area — crossing this after all CPs = lap)
  { x: 22 * KART_TILE_SIZE, y: 2 * KART_TILE_SIZE, width: 6 * KART_TILE_SIZE, height: 6 * KART_TILE_SIZE },
  // CP1: Top-right corner
  { x: 43 * KART_TILE_SIZE, y: 2 * KART_TILE_SIZE, width: 6 * KART_TILE_SIZE, height: 6 * KART_TILE_SIZE },
  // CP2: Right straight mid
  { x: 43 * KART_TILE_SIZE, y: 16 * KART_TILE_SIZE, width: 6 * KART_TILE_SIZE, height: 6 * KART_TILE_SIZE },
  // CP3: Bottom-right corner
  { x: 43 * KART_TILE_SIZE, y: 29 * KART_TILE_SIZE, width: 6 * KART_TILE_SIZE, height: 6 * KART_TILE_SIZE },
  // CP4: Bottom straight mid
  { x: 22 * KART_TILE_SIZE, y: 29 * KART_TILE_SIZE, width: 6 * KART_TILE_SIZE, height: 6 * KART_TILE_SIZE },
  // CP5: Bottom-left corner
  { x: 1 * KART_TILE_SIZE, y: 29 * KART_TILE_SIZE, width: 6 * KART_TILE_SIZE, height: 6 * KART_TILE_SIZE },
  // CP6: Left straight mid
  { x: 1 * KART_TILE_SIZE, y: 16 * KART_TILE_SIZE, width: 6 * KART_TILE_SIZE, height: 6 * KART_TILE_SIZE },
  // CP7: Top-left corner
  { x: 1 * KART_TILE_SIZE, y: 2 * KART_TILE_SIZE, width: 6 * KART_TILE_SIZE, height: 6 * KART_TILE_SIZE },
];

// ── Spawn positions ─────────────────────────────────────────────
// On the start/finish line (top straight), spaced apart
export interface KartSpawn {
  x: number;     // pixel x
  y: number;     // pixel y
  angle: number; // radians (0 = right, PI/2 = down)
}

export const KART_SPAWN_POSITIONS: KartSpawn[] = [
  { x: 24 * KART_TILE_SIZE, y: 3 * KART_TILE_SIZE, angle: 0 },
  { x: 24 * KART_TILE_SIZE, y: 5 * KART_TILE_SIZE, angle: 0 },
  { x: 22 * KART_TILE_SIZE, y: 3 * KART_TILE_SIZE, angle: 0 },
  { x: 22 * KART_TILE_SIZE, y: 5 * KART_TILE_SIZE, angle: 0 },
  { x: 20 * KART_TILE_SIZE, y: 3 * KART_TILE_SIZE, angle: 0 },
  { x: 20 * KART_TILE_SIZE, y: 5 * KART_TILE_SIZE, angle: 0 },
  { x: 18 * KART_TILE_SIZE, y: 3 * KART_TILE_SIZE, angle: 0 },
  { x: 18 * KART_TILE_SIZE, y: 5 * KART_TILE_SIZE, angle: 0 },
];

// ── Player state ────────────────────────────────────────────────
export interface KartPlayer {
  id: string;
  name: string;
  color: PlayerColor;
  pos: { x: number; y: number };  // pixel position
  angle: number;                    // radians
  speed: number;
  lap: number;                      // current lap (1-indexed)
  nextCheckpoint: number;           // index into KART_CHECKPOINTS
  finished: boolean;
  finishTime: number | null;        // ms from race start
  isBot: boolean;
}

// ── Game state ──────────────────────────────────────────────────
export interface FinlayKartState {
  gameType: 'finlay-kart';
  phase: 'countdown' | 'racing' | 'finished';
  countdown: number;
  raceStartedAt: number;
  elapsedMs: number;
  totalLaps: number;
  players: KartPlayer[];
  track: KartTile[][];
}

// ── Input ───────────────────────────────────────────────────────
export type KartInput =
  | { type: 'kartKeyDown'; key: 'up' | 'down' | 'left' | 'right' }
  | { type: 'kartKeyUp'; key: 'up' | 'down' | 'left' | 'right' };

// ── Bot names ───────────────────────────────────────────────────
export const KART_BOT_NAMES = ['Turbo', 'Sparky', 'Nitro', 'Dash', 'Blitz', 'Rev', 'Zippy'] as const;

// ── Waypoints for AI (centers of road segments around the track) ──
export const KART_WAYPOINTS: { x: number; y: number }[] = [
  // Start on top straight heading right
  { x: 30 * KART_TILE_SIZE, y: 4 * KART_TILE_SIZE },
  { x: 38 * KART_TILE_SIZE, y: 4 * KART_TILE_SIZE },
  // Top-right corner
  { x: 45 * KART_TILE_SIZE, y: 4 * KART_TILE_SIZE },
  { x: 46 * KART_TILE_SIZE, y: 8 * KART_TILE_SIZE },
  // Right straight
  { x: 46 * KART_TILE_SIZE, y: 14 * KART_TILE_SIZE },
  { x: 46 * KART_TILE_SIZE, y: 22 * KART_TILE_SIZE },
  // Bottom-right corner
  { x: 46 * KART_TILE_SIZE, y: 32 * KART_TILE_SIZE },
  { x: 42 * KART_TILE_SIZE, y: 33 * KART_TILE_SIZE },
  // Bottom straight
  { x: 34 * KART_TILE_SIZE, y: 33 * KART_TILE_SIZE },
  { x: 24 * KART_TILE_SIZE, y: 33 * KART_TILE_SIZE },
  { x: 14 * KART_TILE_SIZE, y: 33 * KART_TILE_SIZE },
  // Bottom-left corner
  { x: 4 * KART_TILE_SIZE, y: 33 * KART_TILE_SIZE },
  { x: 3 * KART_TILE_SIZE, y: 28 * KART_TILE_SIZE },
  // Left straight
  { x: 3 * KART_TILE_SIZE, y: 22 * KART_TILE_SIZE },
  { x: 3 * KART_TILE_SIZE, y: 14 * KART_TILE_SIZE },
  // Top-left corner
  { x: 3 * KART_TILE_SIZE, y: 6 * KART_TILE_SIZE },
  { x: 8 * KART_TILE_SIZE, y: 4 * KART_TILE_SIZE },
  // Back toward start
  { x: 16 * KART_TILE_SIZE, y: 4 * KART_TILE_SIZE },
];
