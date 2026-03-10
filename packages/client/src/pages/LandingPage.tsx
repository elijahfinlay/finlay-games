import { Link } from 'react-router-dom';
import { GAME_INFO, GameType } from '@finlay-games/shared';
import { PageContainer } from '../components/layout/PageContainer';
import { RetroCard } from '../components/common/RetroCard';
import { Button } from '../components/common/Button';
import { useEffect, useState } from 'react';

const gameIcons: Record<GameType, string> = {
  [GameType.BlastZone]: '💣',
  [GameType.FinlayKart]: '🏎️',
  [GameType.FinlayBros]: '🎮',
};

export function LandingPage() {
  const [selectedGame, setSelectedGame] = useState<GameType>(GameType.BlastZone);

  useEffect(() => {
    document.title = 'Finlay Games';
  }, []);

  return (
    <PageContainer className="scanlines">
      {/* Hero */}
      <div className="text-center mb-12 mt-8">
        <h1 className="font-pixel text-2xl sm:text-4xl text-retro-accent mb-4 leading-relaxed animate-pulse-glow inline-block px-6 py-2">
          FINLAY<br />GAMES
        </h1>
        <p className="font-pixel text-[8px] sm:text-[10px] text-retro-muted mt-2">
          LOCAL MULTIPLAYER MADNESS
        </p>
      </div>

      {/* Game Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl w-full mb-12">
        {Object.entries(GAME_INFO).map(([key, info]) => (
          <button
            key={key}
            onClick={() => setSelectedGame(key as GameType)}
            className="text-left"
          >
            <RetroCard
              className={`text-center transition-transform hover:scale-105 cursor-pointer ${
                selectedGame === key
                  ? '!border-retro-accent shadow-[0_0_12px_rgba(0,255,128,0.3)]'
                  : ''
              }`}
            >
              <div className="text-3xl mb-3">{gameIcons[key as GameType]}</div>
              <h3 className="font-pixel text-[10px] text-retro-text mb-2">{info.name}</h3>
              <p className="font-pixel text-[7px] text-retro-muted leading-relaxed">
                {info.description}
              </p>
            </RetroCard>
          </button>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
        <Link to="/create" state={{ gameType: selectedGame }} className="flex-1">
          <Button size="lg" className="w-full">
            Create Room
          </Button>
        </Link>
        <Link to="/join" className="flex-1">
          <Button variant="secondary" size="lg" className="w-full">
            Join Room
          </Button>
        </Link>
      </div>

      {/* Leaderboard link */}
      <Link to="/leaderboard" className="mt-6">
        <Button variant="secondary" size="sm">
          Leaderboard
        </Button>
      </Link>

      {/* Footer */}
      <p className="font-pixel text-[6px] text-retro-muted/30 mt-8">
        v0.2.0
      </p>
    </PageContainer>
  );
}
