export const PLAYER_COLORS = [
  'red',
  'blue',
  'green',
  'yellow',
  'purple',
  'orange',
  'pink',
  'cyan',
] as const;

export type PlayerColor = (typeof PLAYER_COLORS)[number];

export const PLAYER_COLOR_HEX: Record<PlayerColor, string> = {
  red: '#EF4444',
  blue: '#3B82F6',
  green: '#22C55E',
  yellow: '#EAB308',
  purple: '#A855F7',
  orange: '#F97316',
  pink: '#EC4899',
  cyan: '#06B6D4',
};

export interface Player {
  id: string;
  name: string;
  color: PlayerColor;
  isHost: boolean;
  connected: boolean;
  joinedAt: number;
}
