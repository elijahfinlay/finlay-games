import {
  type FinlayKartState,
  type KartPlayer,
  type KartInput,
  type PlayerColor,
  KartTile,
  KART_TRACK,
  KART_TILE_SIZE,
  KART_GRID_COLS,
  KART_GRID_ROWS,
  KART_MAX_SPEED,
  KART_ACCELERATION,
  KART_BRAKE_FORCE,
  KART_FRICTION,
  KART_TURN_SPEED,
  KART_GRASS_PENALTY,
  KART_WALL_BOUNCE,
  KART_DRIFT_FACTOR,
  KART_CHECKPOINTS,
  KART_SPAWN_POSITIONS,
  KART_WAYPOINTS,
  COUNTDOWN_SECONDS,
} from '@finlay-games/shared';

export interface KartPlayerInit {
  id: string;
  name: string;
  color: PlayerColor;
  isBot: boolean;
}

export class FinlayKartEngine {
  state: FinlayKartState;
  private keysHeld: Map<string, Set<string>>; // playerId -> held keys
  private botTargets: Map<string, number>;     // botId -> waypoint index
  private finishTimeout: ReturnType<typeof setTimeout> | null = null;
  private firstFinishTime: number | null = null;

  constructor(players: KartPlayerInit[], totalLaps: number) {
    this.keysHeld = new Map();
    this.botTargets = new Map();

    const kartPlayers: KartPlayer[] = players.map((p, i) => {
      const spawn = KART_SPAWN_POSITIONS[i % KART_SPAWN_POSITIONS.length];
      this.keysHeld.set(p.id, new Set());
      if (p.isBot) {
        this.botTargets.set(p.id, 0);
      }
      return {
        id: p.id,
        name: p.name,
        color: p.color,
        pos: { x: spawn.x, y: spawn.y },
        angle: spawn.angle,
        speed: 0,
        lap: 1,
        nextCheckpoint: 1, // CP0 is at start; first target is CP1
        finished: false,
        finishTime: null,
        isBot: p.isBot,
      };
    });

    this.state = {
      gameType: 'finlay-kart',
      phase: 'countdown',
      countdown: COUNTDOWN_SECONDS,
      raceStartedAt: 0,
      elapsedMs: 0,
      totalLaps: totalLaps,
      players: kartPlayers,
      track: KART_TRACK,
    };
  }

  decrementCountdown(): boolean {
    if (this.state.phase !== 'countdown') return false;
    this.state.countdown--;
    if (this.state.countdown <= 0) {
      this.state.phase = 'racing';
      this.state.raceStartedAt = Date.now();
      return true;
    }
    return false;
  }

  handleInput(playerId: string, input: KartInput): void {
    const keys = this.keysHeld.get(playerId);
    if (!keys) return;

    if (input.type === 'kartKeyDown') {
      keys.add(input.key);
    } else if (input.type === 'kartKeyUp') {
      keys.delete(input.key);
    }
  }

  tick(now: number): void {
    if (this.state.phase === 'countdown') return;
    if (this.state.phase === 'finished') return;

    this.state.elapsedMs = now - this.state.raceStartedAt;

    // Update bots
    for (const player of this.state.players) {
      if (player.isBot && !player.finished) {
        this.updateBot(player);
      }
    }

    // Update each player physics
    for (const player of this.state.players) {
      if (player.finished) continue;
      this.updatePlayer(player);
    }

    // Check if race should end
    this.checkRaceEnd(now);
  }

  private updatePlayer(player: KartPlayer): void {
    const keys = this.keysHeld.get(player.id);
    if (!keys) return;

    const up = keys.has('up');
    const down = keys.has('down');
    const left = keys.has('left');
    const right = keys.has('right');

    // Steering (only when moving)
    if (Math.abs(player.speed) > 0.3) {
      if (left) player.angle -= KART_TURN_SPEED;
      if (right) player.angle += KART_TURN_SPEED;
    }

    // Acceleration / braking
    if (up) {
      player.speed += KART_ACCELERATION;
    } else if (down) {
      if (player.speed > 0) {
        player.speed -= KART_BRAKE_FORCE;
        if (player.speed < 0) player.speed = 0;
      } else {
        // Reverse (slow)
        player.speed -= KART_ACCELERATION * 0.4;
      }
    }

    // Friction
    player.speed *= (1 - KART_FRICTION);

    // Clamp tiny speeds to zero
    if (Math.abs(player.speed) < 0.01) player.speed = 0;

    // Check tile for speed cap
    const tileX = Math.floor(player.pos.x / KART_TILE_SIZE);
    const tileY = Math.floor(player.pos.y / KART_TILE_SIZE);
    const currentTile = this.getTile(tileX, tileY);

    let maxSpeed = KART_MAX_SPEED;
    if (currentTile === KartTile.Grass) {
      maxSpeed = KART_MAX_SPEED * KART_GRASS_PENALTY;
    } else if (currentTile === KartTile.Boost) {
      maxSpeed = KART_MAX_SPEED * 1.5;
      player.speed = Math.max(player.speed, KART_MAX_SPEED * 1.2);
    }

    // Cap speed
    if (player.speed > maxSpeed) player.speed = maxSpeed;
    if (player.speed < -maxSpeed * 0.3) player.speed = -maxSpeed * 0.3;

    // Compute velocity
    const vx = Math.cos(player.angle) * player.speed;
    const vy = Math.sin(player.angle) * player.speed;

    // Apply drift blending
    const newX = player.pos.x + vx * KART_DRIFT_FACTOR;
    const newY = player.pos.y + vy * KART_DRIFT_FACTOR;

    // Wall collision check
    const newTileX = Math.floor(newX / KART_TILE_SIZE);
    const newTileY = Math.floor(newY / KART_TILE_SIZE);
    const destTile = this.getTile(newTileX, newTileY);

    if (destTile === KartTile.Wall) {
      // Bounce back
      player.speed *= -KART_WALL_BOUNCE;
      if (Math.abs(player.speed) < 0.1) player.speed = 0;
    } else {
      player.pos.x = newX;
      player.pos.y = newY;
    }

    // Keep in bounds
    player.pos.x = Math.max(KART_TILE_SIZE, Math.min(player.pos.x, (KART_GRID_COLS - 1) * KART_TILE_SIZE));
    player.pos.y = Math.max(KART_TILE_SIZE, Math.min(player.pos.y, (KART_GRID_ROWS - 1) * KART_TILE_SIZE));

    // Check checkpoint
    this.checkCheckpoint(player);
  }

  private getTile(tileX: number, tileY: number): KartTile {
    if (tileX < 0 || tileX >= KART_GRID_COLS || tileY < 0 || tileY >= KART_GRID_ROWS) {
      return KartTile.Wall;
    }
    return KART_TRACK[tileY][tileX];
  }

  private checkCheckpoint(player: KartPlayer): void {
    const cp = KART_CHECKPOINTS[player.nextCheckpoint];
    if (!cp) return;

    // AABB overlap
    const px = player.pos.x;
    const py = player.pos.y;
    if (px >= cp.x && px <= cp.x + cp.width && py >= cp.y && py <= cp.y + cp.height) {
      // Check if we're crossing the start/finish line (CP0)
      const crossedStartFinish = player.nextCheckpoint === 0;

      player.nextCheckpoint++;
      if (player.nextCheckpoint >= KART_CHECKPOINTS.length) {
        player.nextCheckpoint = 0;
      }

      // Only increment lap when crossing the start/finish line (CP0)
      if (crossedStartFinish) {
        player.lap++;

        if (player.lap > this.state.totalLaps) {
          player.finished = true;
          player.finishTime = this.state.elapsedMs;
          player.lap = this.state.totalLaps; // Don't show lap beyond total

          if (this.firstFinishTime === null) {
            this.firstFinishTime = Date.now();
          }
        }
      }
    }
  }

  private updateBot(player: KartPlayer): void {
    const waypointIdx = this.botTargets.get(player.id) ?? 0;
    const waypoint = KART_WAYPOINTS[waypointIdx % KART_WAYPOINTS.length];

    const dx = waypoint.x - player.pos.x;
    const dy = waypoint.y - player.pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const targetAngle = Math.atan2(dy, dx);

    // Simulate key presses
    const keys = this.keysHeld.get(player.id)!;
    keys.clear();

    // Always accelerate (at ~85% by using slightly less aggressive accel)
    keys.add('up');

    // Steer toward waypoint
    let angleDiff = targetAngle - player.angle;
    // Normalize to [-PI, PI]
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

    // Add slight random jitter
    angleDiff += (Math.random() - 0.5) * 0.04;

    if (angleDiff > 0.05) {
      keys.add('right');
    } else if (angleDiff < -0.05) {
      keys.add('left');
    }

    // Advance waypoint when close enough
    if (dist < 30) {
      this.botTargets.set(player.id, (waypointIdx + 1) % KART_WAYPOINTS.length);
    }

    // Speed cap: limit bot max speed to 85%
    if (player.speed > KART_MAX_SPEED * 0.85) {
      keys.delete('up');
    }
  }

  private checkRaceEnd(now: number): void {
    const humanPlayers = this.state.players.filter((p) => !p.isBot);
    const allHumansFinished = humanPlayers.every((p) => p.finished);

    // End when all humans finish
    if (allHumansFinished && humanPlayers.length > 0) {
      this.endRace();
      return;
    }

    // End 10s after first finisher
    if (this.firstFinishTime !== null && now - this.firstFinishTime > 10_000) {
      this.endRace();
    }
  }

  private endRace(): void {
    if (this.state.phase === 'finished') return;
    this.state.phase = 'finished';

    // Mark unfinished players
    for (const p of this.state.players) {
      if (!p.finished) {
        p.finished = true;
        p.finishTime = null; // DNF
      }
    }
  }

  // Get sorted placements for game over
  getSortedPlacements(): KartPlayer[] {
    return [...this.state.players].sort((a, b) => {
      // Finished players first, sorted by finish time
      if (a.finishTime !== null && b.finishTime !== null) {
        return a.finishTime - b.finishTime;
      }
      if (a.finishTime !== null) return -1;
      if (b.finishTime !== null) return 1;
      // DNF: sort by laps completed (desc), then by nextCheckpoint (desc)
      if (a.lap !== b.lap) return b.lap - a.lap;
      return b.nextCheckpoint - a.nextCheckpoint;
    });
  }

  // Mark a disconnected player as DNF
  markPlayerDNF(playerId: string): void {
    const player = this.state.players.find((p) => p.id === playerId);
    if (player && !player.finished) {
      player.finished = true;
      player.finishTime = null;
      player.speed = 0;
      // Clear their keys
      const keys = this.keysHeld.get(playerId);
      if (keys) keys.clear();
    }
  }
}
