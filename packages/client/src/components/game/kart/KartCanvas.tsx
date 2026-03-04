import { useRef, useEffect } from 'react';
import {
  type FinlayKartState,
  KartTile,
  KART_TILE_SIZE,
  KART_GRID_COLS,
  KART_GRID_ROWS,
  KART_CHECKPOINTS,
  PLAYER_COLOR_HEX,
} from '@finlay-games/shared';

interface KartCanvasProps {
  state: FinlayKartState;
  myId: string | null;
}

const CANVAS_W = KART_GRID_COLS * KART_TILE_SIZE;
const CANVAS_H = KART_GRID_ROWS * KART_TILE_SIZE;

// Cache the track image so we only redraw tiles when track data changes
let cachedTrack: ImageBitmap | null = null;
let cachedTrackKey = '';

export function KartCanvas({ state, myId }: KartCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trackCacheRef = useRef<HTMLCanvasElement | null>(null);

  // Create track cache canvas once
  useEffect(() => {
    if (!trackCacheRef.current) {
      trackCacheRef.current = document.createElement('canvas');
      trackCacheRef.current.width = CANVAS_W;
      trackCacheRef.current.height = CANVAS_H;
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;
    ctx.scale(dpr, dpr);

    // Render track to cache if needed
    const trackKey = state.track ? 'loaded' : '';
    if (trackCacheRef.current && trackKey && trackKey !== cachedTrackKey) {
      const tctx = trackCacheRef.current.getContext('2d');
      if (tctx) {
        drawTrack(tctx, state.track);
        cachedTrackKey = trackKey;
      }
    }

    draw(ctx, state, myId, trackCacheRef.current);
  }, [state, myId]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: CANVAS_W, height: CANVAS_H }}
      className="border border-retro-border"
    />
  );
}

function drawTrack(ctx: CanvasRenderingContext2D, track: KartTile[][]) {
  const T = KART_TILE_SIZE;

  for (let y = 0; y < KART_GRID_ROWS; y++) {
    for (let x = 0; x < KART_GRID_COLS; x++) {
      const tile = track[y]?.[x] ?? KartTile.Grass;
      const px = x * T;
      const py = y * T;

      switch (tile) {
        case KartTile.Road:
          ctx.fillStyle = '#3a3a4a';
          ctx.fillRect(px, py, T, T);
          // Subtle road texture
          ctx.strokeStyle = '#2e2e3e';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(px, py, T, T);
          break;

        case KartTile.Grass:
          ctx.fillStyle = '#2d5a1e';
          ctx.fillRect(px, py, T, T);
          // Grass texture dots
          ctx.fillStyle = '#347a22';
          if ((x + y) % 3 === 0) {
            ctx.fillRect(px + 3, py + 3, 2, 2);
            ctx.fillRect(px + 10, py + 8, 2, 2);
          }
          break;

        case KartTile.Wall:
          ctx.fillStyle = '#555566';
          ctx.fillRect(px, py, T, T);
          ctx.fillStyle = '#666677';
          ctx.fillRect(px + 1, py + 1, T - 2, T / 2 - 1);
          ctx.strokeStyle = '#444455';
          ctx.lineWidth = 1;
          ctx.strokeRect(px, py, T, T);
          break;

        case KartTile.Boost:
          ctx.fillStyle = '#3a3a4a';
          ctx.fillRect(px, py, T, T);
          // Boost chevrons
          ctx.fillStyle = '#ffaa00';
          ctx.beginPath();
          ctx.moveTo(px + 4, py + T);
          ctx.lineTo(px + T / 2, py + 2);
          ctx.lineTo(px + T - 4, py + T);
          ctx.closePath();
          ctx.fill();
          break;
      }
    }
  }

  // Draw start/finish line
  const cp0 = KART_CHECKPOINTS[0];
  const lineX = cp0.x + cp0.width / 2;
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 8; i++) {
    const checkered = i % 2 === 0;
    ctx.fillStyle = checkered ? '#fff' : '#111';
    ctx.fillRect(lineX - 2, cp0.y + i * (cp0.height / 8), 4, cp0.height / 8);
  }
}

function draw(
  ctx: CanvasRenderingContext2D,
  state: FinlayKartState,
  myId: string | null,
  trackCache: HTMLCanvasElement | null,
) {
  // Background
  ctx.fillStyle = '#1a2a1a';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Draw cached track
  if (trackCache) {
    ctx.drawImage(trackCache, 0, 0);
  }

  // Draw karts
  for (const player of state.players) {
    const px = player.pos.x;
    const py = player.pos.y;
    const isMe = player.id === myId;
    const color = PLAYER_COLOR_HEX[player.color];

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(player.angle);

    // Kart body (12x8 rectangle)
    const w = 12;
    const h = 8;
    ctx.fillStyle = color;
    ctx.fillRect(-w / 2, -h / 2, w, h);

    // Front indicator (triangle pointing forward)
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2 - 3, -3);
    ctx.lineTo(w / 2 - 3, 3);
    ctx.closePath();
    ctx.fill();

    // Outline for self
    if (isMe) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-w / 2, -h / 2, w, h);
    }

    ctx.restore();

    // Name tag above kart
    ctx.fillStyle = isMe ? '#00ff41' : '#ccc';
    ctx.font = `bold 7px "Press Start 2P", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(player.name, px, py - 10);

    // Bot indicator
    if (player.isBot) {
      ctx.fillStyle = '#888';
      ctx.font = '5px monospace';
      ctx.fillText('CPU', px, py - 18);
    }

    // Finished indicator
    if (player.finished && player.finishTime !== null) {
      ctx.fillStyle = '#ffcc00';
      ctx.font = `bold 6px "Press Start 2P", monospace`;
      ctx.fillText('DONE', px, py + 16);
    }
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
    ctx.font = `bold 14px "Press Start 2P", monospace`;
    ctx.fillText('GET READY!', CANVAS_W / 2, CANVAS_H / 2 + 50);
  }

  // Race start flash
  if (state.phase === 'racing' && state.elapsedMs < 1000) {
    const alpha = 1 - state.elapsedMs / 1000;
    ctx.fillStyle = `rgba(0, 255, 65, ${alpha * 0.3})`;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = `rgba(0, 255, 65, ${alpha})`;
    ctx.font = `bold 32px "Press Start 2P", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('GO!', CANVAS_W / 2, CANVAS_H / 2);
  }
}
