import {
  type BlastZoneState,
  type BZPlayer,
  type Bomb,
  type Explosion,
  type PowerUp,
  type GameInput,
  type Position,
  type PlayerColor,
  TileType,
  GRID_COLS,
  GRID_ROWS,
  SPAWN_POSITIONS,
  BOMB_FUSE_MS,
  EXPLOSION_DURATION_MS,
  COUNTDOWN_SECONDS,
  POWERUP_CHANCE,
} from '@finlay-games/shared';
import crypto from 'node:crypto';

interface PlayerInit {
  id: string;
  name: string;
  color: PlayerColor;
}

export class BlastZoneEngine {
  state: BlastZoneState;
  private roundTime: number;

  constructor(players: PlayerInit[], rounds: number, roundTime: number) {
    this.roundTime = roundTime;
    this.state = {
      grid: this.generateGrid(),
      players: players.map((p, i) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        pos: { ...SPAWN_POSITIONS[i % SPAWN_POSITIONS.length] },
        alive: true,
        bombRange: 2,
        maxBombs: 1,
        activeBombs: 0,
        speed: 1,
      })),
      bombs: [],
      explosions: [],
      powerUps: [],
      roundTimeLeft: roundTime,
      round: 1,
      totalRounds: rounds,
      phase: 'countdown',
      countdown: COUNTDOWN_SECONDS,
      scores: Object.fromEntries(players.map((p) => [p.id, 0])),
      winnerId: null,
    };

    // Clear spawn areas
    for (let i = 0; i < players.length; i++) {
      const sp = SPAWN_POSITIONS[i % SPAWN_POSITIONS.length];
      this.clearSpawnArea(sp);
    }
  }

  private generateGrid(): TileType[][] {
    const grid: TileType[][] = [];
    for (let y = 0; y < GRID_ROWS; y++) {
      const row: TileType[] = [];
      for (let x = 0; x < GRID_COLS; x++) {
        // Border walls
        if (x === 0 || y === 0 || x === GRID_COLS - 1 || y === GRID_ROWS - 1) {
          row.push(TileType.Wall);
        }
        // Pillar pattern (every other cell)
        else if (x % 2 === 0 && y % 2 === 0) {
          row.push(TileType.Wall);
        }
        // Random bricks (~60% chance)
        else if (Math.random() < 0.6) {
          row.push(TileType.Brick);
        } else {
          row.push(TileType.Empty);
        }
      }
      grid.push(row);
    }
    return grid;
  }

  private clearSpawnArea(pos: Position) {
    // Clear a 3-cell L-shape around each spawn
    const clear = [
      pos,
      { x: pos.x + 1, y: pos.y },
      { x: pos.x - 1, y: pos.y },
      { x: pos.x, y: pos.y + 1 },
      { x: pos.x, y: pos.y - 1 },
    ];
    for (const c of clear) {
      if (c.x > 0 && c.x < GRID_COLS - 1 && c.y > 0 && c.y < GRID_ROWS - 1) {
        if (this.state.grid[c.y][c.x] === TileType.Brick) {
          this.state.grid[c.y][c.x] = TileType.Empty;
        }
      }
    }
  }

  handleInput(playerId: string, input: GameInput) {
    if (this.state.phase !== 'playing') return;
    const player = this.state.players.find((p) => p.id === playerId);
    if (!player || !player.alive) return;

    if (input.type === 'move') {
      const dx = input.direction === 'left' ? -1 : input.direction === 'right' ? 1 : 0;
      const dy = input.direction === 'up' ? -1 : input.direction === 'down' ? 1 : 0;
      const nx = player.pos.x + dx;
      const ny = player.pos.y + dy;

      if (this.canMoveTo(nx, ny)) {
        player.pos.x = nx;
        player.pos.y = ny;
        this.checkPowerUpPickup(player);
      }
    } else if (input.type === 'bomb') {
      this.placeBomb(player);
    }
  }

  private canMoveTo(x: number, y: number): boolean {
    if (x < 0 || x >= GRID_COLS || y < 0 || y >= GRID_ROWS) return false;
    if (this.state.grid[y][x] !== TileType.Empty) return false;
    // Can't walk onto bombs
    if (this.state.bombs.some((b) => b.pos.x === x && b.pos.y === y)) return false;
    return true;
  }

  private placeBomb(player: BZPlayer) {
    if (player.activeBombs >= player.maxBombs) return;
    // Don't place if there's already a bomb here
    if (this.state.bombs.some((b) => b.pos.x === player.pos.x && b.pos.y === player.pos.y)) return;

    const bomb: Bomb = {
      id: crypto.randomUUID(),
      ownerId: player.id,
      pos: { x: player.pos.x, y: player.pos.y },
      range: player.bombRange,
      plantedAt: Date.now(),
      fuseMs: BOMB_FUSE_MS,
    };
    this.state.bombs.push(bomb);
    player.activeBombs++;
  }

  tick(now: number): { eliminatedIds: string[] } {
    const eliminated: string[] = [];

    if (this.state.phase === 'countdown') {
      // Countdown handled by decrementing every second from the game loop
      return { eliminatedIds: [] };
    }

    if (this.state.phase !== 'playing') return { eliminatedIds: [] };

    // Process bombs
    const detonated: Bomb[] = [];
    for (const bomb of this.state.bombs) {
      if (now - bomb.plantedAt >= bomb.fuseMs) {
        detonated.push(bomb);
      }
    }

    for (const bomb of detonated) {
      this.detonateBomb(bomb, now);
      const owner = this.state.players.find((p) => p.id === bomb.ownerId);
      if (owner) owner.activeBombs = Math.max(0, owner.activeBombs - 1);
    }
    this.state.bombs = this.state.bombs.filter((b) => !detonated.includes(b));

    // Check explosion kills
    const activeExplosions = this.state.explosions.filter(
      (e) => now - e.startedAt < e.durationMs,
    );
    for (const player of this.state.players) {
      if (!player.alive) continue;
      for (const exp of activeExplosions) {
        if (exp.cells.some((c) => c.x === player.pos.x && c.y === player.pos.y)) {
          player.alive = false;
          eliminated.push(player.id);
          break;
        }
      }
    }

    // Clean up expired explosions
    this.state.explosions = activeExplosions;

    // Check round end
    const alivePlayers = this.state.players.filter((p) => p.alive);
    if (alivePlayers.length <= 1) {
      if (alivePlayers.length === 1) {
        this.state.scores[alivePlayers[0].id] = (this.state.scores[alivePlayers[0].id] ?? 0) + 1;
      }
      this.endRound();
    }

    return { eliminatedIds: eliminated };
  }

  decrementCountdown(): boolean {
    if (this.state.phase === 'countdown') {
      this.state.countdown--;
      if (this.state.countdown <= 0) {
        this.state.phase = 'playing';
        return true; // game started
      }
    }
    return false;
  }

  decrementTimer() {
    if (this.state.phase === 'playing') {
      this.state.roundTimeLeft--;
      if (this.state.roundTimeLeft <= 0) {
        // Time's up — everyone still alive ties, no points
        this.endRound();
      }
    }
  }

  private detonateBomb(bomb: Bomb, now: number) {
    const cells: Position[] = [{ x: bomb.pos.x, y: bomb.pos.y }];
    const dirs = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];

    for (const dir of dirs) {
      for (let i = 1; i <= bomb.range; i++) {
        const x = bomb.pos.x + dir.dx * i;
        const y = bomb.pos.y + dir.dy * i;
        if (x < 0 || x >= GRID_COLS || y < 0 || y >= GRID_ROWS) break;
        if (this.state.grid[y][x] === TileType.Wall) break;
        if (this.state.grid[y][x] === TileType.Brick) {
          this.state.grid[y][x] = TileType.Empty;
          cells.push({ x, y });
          // Maybe spawn power-up
          if (Math.random() < POWERUP_CHANCE) {
            const types: PowerUp['type'][] = ['range', 'bomb', 'speed'];
            this.state.powerUps.push({
              pos: { x, y },
              type: types[Math.floor(Math.random() * types.length)],
            });
          }
          break; // Explosion stops at brick
        }
        cells.push({ x, y });

        // Chain-detonate other bombs
        const chainBomb = this.state.bombs.find((b) => b.pos.x === x && b.pos.y === y && b !== bomb);
        if (chainBomb) {
          chainBomb.plantedAt = 0; // Force immediate detonation on next tick
        }
      }
    }

    this.state.explosions.push({
      cells,
      startedAt: now,
      durationMs: EXPLOSION_DURATION_MS,
    });
  }

  private checkPowerUpPickup(player: BZPlayer) {
    const idx = this.state.powerUps.findIndex(
      (p) => p.pos.x === player.pos.x && p.pos.y === player.pos.y,
    );
    if (idx === -1) return;

    const pu = this.state.powerUps[idx];
    switch (pu.type) {
      case 'range':
        player.bombRange = Math.min(player.bombRange + 1, 6);
        break;
      case 'bomb':
        player.maxBombs = Math.min(player.maxBombs + 1, 5);
        break;
      case 'speed':
        player.speed = Math.min(player.speed + 1, 3);
        break;
    }
    this.state.powerUps.splice(idx, 1);
  }

  private endRound() {
    if (this.state.round >= this.state.totalRounds) {
      this.state.phase = 'gameOver';
      // Determine winner by score
      let maxScore = -1;
      let winnerId: string | null = null;
      for (const [id, score] of Object.entries(this.state.scores)) {
        if (score > maxScore) {
          maxScore = score;
          winnerId = id;
        }
      }
      this.state.winnerId = winnerId;
    } else {
      this.state.phase = 'roundEnd';
    }
  }

  startNextRound() {
    this.state.round++;
    this.state.grid = this.generateGrid();
    this.state.bombs = [];
    this.state.explosions = [];
    this.state.powerUps = [];
    this.state.roundTimeLeft = this.roundTime;
    this.state.phase = 'countdown';
    this.state.countdown = COUNTDOWN_SECONDS;

    // Reset players
    for (let i = 0; i < this.state.players.length; i++) {
      const p = this.state.players[i];
      p.pos = { ...SPAWN_POSITIONS[i % SPAWN_POSITIONS.length] };
      p.alive = true;
      p.bombRange = 2;
      p.maxBombs = 1;
      p.activeBombs = 0;
      p.speed = 1;
    }

    // Clear spawn areas
    for (let i = 0; i < this.state.players.length; i++) {
      this.clearSpawnArea(this.state.players[i].pos);
    }
  }
}
