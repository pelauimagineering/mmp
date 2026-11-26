// Offline write queue, backed by IndexedDB.
//
// The entry pages call put(payload) every time the user hits Save.
// A sync routine drains the queue with list() / delete(id) whenever
// the network is up. Idempotent on the server side (upserts keyed on
// natural ids), so re-sending a stale payload is harmless.
//
// LocalStorage would also fit ~12 rounds easily, but IDB is the right
// tool: async, larger quota, structured records.

const DB_VERSION = 1;
const STORE = 'pending_rounds';

// One database per sport, so the golf form never drains a poker night
// through the golf RPC (and vice versa).
export function createQueue(dbName) {
  // Opened once and reused: the sync timer touches the queue every 30s.
  let dbPromise = null;
  const open = () =>
    (dbPromise ??= new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName, DB_VERSION);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => { dbPromise = null; reject(req.error); };
    }));

  // Run one request in its own transaction; resolve with its result once
  // the transaction has committed.
  const run = async (mode, request) => {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const req = request(t.objectStore(STORE));
      t.oncomplete = () => resolve(req.result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  };

  return {
    /** Append payload, return its assigned id. */
    put: (payload) => run('readwrite', (store) => store.add({ payload, queued_at: Date.now() })),
    /** All pending entries, oldest first. */
    list: () => run('readonly', (store) => store.getAll()),
    /** Remove a single entry by id. */
    delete: (id) => run('readwrite', (store) => store.delete(id)),
    /** Total entries pending. */
    count: () => run('readonly', (store) => store.count()),
  };
}

export const queue = createQueue('mmp-golf');
