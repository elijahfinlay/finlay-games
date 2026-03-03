import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { type PlayerColor, validatePlayerName, MAX_NAME_LENGTH } from '@finlay-games/shared';
import { PageContainer } from '../components/layout/PageContainer';
import { Header } from '../components/layout/Header';
import { RetroCard } from '../components/common/RetroCard';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { ColorPicker } from '../components/game/ColorPicker';
import { Spinner } from '../components/common/Spinner';
import { connectSocket, getSocket, saveSession } from '../socket/socketManager';
import { useGameStore } from '../stores/gameStore';

export function CreateRoom() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [color, setColor] = useState<PlayerColor>('red');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'Create Room - Finlay Games';
  }, []);

  const handleCreate = () => {
    const nameError = validatePlayerName(name);
    if (nameError) {
      setError(nameError);
      return;
    }

    setLoading(true);
    setError('');
    connectSocket();

    getSocket().emit('room:create', { playerName: name.trim(), color }, (res) => {
      setLoading(false);
      if (res.ok) {
        useGameStore.getState().setRoom(res.room);
        useGameStore.getState().setPlayerId(res.playerId);
        saveSession(res.playerId, res.room.code);
        navigate(`/lobby/${res.room.code}`);
      } else {
        setError(res.error);
      }
    });
  };

  return (
    <PageContainer>
      <Header />
      <div className="w-full max-w-md">
        <h2 className="font-pixel text-lg text-retro-accent text-center mb-8">CREATE ROOM</h2>

        <RetroCard className="space-y-6">
          <Input
            label="Your Name"
            placeholder="Enter name..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={MAX_NAME_LENGTH}
            error={error}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />

          <ColorPicker selected={color} onChange={setColor} />

          <Button
            size="lg"
            className="w-full"
            onClick={handleCreate}
            disabled={loading || !name.trim()}
          >
            {loading ? <Spinner /> : 'CREATE'}
          </Button>
        </RetroCard>
      </div>
    </PageContainer>
  );
}
