import { type BlastZoneState, PLAYER_COLOR_HEX } from '@finlay-games/shared';

interface GameHUDProps {
  state: BlastZoneState;
  myId: string | null;
}

export function GameHUD({ state, myId }: GameHUDProps) {
  const sorted = [...state.players].sort(
    (a, b) => (state.scores[b.id] ?? 0) - (state.scores[a.id] ?? 0),
  );

  const minutes = Math.floor(state.roundTimeLeft / 60);
  const seconds = state.roundTimeLeft % 60;
  const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  const timeLow = state.roundTimeLeft <= 30;

  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 w-full max-w-[624px]">
      {/* Timer + Round */}
      <div className="flex gap-6 items-center">
        <div className="text-center">
          <div className="font-pixel text-[7px] text-retro-muted uppercase">Round</div>
          <div className="font-pixel text-sm text-retro-accent">
            {state.round}/{state.totalRounds}
          </div>
        </div>
        <div className="text-center">
          <div className="font-pixel text-[7px] text-retro-muted uppercase">Time</div>
          <div className={`font-pixel text-sm ${timeLow ? 'text-red-500 animate-blink' : 'text-retro-text'}`}>
            {timeStr}
          </div>
        </div>
      </div>

      {/* Scoreboard */}
      <div className="flex gap-3 flex-wrap">
        {sorted.map((p) => (
          <div
            key={p.id}
            className={`flex items-center gap-2 px-2 py-1 border ${
              p.id === myId ? 'border-retro-accent' : 'border-retro-border'
            } ${!p.alive ? 'opacity-40' : ''}`}
          >
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: PLAYER_COLOR_HEX[p.color] }}
            />
            <span className="font-pixel text-[7px] text-retro-text">{p.name}</span>
            <span className="font-pixel text-[8px] text-retro-accent">{state.scores[p.id] ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
