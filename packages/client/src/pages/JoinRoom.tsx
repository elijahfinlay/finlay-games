import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { type PlayerColor, validatePlayerName, MAX_NAME_LENGTH, isValidRoomCode } from '@finlay-games/shared';
import { PageContainer } from '../components/layout/PageContainer';
import { Header } from '../components/layout/Header';
import { RetroCard } from '../components/common/RetroCard';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { ColorPicker } from '../components/game/ColorPicker';
import { Spinner } from '../components/common/Spinner';
import { connectSocket, getSocket, saveSession } from '../socket/socketManager';
import { useGameStore } from '../stores/gameStore';

export function JoinRoom() {
  const navigate = useNavigate();
  const { code: urlCode } = useParams();
  const [roomCode, setRoomCode] = useState(urlCode?.toUpperCase() ?? '');
  const [name, setName] = useState('');
  const [color, setColor] = useState<PlayerColor>('blue');
  const [takenColors, setTakenColors] = useState<string[]>([]);
  const [peeked, setPeeked] = useState(false);
  const [peekInfo, setPeekInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'Join Room - Finlay Games';
  }, []);

  // Auto-peek when we have a valid code from URL
  useEffect(() => {
    if (urlCode && isValidRoomCode(urlCode.toUpperCase())) {
      handlePeek(urlCode.toUpperCase());
    }
  }, [urlCode]);

  const handleCodeChange = (val: string) => {
    const upper = val.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
    setRoomCode(upper);
    setPeeked(false);
    setTakenColors([]);
    setPeekInfo('');
    setError('');
  };

  const handlePeek = (code?: string) => {
    const c = code ?? roomCode;
    if (!isValidRoomCode(c)) {
      setError('Enter a 4-letter room code');
      return;
    }
    connectSocket();
    getSocket().emit('room:peek', { roomCode: c }, (res) => {
      if (res.ok) {
        setTakenColors(res.room.takenColors);
        setPeeked(true);
        setPeekInfo(`${res.room.playerCount}/8 players`);
        setError('');
        // Auto-select first available color
        if (res.room.takenColors.includes(color)) {
          const available = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'cyan'] as PlayerColor[];
          const first = available.find((c) => !res.room.takenColors.includes(c));
          if (first) setColor(first);
        }
      } else {
        setError(res.error);
        setPeeked(false);
      }
    });
  };

  const handleJoin = () => {
    const nameError = validatePlayerName(name);
    if (nameError) {
      setError(nameError);
      return;
    }

    setLoading(true);
    setError('');
    connectSocket();

    getSocket().emit('room:join', { roomCode, playerName: name.trim(), color }, (res) => {
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
        <h2 className="font-pixel text-lg text-retro-accent text-center mb-8">JOIN ROOM</h2>

        <RetroCard className="space-y-6">
          {/* Room Code */}
          <div>
            <Input
              label="Room Code"
              placeholder="ABCD"
              value={roomCode}
              onChange={(e) => handleCodeChange(e.target.value)}
              maxLength={4}
              className="text-center tracking-[0.5em] text-lg uppercase"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (!peeked) handlePeek();
                  else handleJoin();
                }
              }}
            />
            {!peeked && roomCode.length === 4 && (
              <Button
                variant="secondary"
                size="sm"
                className="w-full mt-2"
                onClick={() => handlePeek()}
              >
                LOOK UP ROOM
              </Button>
            )}
            {peekInfo && (
              <p className="font-pixel text-[8px] text-retro-accent mt-2 text-center">{peekInfo}</p>
            )}
          </div>

          {/* Name + Color (shown after peek) */}
          {peeked && (
            <>
              <Input
                label="Your Name"
                placeholder="Enter name..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={MAX_NAME_LENGTH}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              />

              <ColorPicker selected={color} takenColors={takenColors} onChange={setColor} />

              <Button
                size="lg"
                className="w-full"
                onClick={handleJoin}
                disabled={loading || !name.trim()}
              >
                {loading ? <Spinner /> : 'JOIN'}
              </Button>
            </>
          )}

          {error && <p className="font-pixel text-[8px] text-red-500 text-center">{error}</p>}
        </RetroCard>
      </div>
    </PageContainer>
  );
}
