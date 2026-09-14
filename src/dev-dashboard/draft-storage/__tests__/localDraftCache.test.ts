import { describe, expect, it } from 'vitest';

import type { PublishedContentPayload } from '@bemtevi/content-core';

import {
  RECOVERY_DB_NAME,
  RECOVERY_DB_VERSION,
  RECOVERY_STORE_NAME,
  TAB_ID_STORAGE_KEY,
  createLocalDraftCache,
  getTabId,
  recoveryRecordKey,
  type DraftRecoveryRecordInput,
} from '../localDraftCache';

// --- Minimal in-memory IndexedDB fake (enough for this cache) ----------------

type FakeRecord = Record<string, unknown>;

class FakeRequest<T> {
  result: T;
  onsuccess: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(
    result: T,
    private readonly fail: boolean,
  ) {
    this.result = result;
  }
  emit(): void {
    if (this.fail) this.onerror?.();
    else this.onsuccess?.();
  }
}

class FakeObjectStore {
  constructor(
    private readonly records: Map<string, FakeRecord>,
    private readonly failWrites: boolean,
  ) {}
  private request<T>(value: T, fail = false): FakeRequest<T> {
    const request = new FakeRequest(value, fail);
    queueMicrotask(() => request.emit());
    return request;
  }
  put(value: FakeRecord): FakeRequest<IDBValidKey> {
    const key = String(value.key);
    const request = new FakeRequest<IDBValidKey>(key, this.failWrites);
    queueMicrotask(() => {
      if (!this.failWrites) this.records.set(key, { ...value });
      request.emit();
    });
    return request;
  }
  get(key: string): FakeRequest<FakeRecord | undefined> {
    return this.request(this.records.get(key));
  }
  getAll(): FakeRequest<FakeRecord[]> {
    return this.request([...this.records.values()]);
  }
  delete(key: string): FakeRequest<undefined> {
    const request = new FakeRequest<undefined>(undefined, this.failWrites);
    queueMicrotask(() => {
      if (!this.failWrites) this.records.delete(key);
      request.emit();
    });
    return request;
  }
}

class FakeDatabase {
  readonly objectStoreNames = { contains: (name: string) => name === RECOVERY_STORE_NAME };
  constructor(
    private readonly records: Map<string, FakeRecord>,
    private readonly failWrites = false,
  ) {}
  transaction(_name: string, _mode: IDBTransactionMode) {
    const store = new FakeObjectStore(this.records, this.failWrites);
    return { objectStore: () => store, onabort: null as (() => void) | null, onerror: null as (() => void) | null };
  }
  close(): void {}
}

function createFakeFactory(options: { failOpen?: boolean; failWrites?: boolean } = {}): {
  factory: IDBFactory;
  records: Map<string, FakeRecord>;
} {
  const records = new Map<string, FakeRecord>();
  const factory = {
    open(_name: string, _version: number): FakeRequest<FakeDatabase> {
      const request = new FakeRequest<FakeDatabase>(
        new FakeDatabase(records, options.failWrites),
        options.failOpen === true,
      );
      queueMicrotask(() => request.emit());
      return request;
    },
  } as unknown as IDBFactory;
  return { factory, records };
}

// --- Fixtures ----------------------------------------------------------------

const BASE_PAYLOAD: PublishedContentPayload = {
  flows: [],
  educationMaterials: [],
  educationGroups: [],
  contacts: [],
  locations: [],
  defaultGroupOrder: 3,
};

const LOCAL_PAYLOAD: PublishedContentPayload = {
  ...BASE_PAYLOAD,
  defaultGroupOrder: 7,
};

const DIGEST = 'a'.repeat(64);

function recordInput(overrides: Partial<DraftRecoveryRecordInput> = {}): DraftRecoveryRecordInput {
  return {
    principalId: 'principal-a',
    tabId: 'tab-1',
    savedAt: '2026-09-12T10:00:00.000Z',
    baseGeneration: 5,
    baseDigest: DIGEST,
    basePayload: BASE_PAYLOAD,
    localPayload: LOCAL_PAYLOAD,
    ...overrides,
  };
}

// --- Tests -------------------------------------------------------------------

describe('getTabId', () => {
  it('persists a fresh tab id and reuses it', () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    };
    let calls = 0;
    const uuid = () => {
      calls += 1;
      return `uuid-${calls}`;
    };
    const first = getTabId(storage, uuid);
    expect(first).toBe('uuid-1');
    expect(store.get(TAB_ID_STORAGE_KEY)).toBe('uuid-1');
    expect(getTabId(storage, uuid)).toBe('uuid-1');
    expect(calls).toBe(1);
  });

  it('generates an id even when storage is unavailable', () => {
    expect(getTabId(null, () => 'fallback-id')).toBe('fallback-id');
  });
});

describe('createLocalDraftCache', () => {
  it('round-trips a record retaining digest/base fields', async () => {
    const { factory } = createFakeFactory();
    const cache = createLocalDraftCache({ indexedDB: factory });
    expect(await cache.save(recordInput())).toBe(true);
    const lookup = await cache.load('principal-a', 'tab-1');
    expect(lookup).toEqual({
      status: 'ok',
      record: { key: recoveryRecordKey('principal-a', 'tab-1'), ...recordInput() },
    });
  });

  it('never writes token or preparation secrets into the stored record', async () => {
    const { factory, records } = createFakeFactory();
    const cache = createLocalDraftCache({ indexedDB: factory });
    const tainted = Object.assign(recordInput(), {
      preparationToken: 'raw-token',
      publishToken: 'raw-publish',
      tokenHash: 'b'.repeat(64),
    });
    await cache.save(tainted);
    const lookup = await cache.load('principal-a', 'tab-1');
    expect(lookup.status).toBe('ok');
    if (lookup.status !== 'ok' || lookup.record === null) throw new Error('expected record');
    const stored = JSON.stringify(lookup.record);
    expect(stored).not.toContain('raw-token');
    expect(stored).not.toContain('raw-publish');
    expect('tokenHash' in lookup.record).toBe(false);
    expect(Object.keys(records.get(recoveryRecordKey('principal-a', 'tab-1')) ?? {}).sort()).toEqual([
      'baseDigest',
      'baseGeneration',
      'basePayload',
      'key',
      'localPayload',
      'principalId',
      'savedAt',
      'tabId',
    ]);
  });

  it('isolates records per principal and per tab', async () => {
    const { factory } = createFakeFactory();
    const cache = createLocalDraftCache({ indexedDB: factory });
    await cache.save(recordInput({ principalId: 'principal-a', tabId: 'tab-1', baseGeneration: 1 }));
    await cache.save(recordInput({ principalId: 'principal-a', tabId: 'tab-2', baseGeneration: 2 }));
    await cache.save(recordInput({ principalId: 'principal-b', tabId: 'tab-1', baseGeneration: 3 }));

    expect((await cache.load('principal-a', 'tab-1')).status).toBe('ok');
    const own = await cache.load('principal-a', 'tab-1');
    expect(own.status === 'ok' && own.record?.baseGeneration).toBe(1);
    const otherTab = await cache.load('principal-a', 'tab-2');
    expect(otherTab.status === 'ok' && otherTab.record?.baseGeneration).toBe(2);
    const otherPrincipal = await cache.load('principal-b', 'tab-1');
    expect(otherPrincipal.status === 'ok' && otherPrincipal.record?.baseGeneration).toBe(3);

    const listA = await cache.list('principal-a');
    expect(listA.status).toBe('ok');
    if (listA.status !== 'ok') throw new Error('unreachable');
    expect(listA.records.map((r) => r.tabId).sort()).toEqual(['tab-1', 'tab-2']);
    const listB = await cache.list('principal-b');
    if (listB.status !== 'ok') throw new Error('unreachable');
    expect(listB.records.map((r) => r.principalId)).toEqual(['principal-b']);
    const listC = await cache.list('principal-c');
    if (listC.status !== 'ok') throw new Error('unreachable');
    expect(listC.records).toEqual([]);
  });

  it('removes only the current tab record', async () => {
    const { factory } = createFakeFactory();
    const cache = createLocalDraftCache({ indexedDB: factory });
    await cache.save(recordInput({ tabId: 'tab-1' }));
    await cache.save(recordInput({ tabId: 'tab-2' }));
    expect(await cache.remove('principal-a', 'tab-1')).toBe(true);
    const removed = await cache.load('principal-a', 'tab-1');
    expect(removed.status === 'ok' && removed.record).toBeNull();
    const kept = await cache.load('principal-a', 'tab-2');
    expect(kept.status === 'ok' && kept.record !== null).toBe(true);
  });

  it('reports unavailable operations when IndexedDB is missing', async () => {
    const cache = createLocalDraftCache({ indexedDB: null });
    expect(await cache.save(recordInput())).toBe(false);
    expect(await cache.load('principal-a', 'tab-1')).toEqual({ status: 'unavailable' });
    expect(await cache.list('principal-a')).toEqual({ status: 'unavailable' });
    expect(await cache.remove('principal-a', 'tab-1')).toBe(false);
  });

  it('reports unavailable operations when opening the database fails', async () => {
    const { factory } = createFakeFactory({ failOpen: true });
    const cache = createLocalDraftCache({ indexedDB: factory });
    expect(await cache.save(recordInput())).toBe(false);
    expect(await cache.load('principal-a', 'tab-1')).toEqual({ status: 'unavailable' });
    expect(await cache.list('principal-a')).toEqual({ status: 'unavailable' });
  });

  it('reports failed writes without throwing', async () => {
    const { factory } = createFakeFactory({ failWrites: true });
    const cache = createLocalDraftCache({ indexedDB: factory });
    expect(await cache.save(recordInput())).toBe(false);
    expect(await cache.remove('principal-a', 'tab-1')).toBe(false);
    const lookup = await cache.load('principal-a', 'tab-1');
    expect(lookup.status).toBe('ok');
  });

  it('opens the frozen recovery database name and version', async () => {
    const opens: Array<[string, number]> = [];
    const records = new Map<string, FakeRecord>();
    const factory = {
      open(name: string, version: number): FakeRequest<FakeDatabase> {
        opens.push([name, version]);
        const request = new FakeRequest<FakeDatabase>(new FakeDatabase(records), false);
        queueMicrotask(() => request.emit());
        return request;
      },
    } as unknown as IDBFactory;
    const cache = createLocalDraftCache({ indexedDB: factory });
    await cache.save(recordInput());
    expect(opens).toEqual([[RECOVERY_DB_NAME, RECOVERY_DB_VERSION]]);
  });
});
