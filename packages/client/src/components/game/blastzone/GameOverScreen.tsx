import { type MatchResult, PLAYER_COLOR_HEX } from '@finlay-games/shared';

interface GameOverScreenProps {
  result: MatchResult;
  myId: string | null;
}

export function GameOverScreen({ result, myId }: GameOverScreenProps) {
  const winner = result.placements[0];

  return (
    <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center">
      <div className="bg-retro-surface border border-retro-border p-8 max-w-md w-full mx-4 text-center">
        <h2 className="font-pixel text-lg text-retro-accent mb-2">GAME OVER</h2>

        {winner && (
          <div className="mb-6">
            <div
              className="w-12 h-12 rounded-sm mx-auto mb-2"
              style={{ backgroundColor: PLAYER_COLOR_HEX[winner.color] }}
            />
            <p className="font-pixel text-xs text-retro-text">{winner.name} WINS!</p>
          </div>
        )}

        {/* Placements */}
        <div className="space-y-2 mb-6">
          {result.placements.map((p, i) => (
            <div
              key={p.playerId}
              className={`flex items-center justify-between px-3 py-2 border ${
                p.playerId === myId ? 'border-retro-accent bg-retro-bg' : 'border-retro-border'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="font-pixel text-[10px] text-retro-muted w-6">
                  {i === 0 ? '1st' : i === 1 ? '2nd' : i === 2 ? '3rd' : `${i + 1}th`}
                </span>
                <div
                  className="w-4 h-4 rounded-sm"
                  style={{ backgroundColor: PLAYER_COLOR_HEX[p.color] }}
                />
                <span className="font-pixel text-[8px] text-retro-text">{p.name}</span>
              </div>
              <span className="font-pixel text-[10px] text-retro-accent">{p.score} pts</span>
            </div>
          ))}
        </div>

        <p className="font-pixel text-[7px] text-retro-muted animate-blink">
          RETURNING TO LOBBY...
        </p>
      </div>
    </div>
  );
}
