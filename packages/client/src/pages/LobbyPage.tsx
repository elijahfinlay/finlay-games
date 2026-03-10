import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { GameType } from '@finlay-games/shared';
import { useGameStore } from '../stores/gameStore';
import { getSocket } from '../socket/socketManager';
import { PageContainer } from '../components/layout/PageContainer';
import { PlayerGrid } from '../components/game/PlayerGrid';
import { RoomCodeDisplay } from '../components/game/RoomCodeDisplay';
import { HostSettingsPanel } from '../components/game/HostSettingsPanel';
import { ColorPicker } from '../components/game/ColorPicker';
import { Button } from '../components/common/Button';
import { ReconnectingOverlay } from '../components/connection/ReconnectingOverlay';
import { RetroCard } from '../components/common/RetroCard';

export function LobbyPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const room = useGameStore((s) => s.room);
  const playerId = useGameStore((s) => s.playerId);
  const [shareMsg, setShareMsg] = useState('');

  useEffect(() => {
    document.title = room ? `Lobby ${room.code} - Finlay Games` : 'Lobby - Finlay Games';
  }, [room]);

  // If no room state, redirect to home
  useEffect(() => {
    if (!room && !playerId) {
      navigate('/');
    }
  }, [room, playerId, navigate]);

  // Navigate to game when it starts
  useEffect(() => {
    const socket = getSocket();
    const onGameStarting = () => {
      navigate(`/game/${roomCode}`);
    };
    socket.on('lobby:gameStarting', onGameStarting);
    return () => {
      socket.off('lobby:gameStarting', onGameStarting);
    };
  }, [navigate, roomCode]);

  if (!room) return null;

  const me = room.players.find((p) => p.id === playerId);
  const isHost = room.hostId === playerId;
  const connectedCount = room.players.filter((p) => p.connected).length;
  const isKart = room.settings.gameType === GameType.FinlayKart;
  const minPlayers = room.settings.gameType === GameType.BlastZone ? 2 : 1;
  const canStart = isHost && connectedCount >= minPlayers;
  const takenColors = room.players.filter((p) => p.connected && p.id !== playerId).map((p) => p.color);

  const handleColorChange = (color: string) => {
    getSocket().emit('lobby:changeColor', { color: color as any }, (res) => {
      if (!res.ok) console.error(res.error);
    });
  };

  const handleStartGame = () => {
    getSocket().emit('lobby:startGame', (res) => {
      if (!res.ok) console.error(res.error);
    });
  };

  const handleLeave = () => {
    getSocket().emit('room:leave');
    useGameStore.getState().reset();
    sessionStorage.removeItem('fg_playerId');
    sessionStorage.removeItem('fg_roomCode');
    navigate('/');
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/join/${room.code}`;
    await navigator.clipboard.writeText(url);
    setShareMsg('Link copied!');
    setTimeout(() => setShareMsg(''), 2000);
  };

  return (
    <PageContainer className="gap-6">
      <ReconnectingOverlay />

      {/* Room Code */}
      <RoomCodeDisplay code={room.code} />

      {/* Player Grid */}
      <div className="w-full max-w-2xl">
        <PlayerGrid players={room.players} />
      </div>

      {/* My Color */}
      {me && (
        <RetroCard className="w-full max-w-2xl">
          <ColorPicker
            selected={me.color}
            takenColors={takenColors}
            onChange={handleColorChange}
          />
        </RetroCard>
      )}

      {/* Settings */}
      <div className="w-full max-w-2xl">
        <HostSettingsPanel settings={room.settings} isHost={isHost} />
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-2xl">
        {isHost && (
          <Button
            size="lg"
            className="flex-1"
            disabled={!canStart}
            onClick={handleStartGame}
          >
            {canStart ? 'START GAME' : `NEED ${minPlayers - connectedCount} MORE`}
          </Button>
        )}
        <Button variant="secondary" size="md" onClick={handleShare} className="flex-1">
          {shareMsg || 'SHARE LINK'}
        </Button>
        <Button variant="danger" size="md" onClick={handleLeave}>
          LEAVE
        </Button>
      </div>
    </PageContainer>
  );
}
