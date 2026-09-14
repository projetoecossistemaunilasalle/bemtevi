import { describe, expect, it } from 'vitest';

import { sha256Text } from '@bemtevi/content-core';
import type { ContentDraft, DraftHead, EditorialError, PublishedContentPayload, Result } from '@bemtevi/content-core';

import type { DraftRepository } from '../draftRepository';
import { initializeDraft } from '../draftInitialization';
import type { LocalDraftCache, DraftRecoveryRecordInput } from '../../draft-storage/localDraftCache';

// --- Fixtures ----------------------------------------------------------------

const PAYLOAD: PublishedContentPayload = {
  flows: [],
  educationMaterials: [],
  educationGroups: [],
  contacts: [],
  locations: [],
  defaultGroupOrder: 2,
};

async function draftFixture(overrides: Partial<ContentDraft> = {}): Promise<ContentDraft> {
  const canonicalPayload = JSON.stringify(PAYLOAD);
  const head: DraftHead = {
    id: 'current',
    schemaVersion: '1.0.0',
    baseRevision: 12,
    generation: 30,
    digest: await sha256Text(canonicalPayload),
    updatedAt: '2026-09-12T09:00:00.000Z',
    lastActor: { kind: 'admin', principalUserId: 'admin-1', connectionId: null },
  };
  return {
    ...head,
    status: 'active',
    payload: PAYLOAD,
    canonicalPayload,
    createdAt: '2026-09-01T08:00:00.000Z',
    createdBy: 'admin-1',
    ...overrides,
  };
}

function repositoryStub(result: Promise<Result<ContentDraft>>): DraftRepository {
  return {
    load: () => result,
    head: () => Promise.reject(new Error('not used in initialization')),
    mutate: () => Promise.reject(new Error('not used in initialization')),
    prepare: () => Promise.reject(new Error('not used in initialization')),
    publish: () => Promise.reject(new Error('not used in initialization')),
  };
}

function recordInput(overrides: Partial<DraftRecoveryRecordInput> = {}): DraftRecoveryRecordInput {
  return {
    principalId: 'principal-a',
    tabId: 'tab-1',
    savedAt: '2026-09-12T09:30:00.000Z',
    baseGeneration: 30,
    baseDigest: 'a'.repeat(64),
    basePayload: PAYLOAD,
    localPayload: { ...PAYLOAD, defaultGroupOrder: 9 },
    ...overrides,
  };
}

const PRINCIPAL = 'principal-a';
const TAB = 'tab-1';

/** Deterministic in-memory cache so tests exercise record logic, not IndexedDB. */
function memoryCache(): LocalDraftCache {
  const records = new Map<string, ReturnType<typeof recordInput> & { key: string }>();
  return {
    async save(record) {
      records.set(`${record.principalId}:${record.tabId}`, { key: `${record.principalId}:${record.tabId}`, ...record });
      return true;
    },
    async load(principalId, tabId) {
      const record = records.get(`${principalId}:${tabId}`);
      return { status: 'ok', record: record ?? null };
    },
    async list(principalId) {
      return { status: 'ok', records: [...records.values()].filter((r) => r.principalId === principalId) };
    },
    async remove(principalId, tabId) {
      return records.delete(`${principalId}:${tabId}`);
    },
  };
}

// --- Tests -------------------------------------------------------------------

describe('initializeDraft', () => {
  it('returns the verified base with no local candidate when the cache is empty', async () => {
    const draft = await draftFixture();
    const repository = repositoryStub(Promise.resolve({ ok: true, data: draft }));
    const cache = memoryCache();
    const outcome = await initializeDraft({ repository, cache, principalId: PRINCIPAL, tabId: TAB });
    expect(outcome).toEqual({
      status: 'ready',
      base: { ...headFields(draft), payload: PAYLOAD },
      local: null,
      cacheAvailable: true,
    });
  });

  it('resumes the own-tab local candidate when base generation and digest match', async () => {
    const draft = await draftFixture();
    const localPayload = { ...PAYLOAD, defaultGroupOrder: 9 };
    const record = recordInput({ baseGeneration: draft.generation, baseDigest: draft.digest, localPayload });
    const repository = repositoryStub(Promise.resolve({ ok: true, data: draft }));
    const cache = memoryCache();
    await cache.save(record);
    const outcome = await initializeDraft({ repository, cache, principalId: PRINCIPAL, tabId: TAB });
    expect(outcome).toEqual({
      status: 'ready',
      base: { ...headFields(draft), payload: PAYLOAD },
      local: localPayload,
      cacheAvailable: true,
    });
  });

  it('reports a generation-mismatch record as a cache conflict without resuming it', async () => {
    const draft = await draftFixture();
    const record = recordInput({ baseGeneration: draft.generation - 1, baseDigest: draft.digest });
    const repository = repositoryStub(Promise.resolve({ ok: true, data: draft }));
    const cache = memoryCache();
    await cache.save(record);
    const outcome = await initializeDraft({ repository, cache, principalId: PRINCIPAL, tabId: TAB });
    expect(outcome.status).toBe('cache_conflict');
    if (outcome.status !== 'cache_conflict') throw new Error('unreachable');
    expect(outcome.reason).toBe('generation_mismatch');
    expect(outcome.record).toEqual({ key: `${PRINCIPAL}:${TAB}`, ...record });
    expect(outcome.base.generation).toBe(draft.generation);
  });

  it('reports a digest-mismatch record as a cache conflict without resuming it', async () => {
    const draft = await draftFixture();
    const record = recordInput({ baseGeneration: draft.generation, baseDigest: 'c'.repeat(64) });
    const repository = repositoryStub(Promise.resolve({ ok: true, data: draft }));
    const cache = memoryCache();
    await cache.save(record);
    const outcome = await initializeDraft({ repository, cache, principalId: PRINCIPAL, tabId: TAB });
    expect(outcome.status).toBe('cache_conflict');
    if (outcome.status !== 'cache_conflict') throw new Error('unreachable');
    expect(outcome.reason).toBe('digest_mismatch');
  });

  it('is unavailable on repository failure and preserves the recovery record', async () => {
    const draft = await draftFixture();
    const record = recordInput({ baseGeneration: draft.generation, baseDigest: draft.digest });
    const error: EditorialError = { code: 'published_base_unavailable' };
    const repository = repositoryStub(Promise.resolve({ ok: false, error }));
    const cache = memoryCache();
    await cache.save(record);
    const outcome = await initializeDraft({ repository, cache, principalId: PRINCIPAL, tabId: TAB });
    expect(outcome).toEqual({ status: 'unavailable', error, cacheAvailable: true });
    const lookup = await cache.load(PRINCIPAL, TAB);
    expect(lookup.status === 'ok' && lookup.record !== null).toBe(true);
  });

  it('never seeds content when the digest verification fails', async () => {
    const draft = await draftFixture({ canonicalPayload: JSON.stringify({ ...PAYLOAD, defaultGroupOrder: 5 }) });
    const repository = repositoryStub(Promise.resolve({ ok: true, data: draft }));
    const cache = memoryCache();
    const outcome = await initializeDraft({ repository, cache, principalId: PRINCIPAL, tabId: TAB });
    expect(outcome).toEqual({
      status: 'unavailable',
      error: { code: 'validation_failed' },
      cacheAvailable: true,
    });
  });

  it('reports an unavailable cache alongside a successful load', async () => {
    const draft = await draftFixture();
    const repository = repositoryStub(Promise.resolve({ ok: true, data: draft }));
    const failingCache: LocalDraftCache = {
      save: () => Promise.resolve(false),
      load: () => Promise.resolve({ status: 'unavailable' }),
      list: () => Promise.resolve({ status: 'unavailable' }),
      remove: () => Promise.resolve(false),
    };
    const outcome = await initializeDraft({ repository, cache: failingCache, principalId: PRINCIPAL, tabId: TAB });
    expect(outcome.status).toBe('ready');
    if (outcome.status !== 'ready') throw new Error('unreachable');
    expect(outcome.cacheAvailable).toBe(false);
    expect(outcome.local).toBeNull();
  });

  it('does not read other tabs records', async () => {
    const draft = await draftFixture();
    const repository = repositoryStub(Promise.resolve({ ok: true, data: draft }));
    const cache = memoryCache();
    await cache.save(recordInput({ tabId: 'tab-2', baseGeneration: draft.generation, baseDigest: draft.digest }));
    const outcome = await initializeDraft({ repository, cache, principalId: PRINCIPAL, tabId: TAB });
    expect(outcome.status).toBe('ready');
    if (outcome.status !== 'ready') throw new Error('unreachable');
    expect(outcome.local).toBeNull();
  });
});

function headFields(draft: ContentDraft): DraftHead {
  return {
    id: draft.id,
    schemaVersion: draft.schemaVersion,
    baseRevision: draft.baseRevision,
    generation: draft.generation,
    digest: draft.digest,
    updatedAt: draft.updatedAt,
    lastActor: draft.lastActor,
  };
}
