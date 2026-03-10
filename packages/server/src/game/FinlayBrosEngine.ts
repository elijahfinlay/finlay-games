import {
  type FinlayBrosState,
  type BrosInput,
  type BrosPlayer,
  type BrosPoint,
  type PlayerColor,
  type BrosRect,
  FINLAY_BROS_LEVEL,
  BROS_GRAVITY,
  BROS_JUMP_VELOCITY,
  BROS_MAX_FALL_SPEED,
  BROS_MOVE_SPEED,
  BROS_PLAYER_HEIGHT,
  BROS_PLAYER_WIDTH,
  BROS_RESPAWN_MS,
  BROS_VIEW_HEIGHT,
  BROS_VIEW_WIDTH,
  COUNTDOWN_SECONDS,
} from '@finlay-games/shared';

interface PlayerInit {
  id: string;
  name: string;
  color: PlayerColor;
}

type HorizontalKey = 'left' | 'right';

interface PlayerBounds extends BrosRect {}

export class FinlayBrosEngine {
  state: FinlayBrosState;
  private keysHeld = new Map<string, Set<HorizontalKey>>();
  private finisherId: string | null = null;

  constructor(players: PlayerInit[], roundTime: number) {
    this.state = {
      gameType: 'finlay-bros',
      phase: 'countdown',
      countdown: COUNTDOWN_SECONDS,
      timeLeft: roundTime,
      outcome: null,
      teamCheckpoint: 0,
      camera: {
        x: 0,
        y: 0,
        width: BROS_VIEW_WIDTH,
        height: BROS_VIEW_HEIGHT,
      },
      level: FINLAY_BROS_LEVEL,
      players: players.map((player, index) => {
        this.keysHeld.set(player.id, new Set());
        const spawn = this.getSpawnPoint(0, index);
        return {
          id: player.id,
          name: player.name,
          color: player.color,
          pos: spawn,
          velocity: { x: 0, y: 0 },
          facing: 'right',
          grounded: false,
          finished: false,
          active: true,
          respawning: false,
          respawnAt: null,
          checkpoint: 0,
          progress: spawn.x,
          deaths: 0,
        };
      }),
    };

    this.updateCamera();
  }

  decrementCountdown(): boolean {
    if (this.state.phase !== 'countdown') return false;
    this.state.countdown--;
    if (this.state.countdown <= 0) {
      this.state.phase = 'playing';
      return true;
    }
    return false;
  }

  decrementTimer() {
    if (this.state.phase !== 'playing') return;
    this.state.timeLeft--;
    if (this.state.timeLeft <= 0) {
      this.state.timeLeft = 0;
      this.state.phase = 'gameOver';
      this.state.outcome = 'failed';
    }
  }

  handleInput(playerId: string, input: BrosInput) {
    const player = this.state.players.find((entry) => entry.id === playerId);
    if (!player) return;

    if (input.type === 'brosJump') {
      if (
        this.state.phase === 'playing' &&
        player.active &&
        !player.finished &&
        !player.respawning &&
        player.grounded
      ) {
        player.velocity.y = -BROS_JUMP_VELOCITY;
        player.grounded = false;
      }
      return;
    }

    const keys = this.keysHeld.get(playerId);
    if (!keys) return;
    if (input.type === 'brosKeyDown') {
      keys.add(input.key);
    } else if (input.type === 'brosKeyUp') {
      keys.delete(input.key);
    }
  }

  tick(now: number) {
    if (this.state.phase !== 'playing') return;

    for (let index = 0; index < this.state.players.length; index++) {
      const player = this.state.players[index];
      if (!player.active || player.finished) continue;

      if (player.respawning) {
        if (player.respawnAt !== null && now >= player.respawnAt) {
          this.respawnPlayer(player, index);
        }
        continue;
      }

      this.updatePlayer(player);
      player.progress = Math.max(player.progress, player.pos.x);
      this.checkCheckpoint(player);

      if (this.intersects(this.getBounds(player), this.state.level.goal)) {
        player.finished = true;
        player.progress = this.state.level.goal.x + this.state.level.goal.width;
        this.finisherId = player.id;
        this.state.phase = 'gameOver';
        this.state.outcome = 'cleared';
        break;
      }

      if (
        this.hitsHazard(player) ||
        player.pos.y > this.state.level.height + 80
      ) {
        this.queueRespawn(player, now);
      }
    }

    this.updateCamera();
  }

  markPlayerInactive(playerId: string) {
    const player = this.state.players.find((entry) => entry.id === playerId);
    if (!player) return;
    player.active = false;
    player.finished = false;
    player.respawning = false;
    player.respawnAt = null;
    player.velocity = { x: 0, y: 0 };
    player.grounded = false;
    const keys = this.keysHeld.get(playerId);
    keys?.clear();
  }

  getFinisherId(): string | null {
    return this.finisherId;
  }

  private updatePlayer(player: BrosPlayer) {
    const keys = this.keysHeld.get(player.id);
    const movingLeft = keys?.has('left') ?? false;
    const movingRight = keys?.has('right') ?? false;

    if (movingLeft === movingRight) {
      player.velocity.x = 0;
    } else if (movingLeft) {
      player.velocity.x = -BROS_MOVE_SPEED;
      player.facing = 'left';
    } else {
      player.velocity.x = BROS_MOVE_SPEED;
      player.facing = 'right';
    }

    const horizontal = this.moveHorizontally(player, player.velocity.x);
    player.pos.x = horizontal.x;
    player.velocity.x = horizontal.velocityX;

    player.velocity.y = Math.min(player.velocity.y + BROS_GRAVITY, BROS_MAX_FALL_SPEED);
    const vertical = this.moveVertically(player, player.velocity.y);
    player.pos.y = vertical.y;
    player.velocity.y = vertical.velocityY;
    player.grounded = vertical.grounded;
  }

  private moveHorizontally(player: BrosPlayer, deltaX: number) {
    if (deltaX === 0) {
      return { x: player.pos.x, velocityX: 0 };
    }

    let nextX = player.pos.x + deltaX;
    const bounds = this.getBounds(player, nextX, player.pos.y);

    for (const platform of this.state.level.platforms) {
      if (!this.intersects(bounds, platform)) continue;
      if (deltaX > 0) {
        nextX = platform.x - BROS_PLAYER_WIDTH;
      } else {
        nextX = platform.x + platform.width;
      }
      return { x: nextX, velocityX: 0 };
    }

    nextX = Math.max(0, Math.min(nextX, this.state.level.width - BROS_PLAYER_WIDTH));
    return { x: nextX, velocityX: deltaX };
  }

  private moveVertically(player: BrosPlayer, deltaY: number) {
    let nextY = player.pos.y + deltaY;
    let velocityY = deltaY;
    let grounded = false;
    const currentBounds = this.getBounds(player);
    const bounds = this.getBounds(player, player.pos.x, nextY);

    for (const platform of this.state.level.platforms) {
      if (!this.intersects(bounds, platform)) continue;

      if (deltaY >= 0 && currentBounds.y + currentBounds.height <= platform.y) {
        nextY = platform.y - BROS_PLAYER_HEIGHT;
        velocityY = 0;
        grounded = true;
      } else if (deltaY < 0 && currentBounds.y >= platform.y + platform.height) {
        nextY = platform.y + platform.height;
        velocityY = 0;
      }
    }

    return { y: nextY, velocityY, grounded };
  }

  private checkCheckpoint(player: BrosPlayer) {
    for (const checkpoint of this.state.level.checkpoints) {
      if (!this.intersects(this.getBounds(player), checkpoint)) continue;
      if (checkpoint.id > this.state.teamCheckpoint) {
        this.state.teamCheckpoint = checkpoint.id;
      }
      player.checkpoint = Math.max(player.checkpoint, checkpoint.id);
      player.progress = Math.max(player.progress, checkpoint.x + checkpoint.width);
    }
  }

  private hitsHazard(player: BrosPlayer) {
    const bounds = this.getBounds(player);
    return this.state.level.hazards.some((hazard) => this.intersects(bounds, hazard));
  }

  private queueRespawn(player: BrosPlayer, now: number) {
    player.deaths++;
    player.respawning = true;
    player.respawnAt = now + BROS_RESPAWN_MS;
    player.velocity = { x: 0, y: 0 };
    player.grounded = false;
  }

  private respawnPlayer(player: BrosPlayer, index: number) {
    player.pos = this.getSpawnPoint(this.state.teamCheckpoint, index);
    player.velocity = { x: 0, y: 0 };
    player.grounded = false;
    player.respawning = false;
    player.respawnAt = null;
    player.checkpoint = Math.max(player.checkpoint, this.state.teamCheckpoint);
  }

  private getSpawnPoint(checkpointIndex: number, playerIndex: number): BrosPoint {
    const spawn = this.state?.level.checkpointSpawns[checkpointIndex] ??
      FINLAY_BROS_LEVEL.checkpointSpawns[checkpointIndex] ??
      FINLAY_BROS_LEVEL.spawn;
    const row = Math.floor(playerIndex / 4);
    const column = playerIndex % 4;
    return {
      x: spawn.x + column * 28,
      y: spawn.y - row * 36,
    };
  }

  private updateCamera() {
    const focusPlayers = this.state.players.filter(
      (player) => player.active && !player.respawning,
    );
    const fallback = this.getSpawnPoint(this.state.teamCheckpoint, 0);
    const averageX =
      focusPlayers.reduce((sum, player) => sum + player.pos.x + BROS_PLAYER_WIDTH / 2, 0) /
        (focusPlayers.length || 1) || fallback.x;
    const averageY =
      focusPlayers.reduce((sum, player) => sum + player.pos.y + BROS_PLAYER_HEIGHT / 2, 0) /
        (focusPlayers.length || 1) || fallback.y;

    const maxX = Math.max(0, this.state.level.width - this.state.camera.width);
    const maxY = Math.max(0, this.state.level.height - this.state.camera.height);

    this.state.camera.x = Math.max(
      0,
      Math.min(Math.round(averageX - this.state.camera.width / 2), maxX),
    );
    this.state.camera.y = Math.max(
      0,
      Math.min(Math.round(averageY - this.state.camera.height / 2), maxY),
    );
  }

  private getBounds(player: BrosPlayer, x = player.pos.x, y = player.pos.y): PlayerBounds {
    return {
      x,
      y,
      width: BROS_PLAYER_WIDTH,
      height: BROS_PLAYER_HEIGHT,
    };
  }

  private intersects(a: BrosRect, b: BrosRect) {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }
}
