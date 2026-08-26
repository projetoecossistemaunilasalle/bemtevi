import { describe, expect, it, beforeEach, vi } from 'vitest';
import { saveDraftToIndexedDb, loadDraftFromIndexedDb, clearDraftFromIndexedDb } from '../draft-storage/draftDb';
import { createEmptyDashboardDraftState } from '../draft-storage/dashboardStorage';

describe('draftDb', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('handles missing indexedDB environment gracefully without throwing', async () => {
    const originalIndexedDb = globalThis.indexedDB;
    delete (globalThis as { indexedDB?: unknown }).indexedDB;

    try {
      const state = createEmptyDashboardDraftState();
      await expect(saveDraftToIndexedDb(state)).resolves.toBeUndefined();
      await expect(loadDraftFromIndexedDb()).resolves.toBeNull();
      await expect(clearDraftFromIndexedDb()).resolves.toBeUndefined();
    } finally {
      globalThis.indexedDB = originalIndexedDb;
    }
  });

  it('saves, loads, and clears drafts using mock indexedDB interface', async () => {
    const storeMap = new Map<string, unknown>();

    const mockStore = {
      put: vi.fn((record: { key: string; state: unknown }) => {
        storeMap.set(record.key, record);
        const req = { onsuccess: null as (() => void) | null, onerror: null };
        setTimeout(() => req.onsuccess?.(), 0);
        return req;
      }),
      get: vi.fn((key: string) => {
        const result = storeMap.get(key);
        const req = {
          result,
          onsuccess: null as (() => void) | null,
          onerror: null,
        };
        setTimeout(() => req.onsuccess?.(), 0);
        return req;
      }),
      delete: vi.fn((key: string) => {
        storeMap.delete(key);
        const req = { onsuccess: null as (() => void) | null, onerror: null };
        setTimeout(() => req.onsuccess?.(), 0);
        return req;
      }),
    };

    const mockTransaction = {
      objectStore: vi.fn(() => mockStore),
      oncomplete: null as (() => void) | null,
      onerror: null,
    };

    const mockDb = {
      objectStoreNames: { contains: () => true },
      transaction: vi.fn(() => {
        setTimeout(() => mockTransaction.oncomplete?.(), 0);
        return mockTransaction;
      }),
      close: vi.fn(),
    };

    const mockOpenRequest = {
      result: mockDb,
      onsuccess: null as (() => void) | null,
      onerror: null,
      onupgradeneeded: null,
    };

    const mockIndexedDb = {
      open: vi.fn(() => {
        setTimeout(() => mockOpenRequest.onsuccess?.(), 0);
        return mockOpenRequest;
      }),
    };

    // @ts-expect-error injecting mock
    globalThis.indexedDB = mockIndexedDb;

    const draft = {
      ...createEmptyDashboardDraftState(),
      updatedAt: '2026-08-26T12:00:00.000Z',
    };

    await saveDraftToIndexedDb(draft);
    expect(mockStore.put).toHaveBeenCalledWith(expect.objectContaining({ key: 'current_draft', state: draft }));

    const loaded = await loadDraftFromIndexedDb();
    expect(loaded).toEqual(draft);

    await clearDraftFromIndexedDb();
    expect(mockStore.delete).toHaveBeenCalledWith('current_draft');
  });
});
