import { useEffect, useRef } from 'react';
import {
  type BrosRect,
  type FinlayBrosState,
  BROS_PLAYER_HEIGHT,
  BROS_PLAYER_WIDTH,
  BROS_VIEW_HEIGHT,
  BROS_VIEW_WIDTH,
  PLAYER_COLOR_HEX,
} from '@finlay-games/shared';

interface BrosCanvasProps {
  state: FinlayBrosState;
  myId: string | null;
}

export function BrosCanvas({ state, myId }: BrosCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = BROS_VIEW_WIDTH * dpr;
    canvas.height = BROS_VIEW_HEIGHT * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    draw(ctx, state, myId);
  }, [state, myId]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', maxWidth: BROS_VIEW_WIDTH, aspectRatio: `${BROS_VIEW_WIDTH} / ${BROS_VIEW_HEIGHT}` }}
      className="border border-retro-border bg-retro-bg"
    />
  );
}

function draw(ctx: CanvasRenderingContext2D, state: FinlayBrosState, myId: string | null) {
  ctx.clearRect(0, 0, BROS_VIEW_WIDTH, BROS_VIEW_HEIGHT);

  const gradient = ctx.createLinearGradient(0, 0, 0, BROS_VIEW_HEIGHT);
  gradient.addColorStop(0, '#12213d');
  gradient.addColorStop(0.6, '#20365f');
  gradient.addColorStop(1, '#284a43');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, BROS_VIEW_WIDTH, BROS_VIEW_HEIGHT);

  drawBackdrop(ctx, state.camera.x);

  ctx.save();
  ctx.translate(-state.camera.x, -state.camera.y);

  for (const platform of state.level.platforms) {
    ctx.fillStyle = platform.y > 520 ? '#5c432c' : '#7c5a38';
    ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
    ctx.fillStyle = '#8a6b45';
    ctx.fillRect(platform.x, platform.y, platform.width, 10);
  }

  for (const hazard of state.level.hazards) {
    drawSpikes(ctx, hazard);
  }

  for (const checkpoint of state.level.checkpoints) {
    const unlocked = checkpoint.id <= state.teamCheckpoint;
    ctx.fillStyle = unlocked ? '#00ff41' : '#9ca3af';
    ctx.fillRect(checkpoint.x, checkpoint.y, 4, checkpoint.height);
    ctx.fillStyle = unlocked ? '#8bffb2' : '#d1d5db';
    ctx.beginPath();
    ctx.moveTo(checkpoint.x + 4, checkpoint.y + 4);
    ctx.lineTo(checkpoint.x + 24, checkpoint.y + 14);
    ctx.lineTo(checkpoint.x + 4, checkpoint.y + 24);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = '#f8e16c';
  ctx.fillRect(state.level.goal.x, state.level.goal.y, 4, state.level.goal.height);
  ctx.fillStyle = '#ff4d6d';
  ctx.beginPath();
  ctx.moveTo(state.level.goal.x + 4, state.level.goal.y + 4);
  ctx.lineTo(state.level.goal.x + 28, state.level.goal.y + 16);
  ctx.lineTo(state.level.goal.x + 4, state.level.goal.y + 28);
  ctx.closePath();
  ctx.fill();

  for (const player of state.players) {
    if (player.respawning) {
      ctx.globalAlpha = 0.35;
    } else if (!player.active) {
      ctx.globalAlpha = 0.45;
    } else {
      ctx.globalAlpha = 1;
    }

    const isMe = player.id === myId;
    const color = PLAYER_COLOR_HEX[player.color];

    ctx.fillStyle = color;
    ctx.fillRect(player.pos.x, player.pos.y, BROS_PLAYER_WIDTH, BROS_PLAYER_HEIGHT);
    ctx.fillStyle = '#fff';
    ctx.fillRect(
      player.facing === 'right' ? player.pos.x + 14 : player.pos.x + 6,
      player.pos.y + 8,
      6,
      6,
    );

    if (isMe) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.strokeRect(player.pos.x - 2, player.pos.y - 2, BROS_PLAYER_WIDTH + 4, BROS_PLAYER_HEIGHT + 4);
    }

    ctx.fillStyle = isMe ? '#00ff41' : '#e5e7eb';
    ctx.font = `bold 10px "Press Start 2P", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(player.name, player.pos.x + BROS_PLAYER_WIDTH / 2, player.pos.y - 6);
    ctx.globalAlpha = 1;
  }

  ctx.restore();

  if (state.phase === 'countdown' && state.countdown > 0) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, 0, BROS_VIEW_WIDTH, BROS_VIEW_HEIGHT);
    ctx.fillStyle = '#00ff41';
    ctx.font = `bold 68px "Press Start 2P", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(state.countdown), BROS_VIEW_WIDTH / 2, BROS_VIEW_HEIGHT / 2 - 20);
    ctx.font = `bold 18px "Press Start 2P", monospace`;
    ctx.fillText('TEAM UP AND MOVE RIGHT', BROS_VIEW_WIDTH / 2, BROS_VIEW_HEIGHT / 2 + 46);
  }
}

function drawBackdrop(ctx: CanvasRenderingContext2D, cameraX: number) {
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  for (let i = 0; i < 5; i++) {
    const width = 220 + i * 35;
    const x = ((i * 260) - cameraX * 0.15) % (BROS_VIEW_WIDTH + 260) - 180;
    const y = 110 + i * 28;
    ctx.fillRect(x, y, width, 22);
  }

  ctx.fillStyle = '#17324b';
  for (let i = 0; i < 8; i++) {
    const x = ((i * 180) - cameraX * 0.3) % (BROS_VIEW_WIDTH + 180) - 140;
    ctx.fillRect(x, 360 - (i % 3) * 40, 120, 220);
  }
}

function drawSpikes(ctx: CanvasRenderingContext2D, rect: BrosRect) {
  const spikeWidth = 18;
  ctx.fillStyle = '#d9465f';
  for (let x = rect.x; x < rect.x + rect.width; x += spikeWidth) {
    ctx.beginPath();
    ctx.moveTo(x, rect.y + rect.height);
    ctx.lineTo(x + spikeWidth / 2, rect.y);
    ctx.lineTo(x + spikeWidth, rect.y + rect.height);
    ctx.closePath();
    ctx.fill();
  }
}
