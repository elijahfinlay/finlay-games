import { PLAYER_COLORS, PLAYER_COLOR_HEX, type PlayerColor } from '@finlay-games/shared';

interface ColorPickerProps {
  selected: PlayerColor | null;
  takenColors?: string[];
  onChange: (color: PlayerColor) => void;
}

export function ColorPicker({ selected, takenColors = [], onChange }: ColorPickerProps) {
  return (
    <div>
      <label className="block font-pixel text-[8px] text-retro-muted uppercase mb-2">
        Choose Color
      </label>
      <div className="flex flex-wrap gap-2">
        {PLAYER_COLORS.map((color) => {
          const taken = takenColors.includes(color) && color !== selected;
          return (
            <button
              key={color}
              type="button"
              disabled={taken}
              onClick={() => onChange(color)}
              className={`w-10 h-10 rounded-sm border-2 transition-all
                ${selected === color ? 'border-white scale-110' : 'border-transparent'}
                ${taken ? 'opacity-25 cursor-not-allowed' : 'hover:scale-105 cursor-pointer'}
              `}
              style={{ backgroundColor: PLAYER_COLOR_HEX[color] }}
              title={taken ? `${color} (taken)` : color}
            />
          );
        })}
      </div>
    </div>
  );
}
