import { Link } from 'react-router-dom';
import { GAME_INFO, GameType } from '@finlay-games/shared';
import { PageContainer } from '../components/layout/PageContainer';
import { RetroCard } from '../components/common/RetroCard';
import { Button } from '../components/common/Button';
import { useEffect } from 'react';

const gameIcons: Record<GameType, string> = {
  [GameType.BlastZone]: '💣',
  [GameType.FinlayKart]: '🏎️',
  [GameType.FinlayBros]: '🎮',
};

export function LandingPage() {
  useEffect(() => {
    document.title = 'Finlay Games';
  }, []);

  return (
    <PageContainer>
      {/* Hero */}
      <div className="text-center mb-12 mt-8">
        <h1 className="font-pixel text-2xl sm:text-4xl text-retro-accent mb-4 leading-relaxed">
          FINLAY<br />GAMES
        </h1>
        <p className="font-pixel text-[8px] sm:text-[10px] text-retro-muted">
          LOCAL MULTIPLAYER MADNESS
        </p>
      </div>

      {/* Game Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl w-full mb-12">
        {Object.entries(GAME_INFO).map(([key, info]) => (
          <RetroCard
            key={key}
            className={`text-center ${!info.available ? 'opacity-40' : ''}`}
          >
            <div className="text-3xl mb-3">{gameIcons[key as GameType]}</div>
            <h3 className="font-pixel text-[10px] text-retro-text mb-2">{info.name}</h3>
            <p className="font-pixel text-[7px] text-retro-muted leading-relaxed">
              {info.description}
            </p>
            {!info.available && (
              <span className="inline-block font-pixel text-[6px] text-retro-muted mt-2 border border-retro-border px-2 py-1">
                COMING SOON
              </span>
            )}
          </RetroCard>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
        <Link to="/create" className="flex-1">
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
    </PageContainer>
  );
}
