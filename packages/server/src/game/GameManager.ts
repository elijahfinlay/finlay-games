import type { Server } from 'socket.io';
import {
  GAME_TICK_MS,
  GameType,
  PLAYER_COLORS,
  KART_BOT_NAMES,
  type MatchResult,
  type GameInput,
  type KartInput,
  type PlayerColor,
} from '@finlay-games/shared';
import { BlastZoneEngine } from './BlastZoneEngine.js';
import { FinlayKartEngine } from './FinlayKartEngine.js';
import { roomManager } from '../state/RoomManager.js';
import { getOrCreatePlayer, recordMatch } from '../db/matches.js';

interface ActiveGame {
  engine: BlastZoneEngine | FinlayKartEngine;
  gameType: GameType;
  roomCode: string;
  tickInterval: ReturnType<typeof setInterval>;
  secondInterval: ReturnType<typeof setInterval> | null;
  // Map in-game player IDs to DB player IDs
  dbPlayerIds: Map<string, string>;
  transitioning: boolean;
  gameOverHandled: boolean;
  // Player IDs eliminated by disconnect (persist across rounds)
  eliminatedPlayerIds: Set<string>;
}

const activeGames = new Map<string, ActiveGame>();

export async function startGame(io: Server, roomCode: string) {
  const room = roomManager.getRoom(roomCode);
  if (!room) return;

  const connectedPlayers = room.players.filter((p) => p.connected);
  room.state = 'playing';

  // Reset room expiry timer (game just started)
  roomManager.scheduleExpiry(roomCode);

  const gameType = room.settings.gameType;

  // Resolve DB player IDs before starting game loop
  const dbPlayerIds = new Map<string, string>();
  try {
    await Promise.all(
      connectedPlayers.map(async (p) => {
        const dbId = await getOrCreatePlayer(p.name);
        if (dbId) dbPlayerIds.set(p.id, dbId);
      }),
    );
  } catch (err) {
    console.error('[GAME] Failed to resolve DB player IDs:', err);
  }

  if (gameType === GameType.FinlayKart) {
    startKartGame(io, roomCode, room, connectedPlayers, dbPlayerIds);
  } else {
    startBlastZoneGame(io, roomCode, room, connectedPlayers, dbPlayerIds);
  }
}

function startBlastZoneGame(
  io: Server,
  roomCode: string,
  room: ReturnType<typeof roomManager.getRoom> & {},
  players: { id: string; name: string; color: PlayerColor }[],
  dbPlayerIds: Map<string, string>,
) {
  const engine = new BlastZoneEngine(
    players.map((p) => ({ id: p.id, name: p.name, color: p.color })),
    room.settings.rounds,
    room.settings.roundTime,
  );

  const game: ActiveGame = {
    engine,
    gameType: GameType.BlastZone,
    roomCode,
    dbPlayerIds,
    transitioning: false,
    gameOverHandled: false,
    eliminatedPlayerIds: new Set(),
    tickInterval: setInterval(() => {
      const now = Date.now();
      engine.tick(now);

      // Broadcast state
      io.to(roomCode).emit('game:state', { state: engine.state });

      // Check if game over
      if (engine.state.phase === 'gameOver' && !game.gameOverHandled) {
        game.gameOverHandled = true;
        handleBlastZoneGameOver(io, game);
      }

      // Auto-advance from roundEnd after 3 seconds
      if (engine.state.phase === 'roundEnd' && !game.transitioning) {
        game.transitioning = true;
        clearIntervals(game);
        setTimeout(() => {
          game.transitioning = false;
          engine.startNextRound();
          reapplyEliminations(game);
          startBlastZoneIntervals(io, game);
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
      }
    }, 1000),
  };

  activeGames.set(roomCode, game);
  io.to(roomCode).emit('game:state', { state: engine.state });
}

function startKartGame(
  io: Server,
  roomCode: string,
  room: ReturnType<typeof roomManager.getRoom> & {},
  connectedPlayers: { id: string; name: string; color: PlayerColor }[],
  dbPlayerIds: Map<string, string>,
) {
  // Build player list with bots
  const takenColors = new Set(connectedPlayers.map((p) => p.color));
  const availableColors = PLAYER_COLORS.filter((c) => !takenColors.has(c));
  let colorIdx = 0;

  const playerInits = connectedPlayers.map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    isBot: false,
  }));

  // Add bots to fill to at least 4 racers
  let botCount = 0;
  while (playerInits.length < 4 && botCount < KART_BOT_NAMES.length) {
    const botColor = availableColors[colorIdx % availableColors.length] ?? PLAYER_COLORS[colorIdx % PLAYER_COLORS.length];
    colorIdx++;
    playerInits.push({
      id: `bot-${botCount}`,
      name: KART_BOT_NAMES[botCount],
      color: botColor,
      isBot: true,
    });
    botCount++;
  }

  const totalLaps = room.settings.rounds; // reuse rounds field for laps
  const engine = new FinlayKartEngine(playerInits, totalLaps);

  const game: ActiveGame = {
    engine,
    gameType: GameType.FinlayKart,
    roomCode,
    dbPlayerIds,
    transitioning: false,
    gameOverHandled: false,
    eliminatedPlayerIds: new Set(),
    tickInterval: setInterval(() => {
      const now = Date.now();
      engine.tick(now);

      io.to(roomCode).emit('game:state', { state: engine.state });

      if (engine.state.phase === 'finished' && !game.gameOverHandled) {
        game.gameOverHandled = true;
        handleKartGameOver(io, game);
      }
    }, GAME_TICK_MS),

    secondInterval: setInterval(() => {
      if (engine.state.phase === 'countdown') {
        const started = engine.decrementCountdown();
        if (started) {
          io.to(roomCode).emit('game:state', { state: engine.state });
        }
      }
    }, 1000),
  };

  activeGames.set(roomCode, game);
  io.to(roomCode).emit('game:state', { state: engine.state });
}

function clearIntervals(game: ActiveGame) {
  clearInterval(game.tickInterval);
  if (game.secondInterval) clearInterval(game.secondInterval);
}

function startBlastZoneIntervals(io: Server, game: ActiveGame) {
  const engine = game.engine as BlastZoneEngine;

  game.tickInterval = setInterval(() => {
    const now = Date.now();
    engine.tick(now);
    io.to(game.roomCode).emit('game:state', { state: engine.state });

    if (engine.state.phase === 'gameOver' && !game.gameOverHandled) {
      game.gameOverHandled = true;
      handleBlastZoneGameOver(io, game);
    }
    if (engine.state.phase === 'roundEnd' && !game.transitioning) {
      game.transitioning = true;
      clearIntervals(game);
      setTimeout(() => {
        game.transitioning = false;
        engine.startNextRound();
        reapplyEliminations(game);
        startBlastZoneIntervals(io, game);
      }, 3000);
    }
  }, GAME_TICK_MS);

  game.secondInterval = setInterval(() => {
    if (engine.state.phase === 'countdown') {
      engine.decrementCountdown();
    } else if (engine.state.phase === 'playing') {
      engine.decrementTimer();
    }
  }, 1000);
}

function reapplyEliminations(game: ActiveGame) {
  if (game.gameType !== GameType.BlastZone) return;
  const engine = game.engine as BlastZoneEngine;
  for (const playerId of game.eliminatedPlayerIds) {
    const player = engine.state.players.find((p) => p.id === playerId);
    if (player) player.alive = false;
  }
}

async function handleBlastZoneGameOver(io: Server, game: ActiveGame) {
  clearIntervals(game);

  const engine = game.engine as BlastZoneEngine;
  const { state } = engine;
  const room = roomManager.getRoom(game.roomCode);

  const sorted = [...state.players].sort(
    (a, b) => (state.scores[b.id] ?? 0) - (state.scores[a.id] ?? 0),
  );

  const result: MatchResult = {
    matchId: '',
    gameType: GameType.BlastZone,
    placements: sorted.map((p, i) => ({
      playerId: p.id,
      name: p.name,
      color: p.color,
      score: state.scores[p.id] ?? 0,
      placement: i + 1,
    })),
  };

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

  setTimeout(() => {
    if (room) {
      room.state = 'lobby';
      roomManager.scheduleExpiry(game.roomCode);
    }
    io.to(game.roomCode).emit('game:backToLobby');
    activeGames.delete(game.roomCode);
  }, 8000);
}

async function handleKartGameOver(io: Server, game: ActiveGame) {
  clearIntervals(game);

  const engine = game.engine as FinlayKartEngine;
  const room = roomManager.getRoom(game.roomCode);
  const sorted = engine.getSortedPlacements();

  const result: MatchResult = {
    matchId: '',
    gameType: GameType.FinlayKart,
    placements: sorted.map((p, i) => ({
      playerId: p.id,
      name: p.name,
      color: p.color,
      score: p.finishTime !== null ? Math.round(p.finishTime / 100) : 0, // deciseconds as score
      placement: i + 1,
    })),
  };

  const winnerId = sorted[0]?.id ?? null;
  const winnerDbId = winnerId ? game.dbPlayerIds.get(winnerId) ?? null : null;

  try {
    const matchId = await recordMatch(
      game.roomCode,
      room?.settings.gameType ?? 'finlay-kart',
      engine.state.totalLaps,
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
    console.error('[GAME] Failed to record kart match:', err);
  }

  io.to(game.roomCode).emit('game:over', { result });

  setTimeout(() => {
    if (room) {
      room.state = 'lobby';
      roomManager.scheduleExpiry(game.roomCode);
    }
    io.to(game.roomCode).emit('game:backToLobby');
    activeGames.delete(game.roomCode);
  }, 8000);
}

export function handleGameInput(roomCode: string, playerId: string, input: GameInput | KartInput) {
  const game = activeGames.get(roomCode);
  if (!game) return;

  if (game.gameType === GameType.FinlayKart) {
    (game.engine as FinlayKartEngine).handleInput(playerId, input as KartInput);
  } else {
    (game.engine as BlastZoneEngine).handleInput(playerId, input as GameInput);
  }
}

export function eliminatePlayer(roomCode: string, playerId: string) {
  const game = activeGames.get(roomCode);
  if (!game) return;

  if (game.gameType === GameType.FinlayKart) {
    (game.engine as FinlayKartEngine).markPlayerDNF(playerId);
  } else {
    game.eliminatedPlayerIds.add(playerId);
    const engine = game.engine as BlastZoneEngine;
    const player = engine.state.players.find((p) => p.id === playerId);
    if (player) {
      player.alive = false;
    }
  }
}

export function cleanupGame(roomCode: string) {
  const game = activeGames.get(roomCode);
  if (!game) return;
  clearIntervals(game);
  activeGames.delete(roomCode);
}
