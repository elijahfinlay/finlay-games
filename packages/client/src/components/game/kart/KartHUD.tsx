import { type FinlayKartState, PLAYER_COLOR_HEX } from '@finlay-games/shared';

interface KartHUDProps {
  state: FinlayKartState;
  myId: string | null;
}

function formatTime(ms: number): string {
  const totalSecs = Math.floor(ms / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  const tenths = Math.floor((ms % 1000) / 100);
  return `${mins}:${secs.toString().padStart(2, '0')}.${tenths}`;
}

function getOrdinal(n: number): string {
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}

export function KartHUD({ state, myId }: KartHUDProps) {
  const me = state.players.find((p) => p.id === myId);

  // Sort players by race position: finished first (by finish time), then by lap desc, then checkpoint desc
  const sorted = [...state.players].sort((a, b) => {
    if (a.finished && a.finishTime !== null && b.finished && b.finishTime !== null) {
      return a.finishTime - b.finishTime;
    }
    if (a.finished && a.finishTime !== null) return -1;
    if (b.finished && b.finishTime !== null) return 1;
    if (a.lap !== b.lap) return b.lap - a.lap;
    return b.nextCheckpoint - a.nextCheckpoint;
  });

  const myPosition = me ? sorted.findIndex((p) => p.id === myId) + 1 : 0;

  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 w-full max-w-[800px]">
      {/* Position + Lap + Timer */}
      <div className="flex gap-6 items-center">
        {me && (
          <div className="text-center">
            <div className="font-pixel text-[7px] text-retro-muted uppercase">Position</div>
            <div className="font-pixel text-lg text-retro-accent">
              {getOrdinal(myPosition)}
              <span className="text-[10px] text-retro-muted"> / {state.players.length}</span>
            </div>
          </div>
        )}
        {me && (
          <div className="text-center">
            <div className="font-pixel text-[7px] text-retro-muted uppercase">Lap</div>
            <div className="font-pixel text-sm text-retro-accent">
              {Math.min(me.lap, state.totalLaps)}/{state.totalLaps}
            </div>
          </div>
        )}
        <div className="text-center">
          <div className="font-pixel text-[7px] text-retro-muted uppercase">Time</div>
          <div className="font-pixel text-sm text-retro-text">
            {formatTime(state.elapsedMs)}
          </div>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="flex gap-2 flex-wrap">
        {sorted.map((p, i) => (
          <div
            key={p.id}
            className={`flex items-center gap-2 px-2 py-1 border ${
              p.id === myId ? 'border-retro-accent' : 'border-retro-border'
            } ${p.finished && p.finishTime === null ? 'opacity-40' : ''}`}
          >
            <span className="font-pixel text-[7px] text-retro-muted w-4">
              {getOrdinal(i + 1)}
            </span>
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: PLAYER_COLOR_HEX[p.color] }}
            />
            <span className="font-pixel text-[7px] text-retro-text">{p.name}</span>
            <span className="font-pixel text-[7px] text-retro-muted">
              {p.finished && p.finishTime !== null
                ? formatTime(p.finishTime)
                : p.finished
                  ? 'DNF'
                  : `L${p.lap}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
