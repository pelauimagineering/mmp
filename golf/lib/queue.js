// Offline write queue, backed by IndexedDB.
//
// score-entry.html calls put(payload) every time the user hits Save.
// A sync routine drains the queue with list() / delete(id) whenever
// the network is up. Idempotent on the server side (upserts keyed on
// round_id + player_id), so re-sending a stale payload is harmless.
//
// LocalStorage would also fit ~12 rounds easily, but IDB is the right
// tool: async, larger quota, structured records.

const DB_NAME = 'mmp-golf';
const DB_VERSION = 1;
const STORE = 'pending_rounds';

const open = () =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const tx = async (mode, fn) => {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    let result;
    Promise.resolve(fn(store)).then((r) => { result = r; });
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
};

export const queue = {
  /** Append payload, return its assigned id. */
  put: (payload) =>
    tx('readwrite', (store) =>
      new Promise((resolve, reject) => {
        const req = store.add({ payload, queued_at: Date.now() });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
    ),

  /** All pending entries, oldest first. */
  list: () =>
    tx('readonly', (store) =>
      new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
    ),

  /** Remove a single entry by id. */
  delete: (id) =>
    tx('readwrite', (store) =>
      new Promise((resolve, reject) => {
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      })
    ),

  /** Total entries pending. */
  count: () =>
    tx('readonly', (store) =>
      new Promise((resolve, reject) => {
        const req = store.count();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
    ),
};
