import type { Counter, Digest, PublishedContentPayload } from '@bemtevi/content-core';

/**
 * Principal/tab-isolated IndexedDB recovery cache for the canonical editor
 * (dossier doc 16, "IndexedDB Recovery"). Database `bemtevi-editor-v2`,
 * version 1, object store `recovery`, keyPath `key`. The key is
 * `${principalId}:${tabId}`; the tab id is a random UUID kept in
 * sessionStorage. No capability/preparation token or other secret is ever
 * stored. IndexedDB failure never throws to callers: it surfaces as
 * `unavailable` / `false` so memory stays intact and `cacheAvailable=false`.
 */

export const RECOVERY_DB_NAME = 'bemtevi-editor-v2';
export const RECOVERY_DB_VERSION = 1;
export const RECOVERY_STORE_NAME = 'recovery';
export const TAB_ID_STORAGE_KEY = 'bemtevi:editor-v2:tab-id';

export interface DraftRecoveryRecord {
  key: string;
  principalId: string;
  tabId: string;
  savedAt: string;
  baseGeneration: Counter;
  baseDigest: Digest;
  basePayload: PublishedContentPayload;
  localPayload: PublishedContentPayload;
}

export type DraftRecoveryRecordInput = Omit<DraftRecoveryRecord, 'key'>;

export type CacheLookup = { status: 'ok'; record: DraftRecoveryRecord | null } | { status: 'unavailable' };

export type CacheListResult = { status: 'ok'; records: DraftRecoveryRecord[] } | { status: 'unavailable' };

export interface LocalDraftCache {
  /** Writes the caller's own record (key derives from principal+tab). */
  save(record: DraftRecoveryRecordInput): Promise<boolean>;
  /** Reads the current tab's own record for a principal. */
  load(principalId: string, tabId: string): Promise<CacheLookup>;
  /** Lists the current principal's records across tabs. */
  list(principalId: string): Promise<CacheListResult>;
  /** Deletes only the current tab's record. */
  remove(principalId: string, tabId: string): Promise<boolean>;
}

export interface LocalDraftCacheOptions {
  indexedDB?: IDBFactory | null;
  sessionStorage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  uuid?: () => string;
}

export function recoveryRecordKey(principalId: string, tabId: string): string {
  return `${principalId}:${tabId}`;
}

function createUuid(uuid: (() => string) | undefined): string {
  if (uuid) return uuid();
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `tab-${Date.now().toString(16)}-${Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString(16)}`;
}

/** Returns (creating and persisting once) this tab's stable recovery id. */
export function getTabId(
  storage: Pick<Storage, 'getItem' | 'setItem'> | null = typeof sessionStorage === 'undefined' ? null : sessionStorage,
  uuid?: () => string,
): string {
  const existing = storage?.getItem(TAB_ID_STORAGE_KEY);
  if (existing !== null && existing !== undefined && existing !== '') return existing;
  const tabId = createUuid(uuid);
  try {
    storage?.setItem(TAB_ID_STORAGE_KEY, tabId);
  } catch {
    // Persistence is best-effort; without it the id stays per-page only.
  }
  return tabId;
}

function openRecoveryDb(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(RECOVERY_DB_NAME, RECOVERY_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(RECOVERY_STORE_NAME)) {
        db.createObjectStore(RECOVERY_STORE_NAME, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open the recovery database.'));
    request.onblocked = () => reject(new Error('Recovery database open was blocked.'));
  });
}

type StoreAction<T> = (store: IDBObjectStore) => IDBRequest<T>;

function runStoreAction<T>(db: IDBDatabase, mode: IDBTransactionMode, action: StoreAction<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RECOVERY_STORE_NAME, mode);
    const request = action(tx.objectStore(RECOVERY_STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Recovery store request failed.'));
    tx.onabort = () => reject(tx.error ?? new Error('Recovery transaction aborted.'));
  });
}

/**
 * The stored record is rebuilt field by field so any extra property on the
 * input object (e.g. a leaked preparation/publish token) is never persisted.
 */
function toStoredRecord(input: DraftRecoveryRecordInput): DraftRecoveryRecord {
  return {
    key: recoveryRecordKey(input.principalId, input.tabId),
    principalId: input.principalId,
    tabId: input.tabId,
    savedAt: input.savedAt,
    baseGeneration: input.baseGeneration,
    baseDigest: input.baseDigest,
    basePayload: input.basePayload,
    localPayload: input.localPayload,
  };
}

function isStoredRecord(value: unknown): value is DraftRecoveryRecord {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Partial<DraftRecoveryRecord>;
  return (
    typeof record.key === 'string' &&
    typeof record.principalId === 'string' &&
    typeof record.tabId === 'string' &&
    typeof record.savedAt === 'string' &&
    typeof record.baseGeneration === 'number' &&
    typeof record.baseDigest === 'string' &&
    typeof record.basePayload === 'object' &&
    record.basePayload !== null &&
    typeof record.localPayload === 'object' &&
    record.localPayload !== null
  );
}

export function createLocalDraftCache(options: LocalDraftCacheOptions = {}): LocalDraftCache {
  const factory = options.indexedDB ?? (typeof indexedDB === 'undefined' ? null : indexedDB);

  type StoreOutcome<T> = { ok: true; value: T } | { ok: false };

  async function withStore<T>(mode: IDBTransactionMode, action: StoreAction<T>): Promise<StoreOutcome<T>> {
    if (!factory) return { ok: false };
    let db: IDBDatabase;
    try {
      db = await openRecoveryDb(factory);
    } catch {
      return { ok: false };
    }
    try {
      return { ok: true, value: await runStoreAction(db, mode, action) };
    } catch {
      return { ok: false };
    } finally {
      db.close();
    }
  }

  return {
    async save(record) {
      const stored = toStoredRecord(record);
      const outcome = await withStore('readwrite', (store) => store.put(stored));
      return outcome.ok;
    },

    async load(principalId, tabId) {
      const outcome = await withStore('readonly', (store) => store.get(recoveryRecordKey(principalId, tabId)));
      if (!outcome.ok) return { status: 'unavailable' };
      const raw = outcome.value;
      if (raw === undefined) return { status: 'ok', record: null };
      if (!isStoredRecord(raw)) return { status: 'unavailable' };
      return { status: 'ok', record: raw };
    },

    async list(principalId) {
      const outcome = await withStore('readonly', (store) => store.getAll());
      if (!outcome.ok) return { status: 'unavailable' };
      const raw = outcome.value;
      const records = (Array.isArray(raw) ? raw : []).filter(
        (item): item is DraftRecoveryRecord => isStoredRecord(item) && item.principalId === principalId,
      );
      return { status: 'ok', records };
    },

    async remove(principalId, tabId) {
      const outcome = await withStore('readwrite', (store) => store.delete(recoveryRecordKey(principalId, tabId)));
      return outcome.ok;
    },
  };
}
