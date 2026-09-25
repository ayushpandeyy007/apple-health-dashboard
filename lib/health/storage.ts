import type { HealthSummary } from "./types";

// The processed summary lives in this browser's IndexedDB - nothing is uploaded anywhere.
const DB_NAME = "pulse-health";
const STORE = "data";
const KEY = "summary";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = op(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function loadSummary(): Promise<HealthSummary | null> {
  try {
    const value = await run<HealthSummary | undefined>("readonly", (s) => s.get(KEY));
    return value?.version === 1 ? value : null;
  } catch {
    return null;
  }
}

/** Returns false when storage is unavailable (e.g. a private window); the app still works for the session. */
export async function saveSummary(summary: HealthSummary): Promise<boolean> {
  try {
    await run("readwrite", (s) => s.put(summary, KEY));
    return true;
  } catch {
    return false;
  }
}

export async function clearSummary(): Promise<void> {
  try {
    await run("readwrite", (s) => s.delete(KEY));
  } catch {
    // Nothing stored.
  }
}
