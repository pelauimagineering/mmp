// Regression tests for the "client goes out of sync until you refresh" bug.
// Starts the real server on a scratch copy of the database and talks to it
// over HTTP and WebSocket, the way a phone does.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const WebSocket = require('ws');

const ROOT = path.join(__dirname, '..');
const PORT = 3900 + Math.floor(Math.random() * 90);
const BASE = `http://127.0.0.1:${PORT}`;
let server;
let dbCopy;
const opened = new Set();

async function login(userId, displayName) {
  const response = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, displayName }),
    redirect: 'manual',
  });
  const cookie = response.headers.get('set-cookie') || '';
  const token = /sessionToken=([^;]+)/.exec(cookie)?.[1];
  assert.ok(token, 'login should set a session cookie');
  return token;
}

/** Opens a socket and collects everything it receives. */
function open(hello) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}`);
    opened.add(ws);
    const inbox = [];
    const waiters = [];
    ws.on('message', (raw) => {
      const message = JSON.parse(raw);
      inbox.push(message);
      waiters.splice(0).forEach((check) => check());
    });
    ws.on('error', reject);
    ws.on('open', () => {
      ws.send(JSON.stringify(hello));
      resolve({
        ws,
        inbox,
        send: (message) => ws.send(JSON.stringify(message)),
        /** Resolves with the first message (after `from`) matching the predicate. */
        next(predicate, from = 0, timeoutMs = 2000) {
          return new Promise((res, rej) => {
            const timer = setTimeout(() => rej(new Error('timed out waiting for message')), timeoutMs);
            const check = () => {
              const found = inbox.slice(from).find(predicate);
              if (found) {
                clearTimeout(timer);
                res(found);
              } else {
                waiters.push(check);
              }
            };
            check();
          });
        },
      });
    });
  });
}

const isState = (message) => message.type === 'game-state';

before(async () => {
  const source = path.join(ROOT, 'database', 'poker-dealer.db');
  dbCopy = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mmp-poker-')), 'test.db');
  fs.copyFileSync(source, dbCopy);
  server = spawn(process.execPath, ['server/index.js', '--reset'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), DATABASE_PATH: dbCopy },
    stdio: 'ignore',
  });
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`${BASE}/api/health`);
      if (response.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('server did not start');
});

after(() => {
  for (const ws of opened) ws.terminate();
  server?.kill();
});

test('a reconnect that overlaps the old socket keeps receiving game state', async () => {
  const gary = await login(1, 'Gary');
  const dee = await login(9, 'Dee');

  const deeSocket = await open({ type: 'auth', token: dee });
  await deeSocket.next(isState);

  // Gary's phone wakes up and opens a new socket before the old one has closed.
  const garyOld = await open({ type: 'auth', token: gary });
  await garyOld.next(isState);
  const garyNew = await open({ type: 'auth', token: gary });
  await garyNew.next(isState);

  // The stale socket finally closes. This used to evict the new one.
  garyOld.ws.close();
  await new Promise((resolve) => setTimeout(resolve, 150));

  const seenBefore = garyNew.inbox.length;
  deeSocket.send({ type: 'join-game', token: dee });

  const update = await garyNew.next(isState, seenBefore);
  assert.deepEqual(update.data.players.map((player) => player.name), ['Dee']);

  deeSocket.ws.close();
  garyNew.ws.close();
});

test('two devices on the same seat both stay live', async () => {
  const token = await login(5, 'Tony');
  const phone = await open({ type: 'auth', token });
  const laptop = await open({ type: 'auth', token });
  await phone.next(isState);
  await laptop.next(isState);

  const phoneSeen = phone.inbox.length;
  const laptopSeen = laptop.inbox.length;
  phone.send({ type: 'join-game', token });

  const [onPhone, onLaptop] = await Promise.all([phone.next(isState, phoneSeen), laptop.next(isState, laptopSeen)]);
  assert.ok(onPhone.data.players.some((player) => player.name === 'Tony'));
  assert.equal(onPhone.data.version, onLaptop.data.version);

  phone.ws.close();
  laptop.ws.close();
});

test('snapshots carry a rising version and the server clock', async () => {
  const token = await login(2, 'Neave');
  const socket = await open({ type: 'auth', token });
  const first = await socket.next(isState);
  assert.equal(typeof first.data.version, 'number');
  assert.ok(Math.abs(first.data.serverTime - Date.now()) < 5000);

  const seen = socket.inbox.length;
  socket.send({ type: 'join-game', token });
  const second = await socket.next(isState, seen);
  assert.ok(second.data.version > first.data.version);

  // A pull returns the current version without bumping it.
  const seenAgain = socket.inbox.length;
  socket.send({ type: 'get-state', token });
  const pulled = await socket.next(isState, seenAgain);
  assert.equal(pulled.data.version, second.data.version);

  socket.ws.close();
});

test('the app-level heartbeat answers without a session', async () => {
  const socket = await open({ type: 'ping' });
  const pong = await socket.next((message) => message.type === 'pong');
  assert.equal(typeof pong.serverTime, 'number');
  socket.ws.close();
});

test('the public board gets seats, and never hole cards', async () => {
  const board = await open({ type: 'auth-public', view: 'community' });
  const snapshot = await board.next((message) => message.type === 'community-state');
  assert.ok(Array.isArray(snapshot.data.players));
  assert.ok(snapshot.data.players.length >= 1);
  assert.equal(snapshot.data.holeCards, undefined);
  assert.equal(typeof snapshot.data.version, 'number');
  board.ws.close();
});

test('an expired session is reported with a code the client can act on', async () => {
  const socket = await open({ type: 'auth', token: 'not-a-real-token' });
  const error = await socket.next((message) => message.type === 'error');
  assert.equal(error.code, 'session-expired');
  socket.ws.close();
});
