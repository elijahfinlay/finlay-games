import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { BlastZoneState, FinlayKartState, MatchResult } from '@finlay-games/shared';
import { getSocket } from '../socket/socketManager';
import { useGameStore } from '../stores/gameStore';
import { GameCanvas } from '../components/game/blastzone/GameCanvas';
import { GameHUD } from '../components/game/blastzone/GameHUD';
import { GameOverScreen } from '../components/game/blastzone/GameOverScreen';
import { KartCanvas } from '../components/game/kart/KartCanvas';
import { KartHUD } from '../components/game/kart/KartHUD';
import { Spinner } from '../components/common/Spinner';

const INPUT_THROTTLE_MS = 66; // Match GAME_TICK_MS

type AnyGameState = BlastZoneState | FinlayKartState;

export function GamePage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const playerId = useGameStore((s) => s.playerId);
  const [gameState, setGameState] = useState<AnyGameState | null>(null);
  const [result, setResult] = useState<MatchResult | null>(null);
  const lastInputTime = useRef(0);

  useEffect(() => {
    document.title = `Playing - ${roomCode} - Finlay Games`;
  }, [roomCode]);

  // Listen for game state updates
  useEffect(() => {
    const socket = getSocket();

    const onState = (data: { state: AnyGameState }) => {
      setGameState(data.state);
    };
    const onOver = (data: { result: MatchResult }) => {
      setResult(data.result);
    };
    const onBackToLobby = () => {
      setGameState(null);
      setResult(null);
      navigate(`/lobby/${roomCode}`);
    };

    socket.on('game:state', onState);
    socket.on('game:over', onOver);
    socket.on('game:backToLobby', onBackToLobby);

    return () => {
      socket.off('game:state', onState);
      socket.off('game:over', onOver);
      socket.off('game:backToLobby', onBackToLobby);
    };
  }, [roomCode, navigate]);

  // Redirect if no game state after timeout
  useEffect(() => {
    if (gameState) return;

    const timer = setTimeout(() => {
      const currentPlayerId = useGameStore.getState().playerId;
      if (!currentPlayerId) {
        navigate('/');
      } else {
        navigate(`/lobby/${roomCode}`);
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [gameState, navigate, roomCode]);

  const isKart = gameState?.gameType === 'finlay-kart';

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
    } else {
      window.addEventListener('keydown', handleBlastZoneKeyDown);
      return () => window.removeEventListener('keydown', handleBlastZoneKeyDown);
    }
  }, [isKart, handleBlastZoneKeyDown, handleKartKeyDown, handleKartKeyUp]);

  if (!gameState) {
    return (
      <div className="min-h-screen bg-retro-bg flex flex-col items-center justify-center gap-4">
        <p className="font-pixel text-sm text-retro-accent">LOADING GAME</p>
        <Spinner />
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
