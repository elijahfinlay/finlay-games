import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { BlastZoneState, MatchResult } from '@finlay-games/shared';
import { getSocket } from '../socket/socketManager';
import { useGameStore } from '../stores/gameStore';
import { GameCanvas } from '../components/game/blastzone/GameCanvas';
import { GameHUD } from '../components/game/blastzone/GameHUD';
import { GameOverScreen } from '../components/game/blastzone/GameOverScreen';
import { Spinner } from '../components/common/Spinner';

export function GamePage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const playerId = useGameStore((s) => s.playerId);
  const [gameState, setGameState] = useState<BlastZoneState | null>(null);
  const [result, setResult] = useState<MatchResult | null>(null);

  useEffect(() => {
    document.title = `Playing - ${roomCode} - Finlay Games`;
  }, [roomCode]);

  // Listen for game state updates
  useEffect(() => {
    const socket = getSocket();

    const onState = (data: { state: BlastZoneState }) => {
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

  // Keyboard input
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const socket = getSocket();
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
        socket.emit('game:input', { input: { type: 'move', direction: moveMap[key] } });
      } else if (key === ' ' || key === 'e') {
        e.preventDefault();
        socket.emit('game:input', { input: { type: 'bomb' } });
      }
    },
    [],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!gameState) {
    return (
      <div className="min-h-screen bg-retro-bg flex flex-col items-center justify-center gap-4">
        <p className="font-pixel text-sm text-retro-accent">LOADING GAME</p>
        <Spinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-retro-bg flex flex-col items-center justify-center gap-4 p-4">
      {result && <GameOverScreen result={result} myId={playerId} />}

      <GameHUD state={gameState} myId={playerId} />
      <GameCanvas state={gameState} myId={playerId} />

      {/* Controls hint */}
      <div className="flex gap-6 font-pixel text-[7px] text-retro-muted">
        <span>WASD / ARROWS = MOVE</span>
        <span>SPACE / E = BOMB</span>
      </div>
    </div>
  );
}
