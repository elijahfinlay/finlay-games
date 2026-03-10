import { type FinlayBrosState, PLAYER_COLOR_HEX } from '@finlay-games/shared';

interface BrosHUDProps {
  state: FinlayBrosState;
  myId: string | null;
}

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function BrosHUD({ state, myId }: BrosHUDProps) {
  const me = state.players.find((player) => player.id === myId);
  const totalCheckpoints = state.level.checkpoints.length;
  const timeLow = state.timeLeft <= 15;

  const sorted = [...state.players].sort((left, right) => {
    if (left.finished !== right.finished) return left.finished ? -1 : 1;
    if (left.checkpoint !== right.checkpoint) return right.checkpoint - left.checkpoint;
    if (left.progress !== right.progress) return right.progress - left.progress;
    return left.deaths - right.deaths;
  });

  return (
    <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 w-full max-w-[960px]">
      <div className="flex gap-6 items-center">
        <div className="text-center">
          <div className="font-pixel text-[7px] text-retro-muted uppercase">Timer</div>
          <div className={`font-pixel text-sm ${timeLow ? 'text-red-500 animate-blink' : 'text-retro-text'}`}>
            {formatTime(state.timeLeft)}
          </div>
        </div>
        <div className="text-center">
          <div className="font-pixel text-[7px] text-retro-muted uppercase">Checkpoint</div>
          <div className="font-pixel text-sm text-retro-accent">
            {state.teamCheckpoint}/{totalCheckpoints}
          </div>
        </div>
        {me && (
          <div className="text-center">
            <div className="font-pixel text-[7px] text-retro-muted uppercase">Status</div>
            <div className="font-pixel text-sm text-retro-accent">
              {me.finished
                ? 'CLEAR'
                : me.respawning
                  ? 'RESPAWN'
                  : me.active
                    ? `CP ${me.checkpoint}`
                    : 'OFFLINE'}
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        {sorted.map((player, index) => (
          <div
            key={player.id}
            className={`flex items-center gap-2 px-2 py-1 border ${
              player.id === myId ? 'border-retro-accent' : 'border-retro-border'
            } ${!player.active ? 'opacity-50' : ''}`}
          >
            <span className="font-pixel text-[7px] text-retro-muted w-4">
              {index + 1}
            </span>
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: PLAYER_COLOR_HEX[player.color] }}
            />
            <span className="font-pixel text-[7px] text-retro-text">{player.name}</span>
            <span className="font-pixel text-[7px] text-retro-muted">
              {player.finished
                ? 'CLEAR'
                : player.respawning
                  ? 'RESPAWN'
                  : !player.active
                    ? 'OFF'
                    : `CP ${player.checkpoint}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
