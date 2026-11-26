// A WebSocket that looks after itself.
//
// The old client stopped retrying after five attempts (ten seconds), so a
// phone that slept through a hand stayed on a stale table until the page was
// refreshed. This one never gives up, notices sockets that have gone quiet,
// and asks for a fresh snapshot whenever the page comes back to the front.

const PING_EVERY_MS = 12000;      // app-level heartbeat
const STALE_AFTER_MS = 30000;     // no message for this long => socket is dead
const RESYNC_EVERY_MS = 20000;    // safety-net snapshot while the page is visible
const BACKOFF_BASE_MS = 500;
const BACKOFF_MAX_MS = 8000;

/**
 * @param {object} options
 * @param {() => object[]} options.hello    messages to send as soon as the socket opens
 * @param {() => object[]} options.resync   messages that ask the server for a fresh snapshot
 * @param {(message: object) => void} options.onMessage
 * @param {(status: 'connecting'|'live'|'reconnecting'|'offline') => void} options.onStatus
 */
export function createConnection({ hello, resync, onMessage, onStatus }) {
  let socket = null;
  let attempts = 0;
  let retryTimer = null;
  let lastMessageAt = 0;
  let everLive = false;
  let disposed = false;
  let status = 'connecting';

  const setStatus = (next) => {
    if (next === status) return;
    status = next;
    onStatus(next);
  };

  const isOpen = () => socket !== null && socket.readyState === WebSocket.OPEN;

  const rawSend = (message) => {
    if (!isOpen()) return false;
    try {
      socket.send(JSON.stringify(message));
      return true;
    } catch {
      return false;
    }
  };

  function connect() {
    if (disposed) return;
    clearTimeout(retryTimer);
    retryTimer = null;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}`);
    socket = ws;
    setStatus(everLive ? 'reconnecting' : 'connecting');

    ws.onopen = () => {
      if (socket !== ws) return;
      lastMessageAt = Date.now();
      // Tell listeners a new session started so they can drop version checks.
      onMessage({ type: '@open' });
      for (const message of hello()) rawSend(message);
    };

    ws.onmessage = (event) => {
      if (socket !== ws) return;
      lastMessageAt = Date.now();
      attempts = 0;
      everLive = true;
      setStatus('live');
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      if (message.type !== 'pong') onMessage(message);
    };

    ws.onclose = () => {
      if (socket !== ws) return; // an older socket closing late must not disturb the current one
      socket = null;
      scheduleReconnect();
    };

    ws.onerror = () => {
      // 'close' always follows; reconnect is handled there.
    };
  }

  function scheduleReconnect() {
    if (disposed || retryTimer) return;
    setStatus(navigator.onLine === false ? 'offline' : 'reconnecting');
    const delay = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** attempts) * (0.75 + Math.random() * 0.5);
    attempts += 1;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      connect();
    }, delay);
  }

  function reconnectNow() {
    if (disposed) return;
    clearTimeout(retryTimer);
    retryTimer = null;
    attempts = 0;
    if (socket) {
      const old = socket;
      socket = null;
      old.onclose = null;
      try { old.close(); } catch { /* already closed */ }
    }
    connect();
  }

  /** Ask for a fresh snapshot, reconnecting first if the socket is gone or quiet. */
  function syncNow() {
    if (disposed) return;
    const quiet = Date.now() - lastMessageAt > STALE_AFTER_MS;
    if (!isOpen() || quiet) {
      reconnectNow();
      return;
    }
    for (const message of resync()) rawSend(message);
  }

  const watchdog = setInterval(() => {
    if (disposed || !isOpen()) return;
    if (Date.now() - lastMessageAt > STALE_AFTER_MS) {
      reconnectNow();
    }
  }, 5000);

  const pinger = setInterval(() => {
    if (document.visibilityState === 'visible') rawSend({ type: 'ping' });
  }, PING_EVERY_MS);

  const resyncer = setInterval(() => {
    if (document.visibilityState === 'visible' && isOpen()) {
      for (const message of resync()) rawSend(message);
    }
  }, RESYNC_EVERY_MS);

  const onVisible = () => {
    if (document.visibilityState === 'visible') syncNow();
  };
  const onOnline = () => reconnectNow();
  const onOffline = () => setStatus('offline');
  const onPageShow = (event) => {
    if (event.persisted) reconnectNow(); // restored from the back/forward cache
  };

  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', onVisible);
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  window.addEventListener('pageshow', onPageShow);

  connect();

  return {
    /** Returns false when the message could not be sent (not connected). */
    send: rawSend,
    syncNow,
    close() {
      disposed = true;
      clearInterval(watchdog);
      clearInterval(pinger);
      clearInterval(resyncer);
      clearTimeout(retryTimer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('pageshow', onPageShow);
      if (socket) {
        socket.onclose = null;
        try { socket.close(); } catch { /* already closed */ }
      }
    },
  };
}
