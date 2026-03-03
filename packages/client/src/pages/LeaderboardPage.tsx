import { useEffect, useState } from 'react';
import { PageContainer } from '../components/layout/PageContainer';
import { Header } from '../components/layout/Header';
import { RetroCard } from '../components/common/RetroCard';
import { Spinner } from '../components/common/Spinner';

interface LeaderboardEntry {
  id: string;
  name: string;
  games_played: number;
  games_won: number;
  win_rate: number;
}

const API_URL = import.meta.env.VITE_SERVER_URL || '';

export function LeaderboardPage() {
  const [players, setPlayers] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'Leaderboard - Finlay Games';
    fetch(`${API_URL}/api/leaderboard`)
      .then((r) => r.json())
      .then((data) => {
        setPlayers(data.players);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load leaderboard');
        setLoading(false);
      });
  }, []);

  return (
    <PageContainer>
      <Header />
      <h2 className="font-pixel text-lg text-retro-accent text-center mb-8">LEADERBOARD</h2>

      {loading ? (
        <Spinner />
      ) : error ? (
        <p className="font-pixel text-[10px] text-red-500">{error}</p>
      ) : players.length === 0 ? (
        <RetroCard className="text-center">
          <p className="font-pixel text-[10px] text-retro-muted">No games played yet</p>
          <p className="font-pixel text-[8px] text-retro-muted mt-2">
            Play a game to appear on the leaderboard!
          </p>
        </RetroCard>
      ) : (
        <div className="w-full max-w-lg space-y-2">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-2">
            <span className="font-pixel text-[7px] text-retro-muted w-8">#</span>
            <span className="font-pixel text-[7px] text-retro-muted flex-1">PLAYER</span>
            <span className="font-pixel text-[7px] text-retro-muted w-12 text-right">W</span>
            <span className="font-pixel text-[7px] text-retro-muted w-12 text-right">GP</span>
            <span className="font-pixel text-[7px] text-retro-muted w-14 text-right">WIN%</span>
          </div>

          {players.map((p, i) => (
            <RetroCard
              key={p.id}
              className={`flex items-center gap-3 !p-3 ${i === 0 ? 'border-retro-accent' : ''}`}
            >
              <span className="font-pixel text-[10px] text-retro-accent w-8">
                {i === 0 ? '1st' : i === 1 ? '2nd' : i === 2 ? '3rd' : `${i + 1}`}
              </span>
              <span className="font-pixel text-[9px] text-retro-text flex-1 truncate">
                {p.name}
              </span>
              <span className="font-pixel text-[9px] text-retro-accent w-12 text-right">
                {p.games_won}
              </span>
              <span className="font-pixel text-[9px] text-retro-muted w-12 text-right">
                {p.games_played}
              </span>
              <span className="font-pixel text-[9px] text-retro-muted w-14 text-right">
                {p.win_rate}%
              </span>
            </RetroCard>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
