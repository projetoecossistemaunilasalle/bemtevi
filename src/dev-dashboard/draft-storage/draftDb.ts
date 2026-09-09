import type { DashboardDraftState } from './dashboardStorage';

const DB_NAME = 'bemtevi_dashboard_db';
const DB_VERSION = 1;
const STORE_NAME = 'drafts';
const DRAFT_RECORD_KEY = 'current_draft';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB is not available in this environment.'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB.'));
  });
}

export async function saveDraftToIndexedDb(state: DashboardDraftState): Promise<void> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const record = { key: DRAFT_RECORD_KEY, state, savedAt: Date.now() };
      const req = store.put(record);

      req.onerror = () => reject(req.error ?? new Error('Failed to write draft to IndexedDB.'));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Transaction failed.'));
      tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted.'));
    });
  } finally {
    db.close();
  }
}

export async function loadDraftFromIndexedDb(): Promise<DashboardDraftState | null> {
  try {
    const db = await openDatabase();
    try {
      return await new Promise<DashboardDraftState | null>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(DRAFT_RECORD_KEY);

        tx.oncomplete = () => {
          const result = req.result as { key: string; state: DashboardDraftState } | undefined;
          resolve(result ? result.state : null);
        };
        req.onerror = () => reject(req.error ?? new Error('Failed to read draft from IndexedDB.'));
        tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted.'));
        tx.onerror = () => reject(tx.error ?? new Error('Transaction failed.'));
      });
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

export async function clearDraftFromIndexedDb(): Promise<void> {
  const db = await openDatabase();
  try {
    return await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(DRAFT_RECORD_KEY);

      req.onerror = () => reject(req.error ?? new Error('Failed to clear draft from IndexedDB.'));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Transaction failed.'));
      tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted.'));
    });
  } finally {
    db.close();
  }
}
