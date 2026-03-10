import type { RoomSettings } from '@finlay-games/shared';
import { GameType, GAME_INFO, ROUND_TIME_OPTIONS, ROUNDS_OPTIONS, TOTAL_LAPS_OPTIONS } from '@finlay-games/shared';
import { getSocket } from '../../socket/socketManager';
import { RetroCard } from '../common/RetroCard';

interface HostSettingsPanelProps {
  settings: RoomSettings;
  isHost: boolean;
}

export function HostSettingsPanel({ settings, isHost }: HostSettingsPanelProps) {
  const update = (partial: Partial<RoomSettings>) => {
    getSocket().emit('lobby:updateSettings', { settings: partial }, (res) => {
      if (!res.ok) console.error('Failed to update settings:', res.error);
    });
  };

  const isKart = settings.gameType === GameType.FinlayKart;
  const isBros = settings.gameType === GameType.FinlayBros;

  return (
    <RetroCard className="w-full">
      <h3 className="font-pixel text-[10px] text-retro-accent uppercase mb-4">Game Settings</h3>

      <div className="space-y-4">
        {/* Game Type */}
        <div>
          <label className="font-pixel text-[7px] text-retro-muted uppercase block mb-1">Game</label>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(GAME_INFO).map(([key, info]) => (
              <button
                key={key}
                disabled={!isHost || !info.available}
                onClick={() => update({ gameType: key as GameType })}
                className={`font-pixel text-[7px] px-3 py-2 border transition-all
                  ${settings.gameType === key
                    ? 'border-retro-accent text-retro-accent'
                    : 'border-retro-border text-retro-muted'}
                  ${!info.available ? 'opacity-30 cursor-not-allowed' : isHost ? 'hover:border-retro-accent' : ''}
                `}
              >
                {info.name}
                {!info.available && ' (SOON)'}
              </button>
            ))}
          </div>
        </div>

        {/* Round Time */}
        {!isKart && (
          <div>
            <label className="font-pixel text-[7px] text-retro-muted uppercase block mb-1">
              {isBros ? 'Level Timer' : 'Round Time'}
            </label>
            <div className="flex gap-2">
              {ROUND_TIME_OPTIONS.map((t) => (
                <button
                  key={t}
                  disabled={!isHost}
                  onClick={() => update({ roundTime: t })}
                  className={`font-pixel text-[7px] px-3 py-2 border transition-all
                    ${settings.roundTime === t
                      ? 'border-retro-accent text-retro-accent'
                      : 'border-retro-border text-retro-muted'}
                    ${isHost ? 'hover:border-retro-accent' : ''}
                  `}
                >
                  {t}s
                </button>
              ))}
            </div>
          </div>
        )}

        {!isBros && (
          <div>
            <label className="font-pixel text-[7px] text-retro-muted uppercase block mb-1">
              {isKart ? 'Laps' : 'Rounds'}
            </label>
            <div className="flex gap-2">
              {(isKart ? [...TOTAL_LAPS_OPTIONS] : [...ROUNDS_OPTIONS]).map((r) => (
                <button
                  key={r}
                  disabled={!isHost}
                  onClick={() => update({ rounds: r })}
                  className={`font-pixel text-[7px] px-3 py-2 border transition-all
                    ${settings.rounds === r
                      ? 'border-retro-accent text-retro-accent'
                      : 'border-retro-border text-retro-muted'}
                    ${isHost ? 'hover:border-retro-accent' : ''}
                  `}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        )}

        {!isKart && !isBros && (
          <div>
            <label className="font-pixel text-[7px] text-retro-muted uppercase block mb-1">
              Power-Ups
            </label>
            <button
              disabled={!isHost}
              onClick={() => update({ powerUps: !settings.powerUps })}
              className={`font-pixel text-[7px] px-3 py-2 border transition-all
                ${settings.powerUps
                  ? 'border-retro-accent text-retro-accent'
                  : 'border-retro-border text-retro-muted'}
                ${isHost ? 'hover:border-retro-accent' : ''}
              `}
            >
              {settings.powerUps ? 'ON' : 'OFF'}
            </button>
          </div>
        )}
      </div>

      {!isHost && (
        <p className="font-pixel text-[7px] text-retro-muted mt-4">Only the host can change settings</p>
      )}
    </RetroCard>
  );
}
