import type { Server } from 'socket.io';
import {
  GAME_TICK_MS,
  GameType,
  PLAYER_COLORS,
  KART_BOT_NAMES,
  type BlastZoneState,
  type BrosInput,
  type FinlayBrosState,
  type FinlayKartState,
  type GameInput,
  type KartInput,
  type MatchResult,
  type PlayerColor,
} from '@finlay-games/shared';
import { BlastZoneEngine } from './BlastZoneEngine.js';
import { FinlayKartEngine } from './FinlayKartEngine.js';
import { FinlayBrosEngine } from './FinlayBrosEngine.js';
import { roomManager } from '../state/RoomManager.js';
import { getOrCreatePlayer, recordMatch } from '../db/matches.js';

type ActiveEngine = BlastZoneEngine | FinlayKartEngine | FinlayBrosEngine;
type ActiveState = BlastZoneState | FinlayKartState | FinlayBrosState;

interface ActiveGame {
  engine: ActiveEngine;
  gameType: GameType;
  roomCode: string;
  tickInterval: ReturnType<typeof setInterval> | null;
  secondInterval: ReturnType<typeof setInterval> | null;
  transitionTimeout: ReturnType<typeof setTimeout> | null;
  dbPlayerIds: Map<string, string>;
  transitioning: boolean;
  gameOverHandled: boolean;
  eliminatedPlayerIds: Set<string>;
}

const activeGames = new Map<string, ActiveGame>();
const SECOND_INTERVAL_MS = process.env.FG_FAST_TIMERS === '1' ? 100 : 1000;

roomManager.onDelete((roomCode) => {
  cleanupGame(roomCode);
});

export async function startGame(io: Server, roomCode: string) {
  cleanupGame(roomCode);

  const room = roomManager.getRoom(roomCode);
  if (!room) return;

  const connectedPlayers = room.players.filter((player) => player.connected);
  room.state = 'playing';
  roomManager.scheduleExpiry(roomCode);

  const dbPlayerIds = new Map<string, string>();
  try {
    await Promise.all(
      connectedPlayers.map(async (player) => {
        const dbId = await getOrCreatePlayer(player.name);
        if (dbId) dbPlayerIds.set(player.id, dbId);
      }),
    );
  } catch (err) {
    console.error('[GAME] Failed to resolve DB player IDs:', err);
  }

  switch (room.settings.gameType) {
    case GameType.FinlayKart:
      startKartGame(io, roomCode, room.settings.rounds, connectedPlayers, dbPlayerIds);
      break;
    case GameType.FinlayBros:
      startBrosGame(io, roomCode, room.settings.roundTime, connectedPlayers, dbPlayerIds);
      break;
    case GameType.BlastZone:
    default:
      startBlastZoneGame(
        io,
        roomCode,
        room.settings.rounds,
        room.settings.roundTime,
        connectedPlayers,
        dbPlayerIds,
      );
      break;
  }
}

export function getActiveGameState(roomCode: string): ActiveState | undefined {
  const game = activeGames.get(roomCode);
  if (!game) return undefined;
  return game.engine.state as ActiveState;
}

function createActiveGame(
  engine: ActiveEngine,
  gameType: GameType,
  roomCode: string,
  dbPlayerIds: Map<string, string>,
): ActiveGame {
  return {
    engine,
    gameType,
    roomCode,
    tickInterval: null,
    secondInterval: null,
    transitionTimeout: null,
    dbPlayerIds,
    transitioning: false,
    gameOverHandled: false,
    eliminatedPlayerIds: new Set(),
  };
}

function startBlastZoneGame(
  io: Server,
  roomCode: string,
  rounds: number,
  roundTime: number,
  players: { id: string; name: string; color: PlayerColor }[],
  dbPlayerIds: Map<string, string>,
) {
  const engine = new BlastZoneEngine(
    players.map((player) => ({ id: player.id, name: player.name, color: player.color })),
    rounds,
    roundTime,
  );
  const game = createActiveGame(engine, GameType.BlastZone, roomCode, dbPlayerIds);
  activeGames.set(roomCode, game);
  startBlastZoneIntervals(io, game);
  emitState(io, game);
}

function startKartGame(
  io: Server,
  roomCode: string,
  totalLaps: number,
  connectedPlayers: { id: string; name: string; color: PlayerColor }[],
  dbPlayerIds: Map<string, string>,
) {
  const takenColors = new Set(connectedPlayers.map((player) => player.color));
  const availableColors = PLAYER_COLORS.filter((color) => !takenColors.has(color));

  const playerInits = connectedPlayers.map((player) => ({
    id: player.id,
    name: player.name,
    color: player.color,
    isBot: false,
  }));

  let colorIndex = 0;
  let botCount = 0;
  while (playerInits.length < 4 && botCount < KART_BOT_NAMES.length) {
    const botColor =
      availableColors[colorIndex % availableColors.length] ??
      PLAYER_COLORS[colorIndex % PLAYER_COLORS.length];
    colorIndex++;
    playerInits.push({
      id: `bot-${botCount}`,
      name: KART_BOT_NAMES[botCount],
      color: botColor,
      isBot: true,
    });
    botCount++;
  }

  const engine = new FinlayKartEngine(playerInits, totalLaps);
  const game = createActiveGame(engine, GameType.FinlayKart, roomCode, dbPlayerIds);
  activeGames.set(roomCode, game);

  game.tickInterval = setInterval(() => {
    engine.tick(Date.now());
    emitState(io, game);

    if (engine.state.phase === 'finished' && !game.gameOverHandled) {
      game.gameOverHandled = true;
      void handleKartGameOver(io, game);
    }
  }, GAME_TICK_MS);

  game.secondInterval = setInterval(() => {
    if (engine.state.phase === 'countdown') {
      const started = engine.decrementCountdown();
      if (started) {
        emitState(io, game);
      }
    }
  }, SECOND_INTERVAL_MS);

  emitState(io, game);
}

function startBrosGame(
  io: Server,
  roomCode: string,
  roundTime: number,
  players: { id: string; name: string; color: PlayerColor }[],
  dbPlayerIds: Map<string, string>,
) {
  const engine = new FinlayBrosEngine(
    players.map((player) => ({ id: player.id, name: player.name, color: player.color })),
    roundTime,
  );
  const game = createActiveGame(engine, GameType.FinlayBros, roomCode, dbPlayerIds);
  activeGames.set(roomCode, game);

  game.tickInterval = setInterval(() => {
    engine.tick(Date.now());
    emitState(io, game);

    if (engine.state.phase === 'gameOver' && !game.gameOverHandled) {
      game.gameOverHandled = true;
      void handleBrosGameOver(io, game);
    }
  }, GAME_TICK_MS);

  game.secondInterval = setInterval(() => {
    if (engine.state.phase === 'countdown') {
      const started = engine.decrementCountdown();
      if (started) {
        emitState(io, game);
      }
    } else if (engine.state.phase === 'playing') {
      engine.decrementTimer();
    }
  }, SECOND_INTERVAL_MS);

  emitState(io, game);
}

function emitState(io: Server, game: ActiveGame) {
  io.to(game.roomCode).emit('game:state', { state: game.engine.state as ActiveState });
}

function clearIntervals(game: ActiveGame) {
  if (game.tickInterval) {
    clearInterval(game.tickInterval);
    game.tickInterval = null;
  }
  if (game.secondInterval) {
    clearInterval(game.secondInterval);
    game.secondInterval = null;
  }
  if (game.transitionTimeout) {
    clearTimeout(game.transitionTimeout);
    game.transitionTimeout = null;
  }
}

function startBlastZoneIntervals(io: Server, game: ActiveGame) {
  const engine = game.engine as BlastZoneEngine;

  game.tickInterval = setInterval(() => {
    engine.tick(Date.now());
    emitState(io, game);

    if (engine.state.phase === 'gameOver' && !game.gameOverHandled) {
      game.gameOverHandled = true;
      void handleBlastZoneGameOver(io, game);
    } else if (engine.state.phase === 'roundEnd' && !game.transitioning) {
      game.transitioning = true;
      if (game.tickInterval) {
        clearInterval(game.tickInterval);
        game.tickInterval = null;
      }
      if (game.secondInterval) {
        clearInterval(game.secondInterval);
        game.secondInterval = null;
      }
      game.transitionTimeout = setTimeout(() => {
        game.transitionTimeout = null;
        game.transitioning = false;
        engine.startNextRound();
        reapplyEliminations(game);
        startBlastZoneIntervals(io, game);
        emitState(io, game);
      }, 3000);
    }
  }, GAME_TICK_MS);

  game.secondInterval = setInterval(() => {
    if (engine.state.phase === 'countdown') {
      const started = engine.decrementCountdown();
      if (started) {
        emitState(io, game);
      }
    } else if (engine.state.phase === 'playing') {
      engine.decrementTimer();
    }
  }, SECOND_INTERVAL_MS);
}

function reapplyEliminations(game: ActiveGame) {
  if (game.gameType !== GameType.BlastZone) return;
  const engine = game.engine as BlastZoneEngine;
  for (const playerId of game.eliminatedPlayerIds) {
    const player = engine.state.players.find((entry) => entry.id === playerId);
    if (player) {
      player.alive = false;
    }
  }
}

function getRecordablePlacements(game: ActiveGame, result: MatchResult) {
  return result.placements.flatMap((placement) => {
    const dbPlayerId = game.dbPlayerIds.get(placement.playerId);
    if (!dbPlayerId) return [];
    return [{
      playerId: dbPlayerId,
      name: placement.name,
      color: placement.color,
      score: placement.score,
      placement: placement.placement,
    }];
  });
}

async function handleBlastZoneGameOver(io: Server, game: ActiveGame) {
  clearIntervals(game);

  const engine = game.engine as BlastZoneEngine;
  const room = roomManager.getRoom(game.roomCode);
  const sorted = [...engine.state.players].sort(
    (left, right) => (engine.state.scores[right.id] ?? 0) - (engine.state.scores[left.id] ?? 0),
  );

  const result: MatchResult = {
    matchId: '',
    gameType: GameType.BlastZone,
    outcome: 'winner',
    title: 'GAME OVER',
    placements: sorted.map((player, index) => ({
      playerId: player.id,
      name: player.name,
      color: player.color,
      score: engine.state.scores[player.id] ?? 0,
      placement: index + 1,
    })),
  };

  const winnerId = engine.state.winnerId;
  const winnerDbId = winnerId ? game.dbPlayerIds.get(winnerId) ?? null : null;
  const recordablePlacements = getRecordablePlacements(game, result);

  if (recordablePlacements.length > 0) {
    try {
    const matchId = await recordMatch(
      game.roomCode,
      GameType.BlastZone,
      engine.state.round,
      recordablePlacements,
      winnerDbId,
    );
    if (matchId) {
      result.matchId = matchId;
    }
  } catch (err) {
    console.error('[GAME] Failed to record match:', err);
  }
  }

  finishGame(io, game, room, result);
}

async function handleKartGameOver(io: Server, game: ActiveGame) {
  clearIntervals(game);

  const engine = game.engine as FinlayKartEngine;
  const room = roomManager.getRoom(game.roomCode);
  const sorted = engine.getSortedPlacements();

  const result: MatchResult = {
    matchId: '',
    gameType: GameType.FinlayKart,
    outcome: 'winner',
    title: 'RACE OVER',
    placements: sorted.map((player, index) => ({
      playerId: player.id,
      name: player.name,
      color: player.color,
      score: player.finishTime !== null ? Math.round(player.finishTime / 100) : 0,
      placement: index + 1,
      detail: player.finishTime === null ? 'DNF' : undefined,
    })),
  };

  const winnerId = sorted[0]?.id ?? null;
  const winnerDbId = winnerId ? game.dbPlayerIds.get(winnerId) ?? null : null;
  const recordablePlacements = getRecordablePlacements(game, result);

  if (recordablePlacements.length > 0) {
    try {
    const matchId = await recordMatch(
      game.roomCode,
      GameType.FinlayKart,
      engine.state.totalLaps,
      recordablePlacements,
      winnerDbId,
    );
    if (matchId) {
      result.matchId = matchId;
    }
  } catch (err) {
    console.error('[GAME] Failed to record kart match:', err);
  }
  }

  finishGame(io, game, room, result);
}

async function handleBrosGameOver(io: Server, game: ActiveGame) {
  clearIntervals(game);

  const engine = game.engine as FinlayBrosEngine;
  const room = roomManager.getRoom(game.roomCode);
  const sorted = [...engine.state.players].sort((left, right) => {
    if (left.finished !== right.finished) return left.finished ? -1 : 1;
    if (left.checkpoint !== right.checkpoint) return right.checkpoint - left.checkpoint;
    if (left.progress !== right.progress) return right.progress - left.progress;
    return left.deaths - right.deaths;
  });

  const result: MatchResult = {
    matchId: '',
    gameType: GameType.FinlayBros,
    outcome: engine.state.outcome ?? 'failed',
    title: engine.state.outcome === 'cleared' ? 'LEVEL CLEARED' : 'TIME UP',
    subtitle:
      engine.state.outcome === 'cleared'
        ? 'One of your crew reached the flag.'
        : 'The team ran out of time.',
    placements: sorted.map((player, index) => ({
      playerId: player.id,
      name: player.name,
      color: player.color,
      score: Math.round(player.progress),
      placement: index + 1,
      detail: player.finished
        ? 'CLEARED'
        : !player.active
          ? 'DISCONNECTED'
          : player.checkpoint > 0
            ? `CHECKPOINT ${player.checkpoint}`
            : 'START',
    })),
  };

  const winnerId = engine.state.outcome === 'cleared' ? engine.getFinisherId() : null;
  const winnerDbId = winnerId ? game.dbPlayerIds.get(winnerId) ?? null : null;
  const recordablePlacements = getRecordablePlacements(game, result);

  if (recordablePlacements.length > 0) {
    try {
    const matchId = await recordMatch(
      game.roomCode,
      GameType.FinlayBros,
      room?.settings.roundTime ?? 0,
      recordablePlacements,
      winnerDbId,
    );
    if (matchId) {
      result.matchId = matchId;
    }
  } catch (err) {
    console.error('[GAME] Failed to record Finlay Bros match:', err);
  }
  }

  finishGame(io, game, room, result);
}

function finishGame(
  io: Server,
  game: ActiveGame,
  room: ReturnType<typeof roomManager.getRoom>,
  result: MatchResult,
) {
  io.to(game.roomCode).emit('game:over', { result });

  game.transitionTimeout = setTimeout(() => {
    game.transitionTimeout = null;
    if (room) {
      room.state = 'lobby';
      roomManager.scheduleExpiry(game.roomCode);
    }
    io.to(game.roomCode).emit('game:backToLobby');
    cleanupGame(game.roomCode);
  }, 8000);
}

export function handleGameInput(
  roomCode: string,
  playerId: string,
  input: GameInput | KartInput | BrosInput,
) {
  const game = activeGames.get(roomCode);
  if (!game) return;

  switch (game.gameType) {
    case GameType.FinlayKart:
      (game.engine as FinlayKartEngine).handleInput(playerId, input as KartInput);
      break;
    case GameType.FinlayBros:
      (game.engine as FinlayBrosEngine).handleInput(playerId, input as BrosInput);
      break;
    case GameType.BlastZone:
    default:
      (game.engine as BlastZoneEngine).handleInput(playerId, input as GameInput);
      break;
  }
}

export function eliminatePlayer(roomCode: string, playerId: string) {
  const game = activeGames.get(roomCode);
  if (!game) return;

  switch (game.gameType) {
    case GameType.FinlayKart:
      (game.engine as FinlayKartEngine).markPlayerDNF(playerId);
      break;
    case GameType.FinlayBros:
      (game.engine as FinlayBrosEngine).markPlayerInactive(playerId);
      break;
    case GameType.BlastZone:
    default: {
      game.eliminatedPlayerIds.add(playerId);
      const engine = game.engine as BlastZoneEngine;
      const player = engine.state.players.find((entry) => entry.id === playerId);
      if (player) {
        player.alive = false;
      }
      break;
    }
  }
}

export function cleanupGame(roomCode: string) {
  const game = activeGames.get(roomCode);
  if (!game) return;
  clearIntervals(game);
  activeGames.delete(roomCode);
}
