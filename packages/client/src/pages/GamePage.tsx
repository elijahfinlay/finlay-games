import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { BlastZoneState, FinlayBrosState, FinlayKartState, MatchResult } from '@finlay-games/shared';
import { connectSocket, getSocket } from '../socket/socketManager';
import { useGameStore } from '../stores/gameStore';
import { GameCanvas } from '../components/game/blastzone/GameCanvas';
import { GameHUD } from '../components/game/blastzone/GameHUD';
import { GameOverScreen } from '../components/game/blastzone/GameOverScreen';
import { BrosCanvas } from '../components/game/bros/BrosCanvas';
import { BrosHUD } from '../components/game/bros/BrosHUD';
import { KartCanvas } from '../components/game/kart/KartCanvas';
import { KartHUD } from '../components/game/kart/KartHUD';
import { Button } from '../components/common/Button';
import { Spinner } from '../components/common/Spinner';

const INPUT_THROTTLE_MS = 66; // Match GAME_TICK_MS

type AnyGameState = BlastZoneState | FinlayKartState | FinlayBrosState;

export function GamePage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const room = useGameStore((s) => s.room);
  const playerId = useGameStore((s) => s.playerId);
  const gameState = useGameStore((s) => s.gameState) as AnyGameState | null;
  const [result, setResult] = useState<MatchResult | null>(null);
  const [showRecoveryOptions, setShowRecoveryOptions] = useState(false);
  const lastInputTime = useRef(0);

  useEffect(() => {
    document.title = `Playing - ${roomCode} - Finlay Games`;
  }, [roomCode]);

  useEffect(() => {
    connectSocket();
  }, []);

  // Listen for game over / return events
  useEffect(() => {
    const socket = getSocket();

    const onOver = (data: { result: MatchResult }) => {
      setResult(data.result);
    };
    const onBackToLobby = () => {
      setResult(null);
      navigate(`/lobby/${roomCode}`);
    };

    socket.on('game:over', onOver);
    socket.on('game:backToLobby', onBackToLobby);

    return () => {
      socket.off('game:over', onOver);
      socket.off('game:backToLobby', onBackToLobby);
    };
  }, [roomCode, navigate]);

  // If startup is slow or the user refreshed mid-game, keep them on the loading screen
  // and offer a manual escape hatch instead of bouncing them out automatically.
  useEffect(() => {
    if (gameState) {
      setShowRecoveryOptions(false);
      return;
    }

    const timer = setTimeout(() => {
      setShowRecoveryOptions(true);
    }, 5000);

    return () => clearTimeout(timer);
  }, [gameState]);

  const isKart = gameState?.gameType === 'finlay-kart';
  const isBros = gameState?.gameType === 'finlay-bros';

  // Blast Zone keyboard input (throttled)
  const handleBlastZoneKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const socket = getSocket();
      if (!socket.connected) return;

      const key = e.key.toLowerCase();

      const moveMap: Record<string, 'up' | 'down' | 'left' | 'right'> = {
        arrowup: 'up',
        arrowdown: 'down',
        arrowleft: 'left',
        arrowright: 'right',
        w: 'up',
        s: 'down',
        a: 'left',
        d: 'right',
      };

      if (moveMap[key]) {
        e.preventDefault();
        const now = Date.now();
        if (now - lastInputTime.current < INPUT_THROTTLE_MS) return;
        lastInputTime.current = now;
        socket.emit('game:input', { input: { type: 'move', direction: moveMap[key] } });
      } else if (key === ' ' || key === 'e') {
        e.preventDefault();
        socket.emit('game:input', { input: { type: 'bomb' } });
      }
    },
    [],
  );

  // Kart keyboard input (keydown throttled, keyup immediate)
  const handleKartKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const socket = getSocket();
      if (!socket.connected) return;

      const key = e.key.toLowerCase();
      const kartKeyMap: Record<string, 'up' | 'down' | 'left' | 'right'> = {
        arrowup: 'up',
        arrowdown: 'down',
        arrowleft: 'left',
        arrowright: 'right',
        w: 'up',
        s: 'down',
        a: 'left',
        d: 'right',
      };

      if (kartKeyMap[key]) {
        e.preventDefault();
        const now = Date.now();
        if (now - lastInputTime.current < INPUT_THROTTLE_MS) return;
        lastInputTime.current = now;
        socket.emit('game:input', { input: { type: 'kartKeyDown', key: kartKeyMap[key] } });
      }
    },
    [],
  );

  const handleKartKeyUp = useCallback(
    (e: KeyboardEvent) => {
      const socket = getSocket();
      if (!socket.connected) return;

      const key = e.key.toLowerCase();
      const kartKeyMap: Record<string, 'up' | 'down' | 'left' | 'right'> = {
        arrowup: 'up',
        arrowdown: 'down',
        arrowleft: 'left',
        arrowright: 'right',
        w: 'up',
        s: 'down',
        a: 'left',
        d: 'right',
      };

      if (kartKeyMap[key]) {
        e.preventDefault();
        // KeyUp is sent immediately (no throttle)
        socket.emit('game:input', { input: { type: 'kartKeyUp', key: kartKeyMap[key] } });
      }
    },
    [],
  );

  const handleBrosKeyDown = useCallback((e: KeyboardEvent) => {
    const socket = getSocket();
    if (!socket.connected || e.repeat) return;

    const key = e.key.toLowerCase();
    if (key === 'arrowleft' || key === 'a') {
      e.preventDefault();
      socket.emit('game:input', { input: { type: 'brosKeyDown', key: 'left' } });
    } else if (key === 'arrowright' || key === 'd') {
      e.preventDefault();
      socket.emit('game:input', { input: { type: 'brosKeyDown', key: 'right' } });
    } else if (key === 'arrowup' || key === 'w' || key === ' ') {
      e.preventDefault();
      socket.emit('game:input', { input: { type: 'brosJump' } });
    }
  }, []);

  const handleBrosKeyUp = useCallback((e: KeyboardEvent) => {
    const socket = getSocket();
    if (!socket.connected) return;

    const key = e.key.toLowerCase();
    if (key === 'arrowleft' || key === 'a') {
      e.preventDefault();
      socket.emit('game:input', { input: { type: 'brosKeyUp', key: 'left' } });
    } else if (key === 'arrowright' || key === 'd') {
      e.preventDefault();
      socket.emit('game:input', { input: { type: 'brosKeyUp', key: 'right' } });
    }
  }, []);

  // Attach keyboard handlers based on game type
  useEffect(() => {
    if (isKart) {
      const handleBlur = () => {
        const socket = getSocket();
        if (!socket.connected) return;
        const directions: ('up' | 'down' | 'left' | 'right')[] = ['up', 'down', 'left', 'right'];
        for (const key of directions) {
          socket.emit('game:input', { input: { type: 'kartKeyUp', key } });
        }
      };

      window.addEventListener('keydown', handleKartKeyDown);
      window.addEventListener('keyup', handleKartKeyUp);
      window.addEventListener('blur', handleBlur);
      return () => {
        window.removeEventListener('keydown', handleKartKeyDown);
        window.removeEventListener('keyup', handleKartKeyUp);
        window.removeEventListener('blur', handleBlur);
      };
    } else if (isBros) {
      const handleBlur = () => {
        const socket = getSocket();
        if (!socket.connected) return;
        socket.emit('game:input', { input: { type: 'brosKeyUp', key: 'left' } });
        socket.emit('game:input', { input: { type: 'brosKeyUp', key: 'right' } });
      };

      window.addEventListener('keydown', handleBrosKeyDown);
      window.addEventListener('keyup', handleBrosKeyUp);
      window.addEventListener('blur', handleBlur);
      return () => {
        window.removeEventListener('keydown', handleBrosKeyDown);
        window.removeEventListener('keyup', handleBrosKeyUp);
        window.removeEventListener('blur', handleBlur);
      };
    } else {
      window.addEventListener('keydown', handleBlastZoneKeyDown);
      return () => window.removeEventListener('keydown', handleBlastZoneKeyDown);
    }
  }, [isKart, isBros, handleBlastZoneKeyDown, handleBrosKeyDown, handleBrosKeyUp, handleKartKeyDown, handleKartKeyUp]);

  if (!gameState) {
    return (
      <div className="min-h-screen bg-retro-bg flex flex-col items-center justify-center gap-4 px-4">
        <p className="font-pixel text-sm text-retro-accent">LOADING GAME</p>
        <Spinner />
        {showRecoveryOptions && (
          <>
            <p className="max-w-md text-center font-pixel text-[8px] text-retro-muted">
              Waiting for the live game state. If the match is still starting, stay on this screen.
            </p>
            <Button
              variant="secondary"
              size="md"
              onClick={() => navigate(room ? `/lobby/${room.code}` : '/')}
            >
              {room ? 'RETURN TO LOBBY' : 'GO HOME'}
            </Button>
          </>
        )}
      </div>
    );
  }

  // Kart game rendering
  if (gameState.gameType === 'finlay-kart') {
    return (
      <div className="min-h-screen bg-retro-bg flex flex-col items-center justify-center gap-4 p-4">
        {result && <GameOverScreen result={result} myId={playerId} />}

        <KartHUD state={gameState} myId={playerId} />
        <KartCanvas state={gameState} myId={playerId} />

        <div className="flex gap-6 font-pixel text-[7px] text-retro-muted">
          <span>WASD / ARROWS = STEER & ACCELERATE</span>
          <span>DOWN / S = BRAKE</span>
        </div>
      </div>
    );
  }

  if (gameState.gameType === 'finlay-bros') {
    return (
      <div className="min-h-screen bg-retro-bg flex flex-col items-center justify-center gap-4 p-4">
        {result && <GameOverScreen result={result} myId={playerId} />}

        <BrosHUD state={gameState} myId={playerId} />
        <BrosCanvas state={gameState} myId={playerId} />

        <div className="flex gap-6 font-pixel text-[7px] text-retro-muted flex-wrap justify-center">
          <span>A / D OR ARROWS = MOVE</span>
          <span>W / UP / SPACE = JUMP</span>
        </div>
      </div>
    );
  }

  // Blast Zone rendering (default)
  return (
    <div className="min-h-screen bg-retro-bg flex flex-col items-center justify-center gap-4 p-4">
      {result && <GameOverScreen result={result} myId={playerId} />}

      <GameHUD state={gameState} myId={playerId} />
      <GameCanvas state={gameState} myId={playerId} />

      <div className="flex gap-6 font-pixel text-[7px] text-retro-muted">
        <span>WASD / ARROWS = MOVE</span>
        <span>SPACE / E = BOMB</span>
      </div>
    </div>
  );
}
