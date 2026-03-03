import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@finlay-games/shared';
import { useGameStore } from '../stores/gameStore';
import { useConnectionStore } from '../stores/connectionStore';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: TypedSocket | null = null;

const SERVER_URL = import.meta.env.VITE_SERVER_URL || '';

export function getSocket(): TypedSocket {
  if (!socket) {
    socket = io(SERVER_URL, { autoConnect: false }) as TypedSocket;
    bindEvents(socket);
  }
  return socket;
}

export function connectSocket() {
  const s = getSocket();
  if (!s.connected) {
    useConnectionStore.getState().setStatus('connecting');
    s.connect();
  }
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    useConnectionStore.getState().setStatus('disconnected');
  }
}

function bindEvents(s: TypedSocket) {
  const store = useGameStore;
  const connStore = useConnectionStore;

  s.on('connect', () => {
    connStore.getState().setStatus('connected');

    // Try reconnect if we have session data
    const savedPlayerId = sessionStorage.getItem('fg_playerId');
    const savedRoomCode = sessionStorage.getItem('fg_roomCode');
    if (savedPlayerId && savedRoomCode) {
      s.emit('room:reconnect', { playerId: savedPlayerId, roomCode: savedRoomCode }, (res) => {
        if (res.ok) {
          store.getState().setRoom(res.room);
          store.getState().setPlayerId(savedPlayerId);
        } else {
          sessionStorage.removeItem('fg_playerId');
          sessionStorage.removeItem('fg_roomCode');
        }
      });
    }
  });

  s.on('disconnect', () => {
    connStore.getState().setStatus('reconnecting');
  });

  // Room events
  s.on('room:playerJoined', ({ player }) => {
    store.getState().addPlayer(player);
  });

  s.on('room:playerLeft', ({ playerId }) => {
    store.getState().removePlayer(playerId);
  });

  s.on('room:playerDisconnected', ({ playerId }) => {
    store.getState().setPlayerConnected(playerId, false);
  });

  s.on('room:playerReconnected', ({ playerId }) => {
    store.getState().setPlayerConnected(playerId, true);
  });

  s.on('room:hostChanged', ({ newHostId }) => {
    store.getState().setHost(newHostId);
  });

  s.on('room:closed', () => {
    store.getState().reset();
    sessionStorage.removeItem('fg_playerId');
    sessionStorage.removeItem('fg_roomCode');
  });

  // Lobby events
  s.on('lobby:settingsUpdated', ({ settings }) => {
    store.getState().updateSettings(settings);
  });

  s.on('lobby:colorChanged', ({ playerId, color }) => {
    store.getState().changePlayerColor(playerId, color);
  });

  s.on('lobby:gameStarting', () => {
    console.log('[CLIENT] Game starting! (Phase 1 — no-op)');
  });
}

export function saveSession(playerId: string, roomCode: string) {
  sessionStorage.setItem('fg_playerId', playerId);
  sessionStorage.setItem('fg_roomCode', roomCode);
}

export function clearSession() {
  sessionStorage.removeItem('fg_playerId');
  sessionStorage.removeItem('fg_roomCode');
}
