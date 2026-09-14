import { sha256Text } from '@bemtevi/content-core';
import type { ContentDraft, DraftHead, PublishedContentPayload, Result } from '@bemtevi/content-core';
import { describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import type { SaveTimers } from '../draftPolling';
import type { DraftRepository } from '../draftRepository';
import type { DraftRecoveryRecord, LocalDraftCache } from '../../draft-storage/localDraftCache';
import { createSaveCoordinator } from '../saveCoordinator';
import type { SaveState } from '../saveTransitions';
import { saveStatusLabel } from '../saveTransitions';
class FakeTimers implements SaveTimers {
  private seq = 0;
  private tasks = new Map<number, { at: number; fn: () => void }>();
  nowMs = 0;
  setTimeout(fn: () => void, ms: number): unknown {
    const id = ++this.seq;
    this.tasks.set(id, { at: this.nowMs + ms, fn });
    return id;
  }
  clearTimeout(handle: unknown): void {
    this.tasks.delete(handle as number);
  }
  pending(): number {
    return this.tasks.size;
  }
  async advance(ms: number): Promise<void> {
    const target = this.nowMs + ms;
    for (;;) {
      let next: { id: number; at: number; fn: () => void } | null = null;
      for (const [id, task] of this.tasks) {
        if (task.at <= target && (next === null || task.at < next.at)) next = { id, at: task.at, fn: task.fn };
      }
      if (next === null) break;
      this.tasks.delete(next.id);
      this.nowMs = next.at;
      next.fn();
      await new Promise((resolveTick) => setTimeout(resolveTick, 0));
    }
    this.nowMs = target;
  }
}
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
const reordered = (): PublishedContentPayload =>
  ({
    locations: [],
    contacts: [],
    educationGroups: [],
    educationMaterials: [{ title: 'base', id: 'm1' }],
    flows: [],
    defaultGroupOrder: 0,
  }) as PublishedContentPayload;
const remoteAdded = (): PublishedContentPayload => ({
  ...payload('base'),
  educationMaterials: [material('m1', 'base'), material('m2', 'added')],
});
const mergedAdded = (): PublishedContentPayload => ({
  ...payload('local'),
  educationMaterials: [material('m1', 'local'), material('m2', 'added')],
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
  const digest = await sha256Text(JSON.stringify(content));
  return {
    ...headOf(generation, digest),
    status: 'active',
    payload: content,
    canonicalPayload: JSON.stringify(content),
    createdAt: 'c',
    createdBy: 'a',
  };
}
const okDraft = async (generation: number, content: PublishedContentPayload): Promise<ContentDraft> =>
  draftOf(generation, content);
const okResult = async (generation: number, content: PublishedContentPayload): Promise<Result<ContentDraft>> => ({
  ok: true,
  data: await okDraft(generation, content),
});
function fakeCache(): LocalDraftCache & { records: Map<string, DraftRecoveryRecord> } {
  const records = new Map<string, DraftRecoveryRecord>();
  return {
    records,
    save: vi.fn<(record: DraftRecoveryRecordInput) => Promise<boolean>>(async (record) => {
      records.set(`${record.principalId}:${record.tabId}`, { ...record, key: `${record.principalId}:${record.tabId}` });
      return true;
    }),
    load: vi.fn<(principalId: string, tabId: string) => ReturnType<LocalDraftCache['load']>>(
      async (principalId, tabId) => ({
        status: 'ok' as const,
        record: records.get(`${principalId}:${tabId}`) ?? null,
      }),
    ),
    list: vi.fn<(principalId: string) => ReturnType<LocalDraftCache['list']>>(async (principalId) => ({
      status: 'ok' as const,
      records: [...records.values()].filter((r) => r.principalId === principalId),
    })),
    remove: vi.fn<(principalId: string, tabId: string) => Promise<boolean>>(async (principalId, tabId) =>
      records.delete(`${principalId}:${tabId}`),
    ),
  };
}
type DraftRecoveryRecordInput = Parameters<LocalDraftCache['save']>[0];
function setup(isOnline: () => boolean = () => true) {
  const timers = new FakeTimers();
  const cache = fakeCache();
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
    cache,
    now: () => timers.nowMs,
    timers,
    onChange: (next) => states.push(next),
    isOnline,
    tabId: () => 'tab-1',
  });
  return { timers, cache, repository, states, coordinator, last: () => states[states.length - 1] as SaveState };
}
const BASE = payload('base');
const LOCAL = payload('local');
const LATER = payload('later');
/** Loads a clean verified draft at generation 1 and starts a dirty edit. */
async function dirtySetup(isOnline: () => boolean = () => true) {
  const context = setup(isOnline);
  context.repository.load.mockResolvedValue(await okResult(1, BASE));
  context.repository.mutate.mockResolvedValue({ ok: true, data: { head: headOf(2, 'dg-2'), changed: true } });
  await context.coordinator.load('admin-a');
  context.coordinator.edit(LOCAL);
  return context;
}
describe('load', () => {
  it('reaches clean on a verified draft and checks the recovery cache', async () => {
    const { coordinator, last, repository, cache } = setup();
    repository.load.mockResolvedValue(await okResult(1, BASE));
    await coordinator.load('admin-a');
    expect(last().phase).toBe('clean');
    expect(last().base?.generation).toBe(1);
    expect(last().local).toBeNull();
    expect(cache.load).toHaveBeenCalledWith('admin-a', expect.any(String));
    expect(repository.mutate).not.toHaveBeenCalled();
  });
  it('resumes a matching own-tab record as dirty local', async () => {
    const { coordinator, last, repository, cache } = setup();
    const current = await okDraft(1, BASE);
    repository.load.mockResolvedValue({ ok: true, data: current });
    cache.records.set('admin-a:tab-1', {
      key: 'admin-a:tab-1',
      principalId: 'admin-a',
      tabId: 'tab-1',
      savedAt: 't',
      baseGeneration: 1,
      baseDigest: current.digest,
      basePayload: BASE,
      localPayload: LOCAL,
    });
    await coordinator.load('admin-a');
    expect(last().phase).toBe('dirty');
    expect(last().local).toEqual(LOCAL);
  });
  it('surfaces a mismatching recovery record as conflict and never auto-merges', async () => {
    const { coordinator, last, repository, cache } = setup();
    repository.load.mockResolvedValue(await okResult(1, BASE));
    cache.records.set('admin-a:tab-1', {
      key: 'admin-a:tab-1',
      principalId: 'admin-a',
      tabId: 'tab-1',
      savedAt: 't',
      baseGeneration: 9,
      baseDigest: 'other',
      basePayload: BASE,
      localPayload: LOCAL,
    });
    await coordinator.load('admin-a');
    expect(last().phase).toBe('conflict');
    expect(last().error).toEqual({ code: 'retry_required' });
    expect(last().local).toBeNull();
  });
});
describe('edit and autosave timing', () => {
  it('typing resets the 750 ms trailing timer but not the 5 s deadline', async () => {
    const { coordinator, repository, timers } = setup();
    repository.load.mockResolvedValue(await okResult(1, BASE));
    repository.mutate.mockResolvedValue({ ok: true, data: { head: headOf(2, 'dg-2'), changed: true } });
    await coordinator.load('admin-a');
    coordinator.edit(LOCAL);
    for (let i = 0; i < 8; i += 1) {
      await timers.advance(600); // gaps shorter than 750 ms reset the trailing timer
      coordinator.edit(LATER);
    }
    await timers.advance(199); // t = 4999: the 5 s maximum-wait deadline is still pending
    expect(repository.mutate).not.toHaveBeenCalled();
    await timers.advance(1); // the 5 s maximum-wait deadline fires with the latest local
    expect(repository.mutate).toHaveBeenCalledTimes(1);
    expect(repository.mutate.mock.calls[0]?.[0].expectedGeneration).toBe(1);
    expect(repository.mutate).toHaveBeenCalledWith({
      expectedGeneration: 1,
      operations: expect.any(Array),
    });
  });
  it('a clean no-op skips the mutation RPC entirely', async () => {
    const { coordinator, repository, last, cache } = await dirtySetup();
    repository.mutate.mockClear();
    await coordinator.edit(reordered());
    await expect(coordinator.flush()).resolves.toBe(true);
    expect(repository.mutate).not.toHaveBeenCalled();
    expect(last().phase).toBe('clean');
    expect(cache.remove).toHaveBeenCalled();
  });
  it('a cache-write failure never claims a local save', async () => {
    const context = setup();
    context.repository.load.mockResolvedValue(await okResult(1, BASE));
    (context.cache.save as Mock).mockResolvedValue(false);
    await context.coordinator.load('admin-a');
    context.coordinator.edit(LOCAL);
    await context.timers.advance(250);
    expect(context.last().cacheAvailable).toBe(false);
    expect(saveStatusLabel(context.last())).toBe('Alterações apenas nesta aba. Baixe uma cópia antes de sair.');
  });
});
describe('saving', () => {
  it('typing during save preserves later edits and schedules the remaining delta', async () => {
    const { coordinator, repository, last } = await dirtySetup();
    repository.mutate.mockClear();
    let release!: (value: Result<{ head: DraftHead; changed: boolean }>) => void;
    repository.mutate.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const flushing = coordinator.flush();
    await Promise.resolve();
    expect(repository.mutate).toHaveBeenCalledTimes(1);
    coordinator.edit(LATER); // edit while the request is in flight
    release({ ok: true, data: { head: headOf(2, 'dg-2'), changed: true } });
    await flushing;
    expect(repository.mutate).toHaveBeenCalledTimes(2);
    expect(repository.mutate.mock.calls[1]?.[0].expectedGeneration).toBe(2);
    expect(last().phase).toBe('clean');
    expect(last().local).toBeNull();
    expect(last().base?.payload).toEqual(LATER);
  });
  it('first stale generation rebases safely and retries exactly once', async () => {
    const { coordinator, repository, last } = await dirtySetup();
    repository.mutate.mockClear();
    repository.mutate
      .mockResolvedValueOnce({ ok: false, error: { code: 'stale_generation', currentHead: headOf(2, 'x') } })
      .mockResolvedValueOnce({ ok: true, data: { head: headOf(3, 'dg-3'), changed: true } });
    repository.load.mockResolvedValue(await okResult(2, remoteAdded()));
    await coordinator.flush();
    expect(repository.mutate).toHaveBeenCalledTimes(2);
    expect(repository.mutate.mock.calls[1]?.[0].expectedGeneration).toBe(2);
    expect(last().phase).toBe('clean');
    expect(last().base?.payload).toEqual(mergedAdded());
    expect(last().local).toBeNull();
  });
  it('a second stale in the same cycle enters conflict without another CAS attempt', async () => {
    const { coordinator, repository, last } = await dirtySetup();
    repository.mutate.mockClear();
    repository.mutate.mockResolvedValue({
      ok: false,
      error: { code: 'stale_generation', currentHead: headOf(2, 'x') },
    });
    repository.load.mockResolvedValue(await okResult(2, remoteAdded()));
    await coordinator.flush();
    expect(repository.mutate).toHaveBeenCalledTimes(2);
    expect(last().phase).toBe('conflict');
    expect(last().error?.code).toBe('retry_required');
    expect(last().conflicts).toEqual([]);
    expect(last().local).toEqual(LOCAL);
  });
  it('a semantic merge failure on stale keeps the candidate and fingerprints conflicts', async () => {
    const { coordinator, repository, last } = await dirtySetup();
    repository.mutate.mockClear();
    repository.mutate.mockResolvedValue({
      ok: false,
      error: { code: 'stale_generation', currentHead: headOf(2, 'x') },
    });
    repository.load.mockResolvedValue(await okResult(2, payload('remote')));
    await coordinator.flush();
    expect(last().phase).toBe('conflict');
    expect(last().conflicts).toHaveLength(1);
    expect(last().conflicts[0]?.local).toEqual({ present: true, value: 'local' });
    expect(last().conflicts[0]?.remote).toEqual({ present: true, value: 'remote' });
  });
  it('resolves an ambiguous outcome as success when the remote matches the candidate', async () => {
    const { coordinator, repository, last } = await dirtySetup();
    repository.mutate.mockClear();
    repository.mutate.mockResolvedValue({ ok: false, error: { code: 'unavailable' } });
    repository.load.mockResolvedValue(await okResult(2, LOCAL));
    await expect(coordinator.flush()).resolves.toBe(true);
    expect(repository.mutate).toHaveBeenCalledTimes(1);
    expect(last().phase).toBe('clean');
    expect(last().base?.generation).toBe(2);
    expect(last().base?.payload).toEqual(LOCAL);
  });
  it('an ambiguous mismatch reconciles from the original base with one conditional retry', async () => {
    const { coordinator, repository, last } = await dirtySetup();
    repository.mutate.mockClear();
    repository.mutate
      .mockResolvedValueOnce({ ok: false, error: { code: 'unavailable' } })
      .mockResolvedValueOnce({ ok: true, data: { head: headOf(3, 'dg-3'), changed: true } });
    repository.load.mockResolvedValue(await okResult(2, remoteAdded()));
    await expect(coordinator.flush()).resolves.toBe(true);
    expect(repository.mutate).toHaveBeenCalledTimes(2);
    expect(repository.mutate.mock.calls[1]?.[0].expectedGeneration).toBe(2);
    expect(last().phase).toBe('clean');
    expect(last().base?.generation).toBe(3);
  });
  it('an ambiguous incomplete merge enters conflict and an exhausted budget ends in error', async () => {
    const { coordinator, repository, last } = await dirtySetup();
    repository.mutate.mockClear();
    repository.mutate.mockResolvedValue({ ok: false, error: { code: 'unavailable' } });
    repository.load.mockResolvedValue(await okResult(2, payload('remote')));
    await coordinator.flush();
    expect(repository.mutate).toHaveBeenCalledTimes(1);
    expect(last().phase).toBe('conflict');
    expect(last().local).toEqual(LOCAL);
    // Exhausted retry budget: unavailable again after the conditional retry.
    const retryContext = await dirtySetup();
    retryContext.repository.mutate.mockClear();
    retryContext.repository.mutate.mockResolvedValue({ ok: false, error: { code: 'unavailable' } });
    retryContext.repository.load.mockResolvedValue(await okResult(2, remoteAdded()));
    await retryContext.coordinator.flush();
    expect(retryContext.repository.mutate).toHaveBeenCalledTimes(2);
    expect(retryContext.last().phase).toBe('error');
  });
});
describe('offline, refresh, resolve and recovery', () => {
  it('load failure offline suspends timers and offers retry without seeding content', async () => {
    const { coordinator, repository, last, timers } = setup(() => false);
    repository.load.mockResolvedValue({ ok: false, error: { code: 'unavailable' } });
    await coordinator.load('admin-a');
    expect(last().phase).toBe('offline');
    expect(last().base).toBeNull();
    expect(timers.pending()).toBe(0);
    await timers.advance(30000);
    expect(repository.mutate).not.toHaveBeenCalled();
  });
  it('a save that loses the network goes offline, stops timers and keeps the candidate', async () => {
    let online = true;
    const { coordinator, repository, last, timers } = await dirtySetup(() => online);
    repository.mutate.mockClear();
    repository.mutate.mockResolvedValue({ ok: false, error: { code: 'unavailable' } });
    repository.load.mockResolvedValue({ ok: false, error: { code: 'unavailable' } });
    online = false;
    await coordinator.flush();
    expect(last().phase).toBe('offline');
    expect(last().local).toEqual(LOCAL);
    expect(timers.pending()).toBe(0);
    await timers.advance(30000);
    expect(repository.mutate).toHaveBeenCalledTimes(1);
  });
  it('refresh during a save is queued and runs once after the mutation settles', async () => {
    const { coordinator, repository, last } = await dirtySetup();
    repository.mutate.mockClear();
    repository.head.mockClear();
    let release!: (value: Result<{ head: DraftHead; changed: boolean }>) => void;
    repository.mutate.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const flushing = coordinator.flush();
    await Promise.resolve();
    await coordinator.refresh(); // must not overlap the in-flight mutation
    expect(repository.head).not.toHaveBeenCalled();
    repository.head.mockResolvedValue({ ok: true, data: headOf(2, 'dg-2') });
    release({ ok: true, data: { head: headOf(2, 'dg-2'), changed: true } });
    await flushing;
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
    expect(repository.head).toHaveBeenCalledTimes(1);
    expect(last().phase).toBe('clean');
  });
  it('a clean tab adopts a verified newer remote without mutating', async () => {
    const { coordinator, repository, last } = await dirtySetup();
    await coordinator.flush();
    repository.head.mockResolvedValue({ ok: true, data: headOf(3, 'dg-3') });
    repository.load.mockResolvedValue(await okResult(3, remoteAdded()));
    repository.mutate.mockClear();
    await coordinator.refresh();
    expect(repository.mutate).not.toHaveBeenCalled();
    expect(last().phase).toBe('clean');
    expect(last().base?.generation).toBe(3);
    expect(last().base?.payload).toEqual(remoteAdded());
  });
  it('resolve applies decisions and saves conditionally against the fetched remote', async () => {
    const { coordinator, repository, last } = await dirtySetup();
    repository.mutate.mockClear();
    repository.mutate.mockResolvedValue({
      ok: false,
      error: { code: 'stale_generation', currentHead: headOf(2, 'x') },
    });
    const remote = await okDraft(2, payload('remote'));
    repository.load.mockResolvedValue({ ok: true, data: remote });
    await coordinator.flush();
    expect(last().phase).toBe('conflict');
    const conflict = last().conflicts[0];
    expect(conflict).toBeDefined();
    repository.head.mockResolvedValue({ ok: true, data: headOf(2, remote.digest) });
    repository.mutate.mockResolvedValue({ ok: true, data: { head: headOf(3, 'dg-3'), changed: true } });
    await coordinator.resolve({ [conflict?.id ?? '']: { present: true, value: 'local' } });
    expect(repository.mutate).toHaveBeenCalledTimes(2);
    expect(repository.mutate.mock.calls[1]?.[0].expectedGeneration).toBe(2);
    expect(last().phase).toBe('clean');
    expect(last().base?.generation).toBe(3);
  });
  it('explicit retry starts a new bounded save cycle after a refresh', async () => {
    const { coordinator, repository, last } = await dirtySetup();
    repository.mutate.mockClear();
    repository.mutate.mockResolvedValue({ ok: false, error: { code: 'unavailable' } });
    repository.load.mockResolvedValue(await okResult(3, remoteAdded()));
    await coordinator.flush(); // ambiguous budget exhausted -> error
    expect(last().phase).toBe('error');
    repository.mutate.mockResolvedValue({ ok: true, data: { head: headOf(4, 'dg-4'), changed: true } });
    await coordinator.retry();
    expect(repository.mutate).toHaveBeenCalledTimes(3);
    expect(repository.mutate.mock.calls[2]?.[0].expectedGeneration).toBe(3);
    expect(last().phase).toBe('clean');
    expect(last().base?.payload).toEqual(mergedAdded());
  });
  it('discardLocal replaces local/base with the canonical draft and clears the record', async () => {
    const { coordinator, repository, last, cache } = await dirtySetup();
    repository.mutate.mockClear();
    repository.load.mockResolvedValue(await okResult(1, BASE));
    await coordinator.discardLocal();
    expect(repository.mutate).not.toHaveBeenCalled();
    expect(last().phase).toBe('clean');
    expect(last().local).toBeNull();
    expect(cache.remove).toHaveBeenCalled();
  });
});
describe('dispose', () => {
  it('cancels timers and ignores late callbacks via the lifecycle epoch', async () => {
    const { coordinator, repository, states, timers } = await dirtySetup();
    repository.mutate.mockClear();
    let release!: (value: Result<{ head: DraftHead; changed: boolean }>) => void;
    repository.mutate.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const flushing = coordinator.flush();
    await Promise.resolve();
    coordinator.edit(LATER);
    const count = states.length;
    coordinator.dispose();
    release({ ok: true, data: { head: headOf(2, 'dg-2'), changed: true } });
    await flushing;
    await timers.advance(30000);
    expect(states.length).toBe(count);
    expect(timers.pending()).toBe(0);
    await expect(coordinator.flush()).resolves.toBe(false);
  });
});
