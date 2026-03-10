import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import type { BlastZoneState, FinlayBrosState, FinlayKartState, MatchResult, Room } from '@finlay-games/shared';
import { GAME_INFO } from '@finlay-games/shared';
import { connectSocket, getSocket } from '../socket/socketManager';
import { PlayerGrid } from '../components/game/PlayerGrid';
import { RoomCodeDisplay } from '../components/game/RoomCodeDisplay';
import { Spinner } from '../components/common/Spinner';
import { GameHUD } from '../components/game/blastzone/GameHUD';
import { GameCanvas } from '../components/game/blastzone/GameCanvas';
import { KartHUD } from '../components/game/kart/KartHUD';
import { KartCanvas } from '../components/game/kart/KartCanvas';
import { BrosHUD } from '../components/game/bros/BrosHUD';
import { BrosCanvas } from '../components/game/bros/BrosCanvas';
import { GameOverScreen } from '../components/game/blastzone/GameOverScreen';

type AnyGameState = BlastZoneState | FinlayKartState | FinlayBrosState;

export function TvDisplayPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const [room, setRoom] = useState<Room | null>(null);
  const [gameState, setGameState] = useState<AnyGameState | null>(null);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [error, setError] = useState('');
  const cursorRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    document.title = `TV - ${roomCode} - Finlay Games`;
  }, [roomCode]);

  // Hide cursor after idle
  useEffect(() => {
    const hide = () => {
      document.body.style.cursor = 'none';
    };
    const show = () => {
      document.body.style.cursor = '';
      clearTimeout(cursorRef.current);
      cursorRef.current = setTimeout(hide, 3000);
    };
    document.addEventListener('mousemove', show);
    cursorRef.current = setTimeout(hide, 3000);
    return () => {
      document.removeEventListener('mousemove', show);
      clearTimeout(cursorRef.current);
      document.body.style.cursor = '';
    };
  }, []);

  // Join as spectator
  useEffect(() => {
    if (!roomCode) return;
    connectSocket();
    const socket = getSocket();

    const join = () => {
      socket.emit('tv:join', { roomCode }, (res) => {
        if (res.ok) {
          setRoom(res.room);
          setGameState(res.gameState ?? null);
        } else {
          setError(res.error);
        }
      });
    };

    if (socket.connected) {
      join();
    } else {
      socket.on('connect', join);
    }

    // Listen for updates
    socket.on('room:playerJoined', ({ player }) => {
      setRoom((prev) => prev ? { ...prev, players: [...prev.players, player] } : prev);
    });
    socket.on('room:playerLeft', ({ playerId }) => {
      setRoom((prev) => prev ? { ...prev, players: prev.players.filter((p) => p.id !== playerId) } : prev);
    });
    socket.on('room:playerDisconnected', ({ playerId }) => {
      setRoom((prev) => prev ? {
        ...prev,
        players: prev.players.map((p) => p.id === playerId ? { ...p, connected: false } : p),
      } : prev);
    });
    socket.on('room:playerReconnected', ({ playerId }) => {
      setRoom((prev) => prev ? {
        ...prev,
        players: prev.players.map((p) => p.id === playerId ? { ...p, connected: true } : p),
      } : prev);
    });
    socket.on('room:hostChanged', ({ newHostId }) => {
      setRoom((prev) => prev ? {
        ...prev,
        hostId: newHostId,
        players: prev.players.map((p) => ({ ...p, isHost: p.id === newHostId })),
      } : prev);
    });
    socket.on('lobby:gameStarting', () => {
      setRoom((prev) => (prev ? { ...prev, state: 'playing' } : prev));
      setResult(null);
    });
    socket.on('lobby:settingsUpdated', ({ settings }) => {
      setRoom((prev) => prev ? { ...prev, settings } : prev);
    });
    socket.on('lobby:colorChanged', ({ playerId, color }) => {
      setRoom((prev) => prev ? {
        ...prev,
        players: prev.players.map((p) => p.id === playerId ? { ...p, color } : p),
      } : prev);
    });
    socket.on('room:closed', () => {
      setRoom(null);
      setGameState(null);
      setResult(null);
      setError('Room closed');
    });
    socket.on('game:state', ({ state }) => {
      setGameState(state);
      setRoom((prev) => (prev ? { ...prev, state: 'playing' } : prev));
    });
    socket.on('game:over', ({ result: nextResult }) => {
      setResult(nextResult);
    });
    socket.on('game:backToLobby', () => {
      setGameState(null);
      setResult(null);
      setRoom((prev) => (prev ? { ...prev, state: 'lobby' } : prev));
    });

    return () => {
      socket.off('connect', join);
      socket.off('room:playerJoined');
      socket.off('room:playerLeft');
      socket.off('room:playerDisconnected');
      socket.off('room:playerReconnected');
      socket.off('room:hostChanged');
      socket.off('lobby:gameStarting');
      socket.off('lobby:settingsUpdated');
      socket.off('lobby:colorChanged');
      socket.off('room:closed');
      socket.off('game:state');
      socket.off('game:over');
      socket.off('game:backToLobby');
    };
  }, [roomCode]);

  if (error) {
    return (
      <div className="min-h-screen bg-retro-bg flex items-center justify-center">
        <p className="font-pixel text-sm text-red-500">{error}</p>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-retro-bg flex items-center justify-center flex-col gap-4">
        <p className="font-pixel text-sm text-retro-muted">CONNECTING TO ROOM</p>
        <Spinner />
      </div>
    );
  }

  const gameInfo = GAME_INFO[room.settings.gameType];

  if (gameState) {
    return (
      <div className="min-h-screen bg-retro-bg flex flex-col items-center justify-center gap-4 p-4">
        {result && <GameOverScreen result={result} myId={null} />}

        <h1 className="font-pixel text-lg text-retro-accent">FINLAY GAMES TV</h1>
        <RoomCodeDisplay code={room.code} />

        {gameState.gameType === 'finlay-kart' ? (
          <>
            <KartHUD state={gameState} myId={null} />
            <KartCanvas state={gameState} myId={null} />
          </>
        ) : gameState.gameType === 'finlay-bros' ? (
          <>
            <BrosHUD state={gameState} myId={null} />
            <BrosCanvas state={gameState} myId={null} />
          </>
        ) : (
          <>
            <GameHUD state={gameState} myId={null} />
            <GameCanvas state={gameState} myId={null} />
          </>
        )}
      </div>
    );
  }

  if (room.state === 'playing') {
    return (
      <div className="min-h-screen bg-retro-bg flex items-center justify-center flex-col gap-4">
        <p className="font-pixel text-sm text-retro-muted">LOADING LIVE GAME FEED</p>
        <Spinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-retro-bg flex flex-col items-center justify-center gap-8 p-8">
      {/* Title */}
      <h1 className="font-pixel text-lg text-retro-accent">FINLAY GAMES</h1>

      {/* Room Code - Large */}
      <RoomCodeDisplay code={room.code} size="lg" />

      {/* Player Grid */}
      <div className="w-full max-w-3xl">
        <PlayerGrid players={room.players} />
      </div>

      {/* Settings Display */}
      <div className="flex gap-6 font-pixel text-[8px] text-retro-muted">
        <span>GAME: {gameInfo.name}</span>
        <span>TIME: {room.settings.roundTime}s</span>
        {room.settings.gameType === 'finlay-kart' ? (
          <span>LAPS: {room.settings.rounds}</span>
        ) : room.settings.gameType === 'finlay-bros' ? (
          <span>MODE: CO-OP RUN</span>
        ) : (
          <>
            <span>ROUNDS: {room.settings.rounds}</span>
            <span>POWER-UPS: {room.settings.powerUps ? 'ON' : 'OFF'}</span>
          </>
        )}
      </div>

      {/* Join prompt */}
      <p className="font-pixel text-[8px] text-retro-muted">
        Join at <span className="text-retro-accent">{window.location.origin}/join/{room.code}</span>
      </p>
    </div>
  );
}
