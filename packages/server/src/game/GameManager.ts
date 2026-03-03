import type { Server } from 'socket.io';
import {
  GAME_TICK_MS,
  type MatchResult,
  type GameInput,
} from '@finlay-games/shared';
import { BlastZoneEngine } from './BlastZoneEngine.js';
import { roomManager } from '../state/RoomManager.js';
import { getOrCreatePlayer, recordMatch } from '../db/matches.js';

interface ActiveGame {
  engine: BlastZoneEngine;
  roomCode: string;
  tickInterval: ReturnType<typeof setInterval>;
  secondInterval: ReturnType<typeof setInterval>;
  // Map in-game player IDs to DB player IDs
  dbPlayerIds: Map<string, string>;
}

const activeGames = new Map<string, ActiveGame>();

export function startGame(io: Server, roomCode: string) {
  const room = roomManager.getRoom(roomCode);
  if (!room) return;

  const players = room.players.filter((p) => p.connected);
  room.state = 'playing';

  const engine = new BlastZoneEngine(
    players.map((p) => ({ id: p.id, name: p.name, color: p.color })),
    room.settings.rounds,
    room.settings.roundTime,
  );

  // Resolve DB player IDs in background
  const dbPlayerIds = new Map<string, string>();
  Promise.all(
    players.map(async (p) => {
      const dbId = await getOrCreatePlayer(p.name);
      if (dbId) dbPlayerIds.set(p.id, dbId);
    }),
  ).catch(() => {});

  const game: ActiveGame = {
    engine,
    roomCode,
    dbPlayerIds,
    tickInterval: setInterval(() => {
      const now = Date.now();
      engine.tick(now);

      // Broadcast state
      io.to(roomCode).emit('game:state', { state: engine.state });

      // Check if game over
      if (engine.state.phase === 'gameOver') {
        handleGameOver(io, game);
      }

      // Auto-advance from roundEnd after 3 seconds
      if (engine.state.phase === 'roundEnd') {
        clearIntervals(game);
        setTimeout(() => {
          engine.startNextRound();
          startIntervals(io, game);
        }, 3000);
      }
    }, GAME_TICK_MS),

    secondInterval: setInterval(() => {
      if (engine.state.phase === 'countdown') {
        const started = engine.decrementCountdown();
        if (started) {
          io.to(roomCode).emit('game:state', { state: engine.state });
        }
      } else if (engine.state.phase === 'playing') {
        engine.decrementTimer();
        // State will be broadcast on next tick
      }
    }, 1000),
  };

  activeGames.set(roomCode, game);

  // Send initial state
  io.to(roomCode).emit('game:state', { state: engine.state });
}

function clearIntervals(game: ActiveGame) {
  clearInterval(game.tickInterval);
  clearInterval(game.secondInterval);
}

function startIntervals(io: Server, game: ActiveGame) {
  game.tickInterval = setInterval(() => {
    const now = Date.now();
    game.engine.tick(now);
    io.to(game.roomCode).emit('game:state', { state: game.engine.state });

    if (game.engine.state.phase === 'gameOver') {
      handleGameOver(io, game);
    }
    if (game.engine.state.phase === 'roundEnd') {
      clearIntervals(game);
      setTimeout(() => {
        game.engine.startNextRound();
        startIntervals(io, game);
      }, 3000);
    }
  }, GAME_TICK_MS);

  game.secondInterval = setInterval(() => {
    if (game.engine.state.phase === 'countdown') {
      game.engine.decrementCountdown();
    } else if (game.engine.state.phase === 'playing') {
      game.engine.decrementTimer();
    }
  }, 1000);
}

async function handleGameOver(io: Server, game: ActiveGame) {
  clearIntervals(game);

  const { state } = game.engine;
  const room = roomManager.getRoom(game.roomCode);

  // Build result
  const sorted = [...state.players].sort(
    (a, b) => (state.scores[b.id] ?? 0) - (state.scores[a.id] ?? 0),
  );

  const result: MatchResult = {
    matchId: '',
    placements: sorted.map((p, i) => ({
      playerId: p.id,
      name: p.name,
      color: p.color,
      score: state.scores[p.id] ?? 0,
      placement: i + 1,
    })),
  };

  // Write to DB
  const winnerGameId = state.winnerId;
  const winnerDbId = winnerGameId ? game.dbPlayerIds.get(winnerGameId) ?? null : null;

  try {
    const matchId = await recordMatch(
      game.roomCode,
      room?.settings.gameType ?? 'blast-zone',
      state.round,
      result.placements.map((p) => ({
        playerId: game.dbPlayerIds.get(p.playerId) ?? p.playerId,
        name: p.name,
        color: p.color,
        score: p.score,
        placement: p.placement,
      })),
      winnerDbId,
    );
    if (matchId) result.matchId = matchId;
  } catch (err) {
    console.error('[GAME] Failed to record match:', err);
  }

  io.to(game.roomCode).emit('game:over', { result });

  // Return room to lobby after 8 seconds
  setTimeout(() => {
    if (room) {
      room.state = 'lobby';
    }
    io.to(game.roomCode).emit('game:backToLobby');
    activeGames.delete(game.roomCode);
  }, 8000);
}

export function handleGameInput(roomCode: string, playerId: string, input: GameInput) {
  const game = activeGames.get(roomCode);
  if (!game) return;
  game.engine.handleInput(playerId, input);
}

export function cleanupGame(roomCode: string) {
  const game = activeGames.get(roomCode);
  if (!game) return;
  clearIntervals(game);
  activeGames.delete(roomCode);
}
