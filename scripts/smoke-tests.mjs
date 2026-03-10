import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';

process.env.FG_FAST_TIMERS = '1';
process.env.FG_DISABLE_CREATE_COOLDOWN = '1';

const [{ app }, { initSocketIO }, { FinlayBrosEngine }] = await Promise.all([
  import('../packages/server/dist/app.js'),
  import('../packages/server/dist/socket/index.js'),
  import('../packages/server/dist/game/FinlayBrosEngine.js'),
]);

const clientRequire = createRequire(new URL('../packages/client/package.json', import.meta.url));
const { io } = clientRequire('socket.io-client');

const server = createServer(app);
initSocketIO(server);

await new Promise((resolve) => {
  server.listen(0, '127.0.0.1', resolve);
});

const address = server.address();
assert(address && typeof address === 'object', 'Expected HTTP server address');
const baseUrl = `http://127.0.0.1:${address.port}`;

try {
  await testHttp(baseUrl);
  await testBlastZone(baseUrl);
  await testKart(baseUrl);
  await testUnsupportedGameType(baseUrl);
  await testReconnect(baseUrl);
  await testEmptyRoomCleanup(baseUrl);
  await testFinlayBrosClear(baseUrl);
  await testFinlayBrosFail(baseUrl);
  console.log('smoke tests passed');
} finally {
  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve(undefined)));
  });
}

async function testHttp(baseUrl) {
  const health = await fetch(`${baseUrl}/health`).then((response) => response.json());
  assert.equal(health.status, 'ok');

  const leaderboard = await fetch(`${baseUrl}/api/leaderboard`).then((response) => response.json());
  assert.equal(Array.isArray(leaderboard.players), true);
}

async function testBlastZone(baseUrl) {
  const host = await connectClient(baseUrl);
  const guest = await connectClient(baseUrl);

  try {
    const created = await emitAck(host, 'room:create', { playerName: 'BlastHost', color: 'red' });
    await emitAck(host, 'lobby:updateSettings', { settings: { rounds: 1 } });
    await emitAck(guest, 'room:join', {
      roomCode: created.room.code,
      playerName: 'BlastGuest',
      color: 'blue',
    });

    const playing = waitForEvent(host, 'game:state', ({ state }) => (
      state.gameType === 'blast-zone' && state.phase === 'playing'
    ));
    const over = waitForEvent(host, 'game:over', ({ result }) => result.gameType === 'blast-zone', 5000);

    await emitAck(host, 'lobby:startGame');
    await playing;
    guest.disconnect();

    const gameOver = await over;
    assert.equal(gameOver.result.title, 'GAME OVER');
  } finally {
    await safeLeave(host);
    host.close();
    guest.close();
  }
}

async function testKart(baseUrl) {
  const host = await connectClient(baseUrl);

  try {
    const created = await emitAck(host, 'room:create', { playerName: 'KartHost', color: 'green' });
    await emitAck(host, 'lobby:updateSettings', {
      settings: { gameType: 'finlay-kart', rounds: 3 },
    });

    const stateEvent = waitForEvent(host, 'game:state', ({ state }) => (
      state.gameType === 'finlay-kart' && state.players.length === 4
    ));

    await emitAck(host, 'lobby:startGame');
    const firstState = await stateEvent;
    assert.equal(firstState.state.players.length, 4);
  } finally {
    await safeLeave(host);
    host.close();
  }
}

async function testUnsupportedGameType(baseUrl) {
  const host = await connectClient(baseUrl);

  try {
    await emitAck(host, 'room:create', { playerName: 'StrictHost', color: 'yellow' });
    const response = await emitAck(host, 'lobby:updateSettings', {
      settings: { gameType: 'broken-game' },
    }, { expectOk: false });
    assert.equal(response.ok, false);
  } finally {
    await safeLeave(host);
    host.close();
  }
}

async function testReconnect(baseUrl) {
  const host = await connectClient(baseUrl);
  const guest = await connectClient(baseUrl);
  let reconnected = null;

  try {
    const created = await emitAck(host, 'room:create', { playerName: 'ReHost', color: 'pink' });
    const joined = await emitAck(guest, 'room:join', {
      roomCode: created.room.code,
      playerName: 'ReGuest',
      color: 'cyan',
    });
    await emitAck(host, 'lobby:updateSettings', { settings: { gameType: 'finlay-bros' } });

    const playing = waitForEvent(host, 'game:state', ({ state }) => (
      state.gameType === 'finlay-bros' && state.phase === 'playing'
    ));

    await emitAck(host, 'lobby:startGame');
    await playing;
    guest.disconnect();
    await delay(150);

    reconnected = await connectClient(baseUrl);
    const response = await emitAck(reconnected, 'room:reconnect', {
      playerId: joined.playerId,
      roomCode: created.room.code,
    });

    assert.equal(response.room.state, 'playing');
    assert.equal(response.gameState?.gameType, 'finlay-bros');
  } finally {
    if (reconnected) {
      await safeLeave(reconnected);
      reconnected.close();
    }
    await safeLeave(host);
    host.close();
    guest.close();
  }
}

async function testEmptyRoomCleanup(baseUrl) {
  const host = await connectClient(baseUrl);
  const inspector = await connectClient(baseUrl);

  try {
    const created = await emitAck(host, 'room:create', { playerName: 'ExpiryHost', color: 'orange' });
    await emitAck(host, 'lobby:updateSettings', { settings: { gameType: 'finlay-bros' } });
    await emitAck(host, 'lobby:startGame');
    host.disconnect();

    await delay(10_500);

    const peek = await emitAck(inspector, 'room:peek', {
      roomCode: created.room.code,
    }, { expectOk: false });
    assert.equal(peek.ok, false);
  } finally {
    inspector.close();
    host.close();
  }
}

async function testFinlayBrosClear(baseUrl) {
  const engine = new FinlayBrosEngine([
    { id: 'bros-1', name: 'BrosHost', color: 'purple' },
  ], 240);

  engine.decrementCountdown();
  engine.decrementCountdown();
  engine.decrementCountdown();

  let now = 0;
  const player = engine.state.players[0];
  assert(player, 'Expected a Bros player');

  for (const checkpoint of engine.state.level.checkpoints) {
    player.pos.x = checkpoint.x + 8;
    player.pos.y = checkpoint.y + checkpoint.height - 28;
    now += 66;
    engine.tick(now);
    assert.equal(engine.state.teamCheckpoint >= checkpoint.id, true);
  }

  player.pos.x = engine.state.level.goal.x + 4;
  player.pos.y = engine.state.level.goal.y + engine.state.level.goal.height - 28;
  now += 66;
  engine.tick(now);

  assert.equal(engine.state.phase, 'gameOver');
  assert.equal(engine.state.outcome, 'cleared');
}

async function testFinlayBrosFail(baseUrl) {
  const engine = new FinlayBrosEngine([
    { id: 'bros-1', name: 'BrosFail', color: 'red' },
  ], 2);

  engine.decrementCountdown();
  engine.decrementCountdown();
  engine.decrementCountdown();
  engine.decrementTimer();
  engine.decrementTimer();

  assert.equal(engine.state.phase, 'gameOver');
  assert.equal(engine.state.outcome, 'failed');
}

async function connectClient(baseUrl) {
  const socket = io(baseUrl, {
    autoConnect: false,
    transports: ['websocket'],
  });

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('socket connect timeout')), 3000);
    socket.once('connect', () => {
      clearTimeout(timer);
      resolve(undefined);
    });
    socket.once('connect_error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    socket.connect();
  });

  return socket;
}

function waitForEvent(socket, event, predicate, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeoutMs);

    const onEvent = (payload) => {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      socket.off(event, onEvent);
      resolve(payload);
    };

    socket.on(event, onEvent);
  });
}

function emitAck(socket, event, data, options = { expectOk: true }) {
  return new Promise((resolve, reject) => {
    const callback = (response) => {
      if (options.expectOk && response.ok === false) {
        reject(new Error(response.error || `${event} failed`));
        return;
      }
      resolve(response);
    };

    if (data === undefined) {
      socket.emit(event, callback);
    } else {
      socket.emit(event, data, callback);
    }
  });
}

async function safeLeave(socket) {
  if (!socket.connected) return;
  socket.emit('room:leave');
  await delay(50);
}
