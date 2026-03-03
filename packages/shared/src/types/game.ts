export enum GameType {
  BlastZone = 'blast-zone',
  FinlayKart = 'finlay-kart',
  FinlayBros = 'finlay-bros',
}

export const GAME_INFO: Record<GameType, { name: string; description: string; available: boolean }> = {
  [GameType.BlastZone]: {
    name: 'Blast Zone',
    description: 'Strategic bomb placement mayhem',
    available: true,
  },
  [GameType.FinlayKart]: {
    name: 'Finlay Kart',
    description: 'High-speed retro racing',
    available: false,
  },
  [GameType.FinlayBros]: {
    name: 'Finlay Bros',
    description: 'Classic platformer showdown',
    available: false,
  },
};
