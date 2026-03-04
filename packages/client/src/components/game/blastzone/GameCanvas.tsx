import { useRef, useEffect } from 'react';
import {
  type BlastZoneState,
  TileType,
  TILE_SIZE,
  GRID_COLS,
  GRID_ROWS,
  PLAYER_COLOR_HEX,
} from '@finlay-games/shared';

interface GameCanvasProps {
  state: BlastZoneState;
  myId: string | null;
}

const CANVAS_W = GRID_COLS * TILE_SIZE;
const CANVAS_H = GRID_ROWS * TILE_SIZE;

export function GameCanvas({ state, myId }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Snapshot client time when each state update arrives — use as "server now" baseline
  const serverNowRef = useRef(Date.now());

  // Update baseline on every state change
  useEffect(() => {
    serverNowRef.current = Date.now();
  }, [state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Scale for retina
    const dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;
    ctx.scale(dpr, dpr);

    draw(ctx, state, myId, serverNowRef.current);
  }, [state, myId]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: CANVAS_W, height: CANVAS_H }}
      className="border border-retro-border"
    />
  );
}

function draw(ctx: CanvasRenderingContext2D, state: BlastZoneState, myId: string | null, serverNow: number) {
  const T = TILE_SIZE;

  // Background
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Grid
  for (let y = 0; y < GRID_ROWS; y++) {
    for (let x = 0; x < GRID_COLS; x++) {
      const tile = state.grid[y][x];
      const px = x * T;
      const py = y * T;

      if (tile === TileType.Wall) {
        ctx.fillStyle = '#374151';
        ctx.fillRect(px, py, T, T);
        // Wall pattern
        ctx.fillStyle = '#4B5563';
        ctx.fillRect(px + 2, py + 2, T - 4, T / 2 - 3);
        ctx.fillRect(px + T / 2 + 1, py + T / 2 + 1, T / 2 - 3, T / 2 - 3);
        ctx.fillRect(px + 2, py + T / 2 + 1, T / 2 - 3, T / 2 - 3);
      } else if (tile === TileType.Brick) {
        ctx.fillStyle = '#92400E';
        ctx.fillRect(px, py, T, T);
        ctx.strokeStyle = '#78350F';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 1, py + 1, T - 2, T - 2);
        // Crack lines
        ctx.beginPath();
        ctx.moveTo(px + T / 2, py);
        ctx.lineTo(px + T / 2, py + T);
        ctx.moveTo(px, py + T / 2);
        ctx.lineTo(px + T, py + T / 2);
        ctx.stroke();
      } else {
        // Empty floor
        ctx.fillStyle = '#0f1520';
        ctx.fillRect(px, py, T, T);
        // Subtle grid
        ctx.strokeStyle = '#151d2e';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(px, py, T, T);
      }
    }
  }

  // Power-ups
  for (const pu of state.powerUps) {
    const px = pu.pos.x * T + T / 2;
    const py = pu.pos.y * T + T / 2;
    const r = T * 0.3;

    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fillStyle =
      pu.type === 'range' ? '#EF4444' : pu.type === 'bomb' ? '#3B82F6' : '#22C55E';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Icon letter
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pu.type === 'range' ? 'R' : pu.type === 'bomb' ? 'B' : 'S', px, py);
  }

  // Explosions — use serverNow baseline instead of Date.now() to avoid clock skew
  for (const exp of state.explosions) {
    for (const cell of exp.cells) {
      const px = cell.x * T;
      const py = cell.y * T;
      const age = (serverNow - exp.startedAt) / exp.durationMs;
      const alpha = Math.max(0, 1 - age);
      ctx.fillStyle = `rgba(255, 160, 0, ${alpha * 0.8})`;
      ctx.fillRect(px + 2, py + 2, T - 4, T - 4);
      ctx.fillStyle = `rgba(255, 255, 100, ${alpha * 0.5})`;
      ctx.fillRect(px + 8, py + 8, T - 16, T - 16);
    }
  }

  // Bombs — use serverNow baseline
  for (const bomb of state.bombs) {
    const px = bomb.pos.x * T + T / 2;
    const py = bomb.pos.y * T + T / 2;
    const r = T * 0.3;
    const fuse = (serverNow - bomb.plantedAt) / bomb.fuseMs;
    const pulse = 1 + Math.sin(fuse * Math.PI * 8) * 0.15;

    ctx.beginPath();
    ctx.arc(px, py, r * pulse, 0, Math.PI * 2);
    ctx.fillStyle = '#1F2937';
    ctx.fill();
    ctx.strokeStyle = fuse > 0.7 ? '#EF4444' : '#6B7280';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Fuse spark
    ctx.fillStyle = '#FCD34D';
    ctx.beginPath();
    ctx.arc(px, py - r * pulse - 3, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Players
  for (const player of state.players) {
    if (!player.alive) continue;
    const px = player.pos.x * T + T / 2;
    const py = player.pos.y * T + T / 2;
    const r = T * 0.35;
    const isMe = player.id === myId;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(px, py + r + 2, r * 0.8, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = PLAYER_COLOR_HEX[player.color];
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();

    // Outline for self
    if (isMe) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // Eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(px - 5, py - 3, 4, 0, Math.PI * 2);
    ctx.arc(px + 5, py - 3, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(px - 4, py - 2, 2, 0, Math.PI * 2);
    ctx.arc(px + 6, py - 2, 2, 0, Math.PI * 2);
    ctx.fill();

    // Name tag
    ctx.fillStyle = isMe ? '#00ff41' : '#aaa';
    ctx.font = `bold 9px "Press Start 2P", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(player.name, px, py - r - 4);
  }

  // Countdown overlay
  if (state.phase === 'countdown' && state.countdown > 0) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#00ff41';
    ctx.font = `bold 64px "Press Start 2P", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(state.countdown), CANVAS_W / 2, CANVAS_H / 2);
  }

  // Round end overlay
  if (state.phase === 'roundEnd') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#00ff41';
    ctx.font = `bold 24px "Press Start 2P", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ROUND OVER', CANVAS_W / 2, CANVAS_H / 2 - 20);
    ctx.font = `14px "Press Start 2P", monospace`;
    ctx.fillStyle = '#aaa';
    ctx.fillText(`Next round starting...`, CANVAS_W / 2, CANVAS_H / 2 + 20);
  }
}
