import { PLAYER_COLOR_HEX, MAX_PLAYERS, type Player } from '@finlay-games/shared';

interface PlayerGridProps {
  players: Player[];
  isHost?: boolean;
  onRemoveBot?: (playerId: string) => void;
}

export function PlayerGrid({ players, isHost, onRemoveBot }: PlayerGridProps) {
  const slots = Array.from({ length: MAX_PLAYERS }, (_, i) => players[i] ?? null);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {slots.map((player, i) => (
        <div
          key={player?.id ?? `empty-${i}`}
          className={`border p-4 flex flex-col items-center justify-center min-h-[100px] transition-all relative
            ${player
              ? player.connected
                ? 'border-retro-border bg-retro-surface'
                : 'border-retro-border bg-retro-surface opacity-50'
              : 'border-dashed border-retro-border/40 bg-retro-bg'
            }`}
        >
          {player ? (
            <>
              <div
                className="w-8 h-8 rounded-sm mb-2"
                style={{ backgroundColor: PLAYER_COLOR_HEX[player.color] }}
              />
              <span className="font-pixel text-[8px] text-retro-text truncate max-w-full">
                {player.name}
              </span>
              {player.isHost && (
                <span className="font-pixel text-[6px] text-retro-accent mt-1">HOST</span>
              )}
              {player.isBot && (
                <span className="font-pixel text-[6px] text-retro-muted mt-1">CPU</span>
              )}
              {!player.connected && !player.isBot && (
                <span className="font-pixel text-[6px] text-retro-red mt-1 animate-blink">
                  DISCONNECTED
                </span>
              )}
              {player.isBot && isHost && onRemoveBot && (
                <button
                  onClick={() => onRemoveBot(player.id)}
                  className="absolute top-1 right-1 font-pixel text-[6px] text-red-400 hover:text-red-300 px-1"
                >
                  X
                </button>
              )}
            </>
          ) : (
            <span className="font-pixel text-[8px] text-retro-muted/40">EMPTY</span>
          )}
        </div>
      ))}
    </div>
  );
}
