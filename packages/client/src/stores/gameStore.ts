import { create } from 'zustand';
import type { Room, Player, RoomSettings, PlayerColor } from '@finlay-games/shared';

interface GameState {
  room: Room | null;
  playerId: string | null;
  error: string | null;

  setRoom: (room: Room) => void;
  setPlayerId: (id: string) => void;
  setError: (error: string | null) => void;
  reset: () => void;

  // Granular updates from socket events
  addPlayer: (player: Player) => void;
  removePlayer: (playerId: string) => void;
  setPlayerConnected: (playerId: string, connected: boolean) => void;
  setHost: (newHostId: string) => void;
  updateSettings: (settings: RoomSettings) => void;
  changePlayerColor: (playerId: string, color: PlayerColor) => void;
}

export const useGameStore = create<GameState>((set) => ({
  room: null,
  playerId: null,
  error: null,

  setRoom: (room) => set({ room, error: null }),
  setPlayerId: (id) => set({ playerId: id }),
  setError: (error) => set({ error }),
  reset: () => set({ room: null, playerId: null, error: null }),

  addPlayer: (player) =>
    set((state) => {
      if (!state.room) return state;
      return { room: { ...state.room, players: [...state.room.players, player] } };
    }),

  removePlayer: (playerId) =>
    set((state) => {
      if (!state.room) return state;
      return {
        room: {
          ...state.room,
          players: state.room.players.filter((p) => p.id !== playerId),
        },
      };
    }),

  setPlayerConnected: (playerId, connected) =>
    set((state) => {
      if (!state.room) return state;
      return {
        room: {
          ...state.room,
          players: state.room.players.map((p) =>
            p.id === playerId ? { ...p, connected } : p,
          ),
        },
      };
    }),

  setHost: (newHostId) =>
    set((state) => {
      if (!state.room) return state;
      return {
        room: {
          ...state.room,
          hostId: newHostId,
          players: state.room.players.map((p) => ({
            ...p,
            isHost: p.id === newHostId,
          })),
        },
      };
    }),

  updateSettings: (settings) =>
    set((state) => {
      if (!state.room) return state;
      return { room: { ...state.room, settings } };
    }),

  changePlayerColor: (playerId, color) =>
    set((state) => {
      if (!state.room) return state;
      return {
        room: {
          ...state.room,
          players: state.room.players.map((p) =>
            p.id === playerId ? { ...p, color } : p,
          ),
        },
      };
    }),
}));
