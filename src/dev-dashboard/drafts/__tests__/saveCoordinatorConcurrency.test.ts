import { sha256Text } from '@bemtevi/content-core';
import type { ContentDraft, DraftHead, PublishedContentPayload, Result } from '@bemtevi/content-core';
import { describe, expect, it, vi } from 'vitest';
import type { SaveTimers } from '../draftPolling';
import type { DraftRepository } from '../draftRepository';
import type { DraftRecoveryRecord, LocalDraftCache } from '../../draft-storage/localDraftCache';
import { createSaveCoordinator } from '../saveCoordinator';
import type { SaveState } from '../saveTransitions';

const material = (id: string, title: string): PublishedContentPayload['educationMaterials'][number] =>
  ({ id, title }) as unknown as PublishedContentPayload['educationMaterials'][number];
const payload = (title: string): PublishedContentPayload => ({
  flows: [],
  educationMaterials: [material('m1', title)],
  educationGroups: [],
  contacts: [],
  locations: [],
  defaultGroupOrder: 0,
});
const remoteAdded = (): PublishedContentPayload => ({
  ...payload('base'),
  educationMaterials: [material('m1', 'base'), material('m2', 'added')],
});
const mergedAdded = (): PublishedContentPayload => ({
  ...payload('later'),
  educationMaterials: [material('m1', 'later'), material('m2', 'added')],
});
const headOf = (generation: number, digest: string): DraftHead => ({
  id: 'current',
  schemaVersion: '1.0.0',
  baseRevision: 1,
  generation,
  digest,
  updatedAt: 'u',
  lastActor: { kind: 'admin', principalUserId: 'admin-a', connectionId: null },
});
async function draftOf(generation: number, content: PublishedContentPayload): Promise<ContentDraft> {
  const canonicalPayload = JSON.stringify(content);
  return {
    ...headOf(generation, await sha256Text(canonicalPayload)),
    status: 'active',
    payload: content,
    canonicalPayload,
    createdAt: 'c',
    createdBy: 'a',
  };
}
const okResult = async (generation: number, content: PublishedContentPayload): Promise<Result<ContentDraft>> => ({
  ok: true,
  data: await draftOf(generation, content),
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function settleMicrotasks(): Promise<void> {
  for (let index = 0; index < 5; index += 1) await Promise.resolve();
}

function fakeCache(): LocalDraftCache {
  const emptyRecord: DraftRecoveryRecord | null = null;
  return {
    save: vi.fn(async () => true),
    load: vi.fn(async () => ({ status: 'ok' as const, record: emptyRecord })),
    list: vi.fn(async () => ({ status: 'ok' as const, records: [] })),
    remove: vi.fn(async () => true),
  };
}

function setup() {
  const timers: SaveTimers = { setTimeout: vi.fn(() => 0), clearTimeout: vi.fn() };
  const repository = {
    load: vi.fn<() => Promise<Result<ContentDraft>>>(),
    head: vi.fn<() => Promise<Result<DraftHead>>>(),
    mutate:
      vi.fn<
        (input: {
          expectedGeneration: number;
          operations: unknown[];
        }) => Promise<Result<{ head: DraftHead; changed: boolean }>>
      >(),
    prepare: vi.fn(),
    publish: vi.fn(),
  };
  const states: SaveState[] = [];
  const coordinator = createSaveCoordinator({
    repository: repository as unknown as DraftRepository,
    cache: fakeCache(),
    now: () => 0,
    timers,
    onChange: (state) => states.push(state),
    isOnline: () => true,
    tabId: () => 'tab-1',
  });
  return { repository, states, coordinator, last: () => states[states.length - 1] as SaveState };
}

const BASE = payload('base');
const LOCAL = payload('local');
const LATER = payload('later');

describe('save coordinator concurrency', () => {
  it('re-reads state after resolve head work and keeps an edit made during the prior remote read', async () => {
    const context = setup();
    const remote = await draftOf(2, payload('remote'));
    context.repository.load.mockResolvedValue(await okResult(1, BASE));
    await context.coordinator.load('admin-a');
    context.coordinator.edit(LOCAL);

    const staleRead = deferred<Result<ContentDraft>>();
    context.repository.load.mockImplementationOnce(() => staleRead.promise);
    context.repository.mutate.mockResolvedValue({
      ok: false,
      error: { code: 'stale_generation', currentHead: headOf(2, remote.digest) },
    });
    const saving = context.coordinator.flush();
    await settleMicrotasks();
    expect(context.repository.load).toHaveBeenCalledTimes(2);

    context.coordinator.edit(LATER);
    staleRead.resolve({ ok: true, data: remote });
    await saving;
    expect(context.last().phase).toBe('conflict');
    expect(context.last().local).toEqual(LATER);

    const headRead = deferred<Result<DraftHead>>();
    context.repository.head.mockImplementationOnce(() => headRead.promise);
    const resolving = context.coordinator.resolve({});
    await settleMicrotasks();
    expect(context.repository.head).toHaveBeenCalledOnce();
    headRead.resolve({ ok: true, data: remote });
    await resolving;

    expect(context.last().phase).toBe('conflict');
    expect(context.last().local).toEqual(LATER);
  });

  it('re-reads state after retry load work and saves the retained candidate', async () => {
    const context = setup();
    const remote = await draftOf(2, remoteAdded());
    context.repository.load.mockResolvedValue(await okResult(1, BASE));
    await context.coordinator.load('admin-a');
    context.coordinator.edit(LATER);
    context.repository.load.mockResolvedValue({ ok: true, data: remote });
    context.repository.mutate.mockResolvedValue({ ok: false, error: { code: 'unavailable' } });
    await context.coordinator.flush();
    expect(context.last().phase).toBe('error');
    expect(context.last().local).toEqual(LATER);

    const retryRead = deferred<Result<ContentDraft>>();
    context.repository.load.mockImplementationOnce(() => retryRead.promise);
    context.repository.mutate.mockResolvedValue({
      ok: true,
      data: { head: headOf(3, 'saved'), changed: true },
    });
    const retrying = context.coordinator.retry();
    await settleMicrotasks();
    expect(context.repository.load).toHaveBeenCalledTimes(4);
    retryRead.resolve({ ok: true, data: remote });
    await retrying;

    expect(context.last().phase).toBe('clean');
    expect(context.last().base?.payload).toEqual(mergedAdded());
  });

  it('allows retry to adopt a verified remote when the latest local candidate is null', async () => {
    const context = setup();
    const remote = await draftOf(2, remoteAdded());
    context.repository.load.mockResolvedValue(await okResult(1, BASE));
    await context.coordinator.load('admin-a');
    context.repository.head.mockResolvedValue({ ok: true, data: remote });
    context.repository.load.mockResolvedValue({ ok: false, error: { code: 'unavailable' } });
    await context.coordinator.refresh();
    expect(context.last().phase).toBe('error');
    expect(context.last().local).toBeNull();

    const retryRead = deferred<Result<ContentDraft>>();
    context.repository.load.mockImplementationOnce(() => retryRead.promise);
    const retrying = context.coordinator.retry();
    await settleMicrotasks();
    retryRead.resolve({ ok: true, data: remote });
    await retrying;

    expect(context.last().phase).toBe('clean');
    expect(context.last().local).toBeNull();
    expect(context.last().base?.generation).toBe(2);
    expect(context.last().base?.payload).toEqual(remoteAdded());
  });
});
