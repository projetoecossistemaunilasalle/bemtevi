import { act, renderHook, waitFor } from '@testing-library/react';
import { sha256Text } from '@bemtevi/content-core';
import type { ContentDraft, DraftHead, PublishedContentPayload, Result } from '@bemtevi/content-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SaveTimers } from '../../drafts/draftPolling';
import type { DraftRepository } from '../../drafts/draftRepository';
import type { DraftRecoveryRecord, DraftRecoveryRecordInput, LocalDraftCache } from '../localDraftCache';
import {
  configureCanonicalWorkspaceServices,
  useCanonicalDraftWorkspace,
  type CanonicalWorkspaceServices,
} from '../useDraftWorkspace';

// --- Deterministic timers (same style as the drafts-lane coordinator tests) ---

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

// --- Fixtures ----------------------------------------------------------------

const BASE: PublishedContentPayload = {
  flows: [],
  educationMaterials: [{ id: 'm1', title: 'base' }],
  educationGroups: [],
  contacts: [],
  locations: [],
  defaultGroupOrder: 0,
} as unknown as PublishedContentPayload;
const LOCAL: PublishedContentPayload = { ...BASE, defaultGroupOrder: 2 };
const LATER: PublishedContentPayload = { ...BASE, defaultGroupOrder: 7 };

const headOf = (generation: number, digest: string): DraftHead => ({
  id: 'current',
  schemaVersion: '1.0.0',
  baseRevision: 1,
  generation,
  digest,
  updatedAt: 'u',
  lastActor: { kind: 'admin', principalUserId: 'admin-1', connectionId: null },
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

async function loadedDraft(generation: number, content: PublishedContentPayload): Promise<Result<ContentDraft>> {
  return { ok: true, data: await draftOf(generation, content) };
}

function fakeCache(): LocalDraftCache & { records: Map<string, DraftRecoveryRecord> } {
  const records = new Map<string, DraftRecoveryRecord>();
  const cache = {
    records,
    save: vi.fn(async (record: DraftRecoveryRecordInput) => {
      records.set(`${record.principalId}:${record.tabId}`, { ...record, key: `${record.principalId}:${record.tabId}` });
      return true;
    }),
    load: vi.fn(async (principalId: string, tabId: string) => ({
      status: 'ok' as const,
      record: records.get(`${principalId}:${tabId}`) ?? null,
    })),
    list: vi.fn(async (principalId: string) => ({
      status: 'ok' as const,
      records: [...records.values()].filter((record) => record.principalId === principalId),
    })),
    remove: vi.fn(async (principalId: string, tabId: string) => records.delete(`${principalId}:${tabId}`)),
  };
  return cache as LocalDraftCache & { records: Map<string, DraftRecoveryRecord> };
}

function fakeRepository() {
  return {
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
}

function services(
  repository: ReturnType<typeof fakeRepository>,
  cache: LocalDraftCache,
  timers?: SaveTimers,
): CanonicalWorkspaceServices {
  return {
    repository: repository as unknown as DraftRepository,
    cache,
    now: () => 0,
    timers,
    isOnline: () => true,
    tabId: () => 'tab-1',
  };
}

async function headResult(content: PublishedContentPayload): Promise<Result<DraftHead>> {
  return { ok: true, data: headOf(0, await sha256Text(JSON.stringify(content))) };
}

afterEach(() => {
  configureCanonicalWorkspaceServices(null);
});

describe('useCanonicalDraftWorkspace', () => {
  it('stays inert in loading when no services are configured', async () => {
    const { result } = renderHook(
      ({ principalId }) => useCanonicalDraftWorkspace(principalId, undefined as unknown as CanonicalWorkspaceServices),
      {
        initialProps: { principalId: 'admin-1' },
      },
    );
    await waitFor(() => expect(result.current.state.phase).toBe('loading'));
    expect(result.current.state.base).toBeNull();
    await expect(result.current.flush()).resolves.toBe(false); // safe no-ops
    result.current.edit(LOCAL); // no coordinator: must not crash
    result.current.undo();
  });

  it('merges a restored own-tab recovery cache and saves it against the server base', async () => {
    const cache = fakeCache();
    const repository = fakeRepository();
    const digest = await sha256Text(JSON.stringify(BASE));
    repository.load.mockResolvedValue(await loadedDraft(5, BASE));
    repository.head.mockResolvedValue({ ok: true, data: headOf(5, digest) });
    repository.mutate.mockResolvedValue({ ok: true, data: { head: headOf(6, 'b'.repeat(64)), changed: true } });
    cache.records.set('admin-1:tab-1', {
      principalId: 'admin-1',
      tabId: 'tab-1',
      savedAt: 's',
      key: 'admin-1:tab-1',
      baseGeneration: 5,
      baseDigest: digest,
      basePayload: BASE,
      localPayload: LOCAL,
    });
    const { result } = renderHook(
      ({ principalId }) => useCanonicalDraftWorkspace(principalId, services(repository, cache)),
      {
        initialProps: { principalId: 'admin-1' },
      },
    );
    await waitFor(() => expect(result.current.state.phase).toBe('dirty'));
    expect(result.current.state.local).toEqual(LOCAL);
    let flushed: boolean | undefined;
    await act(async () => {
      flushed = await result.current.flush();
    });
    expect(flushed).toBe(true);
    expect(repository.mutate).toHaveBeenCalledWith({ expectedGeneration: 5, operations: expect.any(Array) });
    await waitFor(() => expect(result.current.state.phase).toBe('clean'));
    expect(cache.records.has('admin-1:tab-1')).toBe(false); // clean record removed after acknowledgement
  });

  it('isolates recovery records by principal and tab', async () => {
    const cache = fakeCache();
    const repository = fakeRepository();
    repository.load.mockResolvedValue(await loadedDraft(5, BASE));
    repository.head.mockResolvedValue(await headResult(BASE));
    cache.records.set('admin-B:tab-1', {
      principalId: 'admin-B',
      tabId: 'tab-1',
      savedAt: 's',
      key: 'admin-B:tab-1',
      baseGeneration: 5,
      baseDigest: await sha256Text(JSON.stringify(BASE)),
      basePayload: BASE,
      localPayload: LATER,
    });
    const { result } = renderHook(
      ({ principalId }) => useCanonicalDraftWorkspace(principalId, services(repository, cache)),
      {
        initialProps: { principalId: 'admin-A' },
      },
    );
    await waitFor(() => expect(result.current.state.phase).toBe('clean'));
    expect(result.current.state.local).toBeNull(); // another principal's record is never resumed
    expect(cache.load).toHaveBeenCalledWith('admin-A', 'tab-1');
  });

  it('saves edits against the current server base generation, never a stale local one', async () => {
    const cache = fakeCache();
    const repository = fakeRepository();
    repository.load.mockResolvedValue(await loadedDraft(5, BASE));
    repository.head.mockResolvedValue(await headResult(BASE));
    repository.mutate.mockResolvedValue({ ok: true, data: { head: headOf(6, 'b'.repeat(64)), changed: true } });
    const { result } = renderHook(
      ({ principalId }) => useCanonicalDraftWorkspace(principalId, services(repository, cache)),
      {
        initialProps: { principalId: 'admin-1' },
      },
    );
    await waitFor(() => expect(result.current.state.phase).toBe('clean'));
    act(() => result.current.edit(LATER));
    await act(async () => {
      await result.current.flush();
    });
    const sent = repository.mutate.mock.calls.map((call) => call[0].expectedGeneration);
    expect(sent).toEqual([5]); // the current server base; a legacy local generation never leaks in
  });

  it('undo restores the previous candidate without ever decrementing the base generation', async () => {
    const cache = fakeCache();
    const repository = fakeRepository();
    repository.load.mockResolvedValue(await loadedDraft(5, BASE));
    repository.head.mockResolvedValue(await headResult(BASE));
    let generation = 5;
    repository.mutate.mockImplementation(async () => {
      generation += 1;
      return { ok: true, data: { head: headOf(generation, 'b'.repeat(64)), changed: true } };
    });
    const { result } = renderHook(
      ({ principalId }) => useCanonicalDraftWorkspace(principalId, services(repository, cache)),
      {
        initialProps: { principalId: 'admin-1' },
      },
    );
    await waitFor(() => expect(result.current.state.phase).toBe('clean'));
    act(() => result.current.edit(LOCAL));
    await act(async () => {
      await result.current.flush();
    });
    await waitFor(() => expect(result.current.state.phase).toBe('clean'));
    act(() => result.current.edit({ ...BASE, defaultGroupOrder: 3 }));
    act(() => result.current.edit(LATER));
    act(() => result.current.undo());
    expect(result.current.state.local).toEqual({ ...BASE, defaultGroupOrder: 3 }); // candidate rolled back in memory
    expect(result.current.state.base?.generation).toBe(6); // acknowledged base is untouched
    await act(async () => {
      await result.current.flush();
    });
    const sent = repository.mutate.mock.calls.map((call) => call[0].expectedGeneration);
    expect(sent).toEqual([5, 6]); // monotonically follows the server head
  });

  it('caps the in-memory undo history at 20 candidates', async () => {
    const cache = fakeCache();
    const repository = fakeRepository();
    repository.load.mockResolvedValue(await loadedDraft(1, BASE));
    repository.head.mockResolvedValue(await headResult(BASE));
    const { result } = renderHook(
      ({ principalId }) => useCanonicalDraftWorkspace(principalId, services(repository, cache)),
      {
        initialProps: { principalId: 'admin-1' },
      },
    );
    await waitFor(() => expect(result.current.state.phase).toBe('clean'));
    const candidates = Array.from({ length: 25 }, (_, index) => ({ ...BASE, defaultGroupOrder: index + 1 }));
    for (const candidate of candidates) act(() => result.current.edit(candidate));
    for (let index = 0; index < 25; index += 1) act(() => result.current.undo());
    // Only the last 20 candidates were retained; undoing 25 times lands on C5.
    expect(result.current.state.local).toEqual({ ...BASE, defaultGroupOrder: 5 });
    expect(result.current.state.base?.generation).toBe(1); // no server mutation happened
  });

  it('ignores late responses after logout or principal switch', async () => {
    const cache = fakeCache();
    const repository = fakeRepository();
    repository.load.mockResolvedValue(await loadedDraft(5, BASE));
    repository.head.mockResolvedValue(await headResult(BASE));
    let release: ((value: Result<{ head: DraftHead; changed: boolean }>) => void) | undefined;
    repository.mutate.mockImplementation(
      () =>
        new Promise<Result<{ head: DraftHead; changed: boolean }>>((resolve) => {
          release = resolve;
        }),
    );
    const { result, rerender } = renderHook(
      ({ principalId }) => useCanonicalDraftWorkspace(principalId, services(repository, cache)),
      {
        initialProps: { principalId: 'admin-A' },
      },
    );
    await waitFor(() => expect(result.current.state.phase).toBe('clean'));
    act(() => result.current.edit(LOCAL));
    let flushPromise: Promise<boolean> | undefined;
    act(() => {
      flushPromise = result.current.flush(); // starts the in-flight admin-A mutation
    });
    await waitFor(() => expect(repository.mutate).toHaveBeenCalled());
    rerender({ principalId: 'admin-B' }); // principal switch disposes admin-A's coordinator
    await waitFor(() => expect(result.current.state.phase).toBe('clean'));
    expect(result.current.state.local).toBeNull();
    await act(async () => {
      release?.({ ok: true, data: { head: headOf(6, 'b'.repeat(64)), changed: true } });
      await Promise.resolve();
    });
    await expect(flushPromise).resolves.toBe(false); // disposed with the old principal's session
    // The late acknowledged response must not touch admin-B's session state.
    expect(result.current.state.phase).toBe('clean');
    expect(result.current.state.local).toBeNull();
    expect(result.current.state.error).toBeNull();
    expect(cache.records.has('admin-B:tab-1')).toBe(false);
  });

  it('marks a failed recovery-cache write without claiming a local save', async () => {
    const timers = new FakeTimers();
    const cache = fakeCache();
    vi.mocked(cache.save).mockResolvedValue(false);
    const repository = fakeRepository();
    repository.load.mockResolvedValue(await loadedDraft(5, BASE));
    repository.head.mockResolvedValue(await headResult(BASE));
    const { result } = renderHook(
      ({ principalId }) => useCanonicalDraftWorkspace(principalId, services(repository, cache, timers)),
      {
        initialProps: { principalId: 'admin-1' },
      },
    );
    await waitFor(() => expect(result.current.state.phase).toBe('clean'));
    act(() => result.current.edit(LOCAL));
    await act(async () => {
      await timers.advance(300); // fires the 250 ms cache write, not the 750 ms autosave
    });
    expect(result.current.state.cacheAvailable).toBe(false);
    expect(result.current.state.phase).toBe('dirty');
  });
});
