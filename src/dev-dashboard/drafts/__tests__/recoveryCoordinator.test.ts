import { describe, expect, it, vi } from 'vitest';
import type { PublishedContentPayload } from '@bemtevi/content-core';

import type { DraftBaseSnapshot } from '../draftTypes';
import type { DraftRecoveryRecord, LocalDraftCache } from '../../draft-storage/localDraftCache';
import {
  clearOwnRecoveryRecord,
  createRecoveryCoordinator,
  listRecoverableRecords,
  saveRecoveryRecord,
} from '../recoveryCoordinator';

const material = (title: string): PublishedContentPayload['educationMaterials'][number] =>
  ({ id: 'm1', title }) as unknown as PublishedContentPayload['educationMaterials'][number];

const payload = (title: string): PublishedContentPayload => ({
  flows: [],
  educationMaterials: [material(title)],
  educationGroups: [],
  contacts: [],
  locations: [],
  defaultGroupOrder: 0,
});

const base = (generation: number): DraftBaseSnapshot => ({
  id: 'current',
  schemaVersion: '1.0.0',
  baseRevision: 3,
  generation,
  digest: `dg-${generation}`,
  updatedAt: '2026-01-01T00:00:00Z',
  lastActor: { kind: 'admin', principalUserId: 'admin-a', connectionId: null },
  payload: payload('base'),
});

function fakeCache(): LocalDraftCache & {
  records: Map<string, DraftRecoveryRecord>;
  failSave: boolean;
  failList: boolean;
} {
  const records = new Map<string, DraftRecoveryRecord>();
  return {
    records,
    failSave: false,
    failList: false,
    async save(record) {
      if (this.failSave) return false;
      records.set(`${record.principalId}:${record.tabId}`, { ...record, key: `${record.principalId}:${record.tabId}` });
      return true;
    },
    async load(principalId, tabId) {
      const record = records.get(`${principalId}:${tabId}`);
      return { status: 'ok', record: record ?? null };
    },
    async list(principalId) {
      if (this.failList) return { status: 'unavailable' };
      return { status: 'ok', records: [...records.values()].filter((r) => r.principalId === principalId) };
    },
    async remove(principalId, tabId) {
      return records.delete(`${principalId}:${tabId}`);
    },
  };
}

const target = { principalId: 'admin-a', tabId: 'tab-1' };

describe('saveRecoveryRecord', () => {
  it('stores base generation/digest/payload and the local candidate under the tab key', async () => {
    const cache = fakeCache();
    const saved = await saveRecoveryRecord(cache, target, base(4), payload('local'), '2026-02-02T00:00:00Z');
    expect(saved).toBe(true);
    const record = cache.records.get('admin-a:tab-1');
    expect(record).toMatchObject({
      key: 'admin-a:tab-1',
      principalId: 'admin-a',
      tabId: 'tab-1',
      savedAt: '2026-02-02T00:00:00Z',
      baseGeneration: 4,
      baseDigest: 'dg-4',
      basePayload: payload('base'),
      localPayload: payload('local'),
    });
  });

  it('reports failure without throwing so memory stays intact', async () => {
    const cache = fakeCache();
    cache.failSave = true;
    await expect(saveRecoveryRecord(cache, target, base(1), payload('x'), 't')).resolves.toBe(false);
  });
});

describe('clearOwnRecoveryRecord', () => {
  it('removes only the current tab record', async () => {
    const cache = fakeCache();
    await saveRecoveryRecord(cache, target, base(1), payload('x'), 't');
    await saveRecoveryRecord(cache, { principalId: 'admin-a', tabId: 'tab-2' }, base(1), payload('y'), 't');
    await expect(clearOwnRecoveryRecord(cache, target)).resolves.toBe(true);
    expect(cache.records.has('admin-a:tab-1')).toBe(false);
    expect(cache.records.has('admin-a:tab-2')).toBe(true);
  });
});

describe('listRecoverableRecords', () => {
  it('returns only the same principal and never the current tab', async () => {
    const cache = fakeCache();
    await saveRecoveryRecord(cache, target, base(1), payload('x'), 't');
    await saveRecoveryRecord(cache, { principalId: 'admin-a', tabId: 'tab-2' }, base(2), payload('y'), 't2');
    await saveRecoveryRecord(cache, { principalId: 'admin-b', tabId: 'tab-3' }, base(3), payload('z'), 't3');
    const recoverable = await listRecoverableRecords(cache, target);
    expect(recoverable).toHaveLength(1);
    expect(recoverable[0]?.tabId).toBe('tab-2');
    expect(recoverable[0]?.localPayload).toEqual(payload('y'));
  });

  it('yields an empty list when the cache is unavailable', async () => {
    const cache = fakeCache();
    cache.failList = true;
    await expect(listRecoverableRecords(cache, target)).resolves.toEqual([]);
  });
});

describe('createRecoveryCoordinator', () => {
  it('uses the injected clock for savedAt and exposes the three operations', async () => {
    const cache = fakeCache();
    const now = vi.fn(() => Date.UTC(2026, 0, 15, 12, 0, 0));
    const recovery = createRecoveryCoordinator({ cache, principalId: 'admin-a', tabId: 'tab-9', now });
    await expect(recovery.save(base(8), payload('local'))).resolves.toBe(true);
    expect(cache.records.get('admin-a:tab-9')?.savedAt).toBe('2026-01-15T12:00:00.000Z');
    expect(recovery.listRecoverable()).resolves.toEqual([]);
    await expect(recovery.clear()).resolves.toBe(true);
    expect(cache.records.has('admin-a:tab-9')).toBe(false);
  });
});
