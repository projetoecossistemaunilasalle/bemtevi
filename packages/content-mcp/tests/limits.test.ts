import { describe, expect, it } from 'vitest';
import {
  conformanceBasePayload,
  sha256Text,
  type ContentDraft,
  type PublishedContentPayload,
} from '@bemtevi/content-core';
import { createDataApiClientWith } from '../src/client/dataApiClient';
import { BaseSnapshotCache, type BaseSnapshot } from '../src/session/baseSnapshotCache';
import { createToolDispatch } from '../src/server/dispatch';
import { registerContentTools } from '../src/tools/definitions';

/**
 * Limits tests (MCP-02): snapshot cache TTL/LRU/generation keying and
 * verified/unverified marking, the 60-calls-per-60s sliding-window rate limiter
 * (rejected calls count), read (4) and mutation (1) concurrency gates, the
 * single 500 ms read retry, and no mutation transport retry.
 */

const CONNECTION_ID = '00000000-0000-4000-8000-0000000000c1';

/** The fake transport only returns in-band envelope data; transport errors are unused here. */

interface Deferred {
  promise: Promise<void>;
  resolve: () => void;
}

function deferred(): Deferred {
  let resolve: (() => void) | null = null;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve: resolve as () => void };
}

async function makeSnapshot(
  payload: PublishedContentPayload,
  generation: number,
  verified: boolean,
): Promise<BaseSnapshot> {
  const canonicalPayload = JSON.stringify(payload);
  return {
    connectionId: CONNECTION_ID,
    generation,
    head: {
      id: 'current',
      schemaVersion: '1.0.0',
      baseRevision: 3,
      generation,
      digest: await sha256Text(canonicalPayload),
      updatedAt: '2026-09-13T00:00:00.000Z',
      lastActor: { kind: 'admin', principalUserId: 'admin-1', connectionId: null },
    },
    payload,
    canonicalPayload,
    verified,
  };
}

interface HarnessOptions {
  rpcHook?:
    | ((
        name: string,
        args: Record<string, unknown>,
      ) => Promise<{ data?: unknown; error?: unknown }> | { data?: unknown; error?: unknown })
    | undefined;
}

async function makeHarness(options: HarnessOptions = {}) {
  let now = 1_000_000;
  const delays: number[] = [];
  const client = createDataApiClientWith(async (name, args) => {
    const hooked = options.rpcHook?.(name, args);
    if (hooked) return hooked;
    if (name === 'agent_get_editor_context') {
      return {
        data: {
          ok: true,
          data: {
            head: {
              id: 'current',
              schemaVersion: '1.0.0',
              baseRevision: 3,
              generation: 7,
              digest: 'd',
              updatedAt: 'u',
              lastActor: { kind: 'admin', principalUserId: 'admin-1', connectionId: null },
            },
            publishedRevision: 3,
            principalUserId: 'admin-1',
            connectionId: CONNECTION_ID,
            expiresAt: 'e',
          },
        },
      };
    }
    if (name === 'agent_get_draft') {
      const draft: ContentDraft = {
        id: 'current',
        schemaVersion: '1.0.0',
        status: 'active',
        baseRevision: 3,
        generation: 7,
        digest: await sha256Text(JSON.stringify(conformanceBasePayload)),
        updatedAt: 'u',
        lastActor: { kind: 'admin', principalUserId: 'admin-1', connectionId: null },
        payload: conformanceBasePayload,
        canonicalPayload: JSON.stringify(conformanceBasePayload),
        createdAt: 'c',
        createdBy: 'admin-1',
      };
      return { data: { ok: true, data: draft } };
    }
    return { data: { ok: false, error: { code: 'unavailable' } } };
  });
  const cache = new BaseSnapshotCache({ clock: () => now });
  const dispatch = createToolDispatch();
  registerContentTools(
    {
      client,
      connectionId: CONNECTION_ID,
      agentToken: 'A'.repeat(43),
      clock: () => now,
      delay: (ms) => {
        delays.push(ms);
        now += ms;
        return Promise.resolve();
      },
      cache,
    },
    dispatch,
  );
  const call = async (name: string, args: Record<string, unknown> = {}) => dispatch.dispatch(name, args);
  return {
    dispatch,
    cache,
    delays,
    call,
    seed: () => call('get_editor_context'),
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe('base snapshot cache', () => {
  it('expires entries after the 15-minute TTL and serves just before it', async () => {
    const { call, seed, advance } = await makeHarness();
    await seed();
    advance(15 * 60 * 1000 - 1);
    const before = await call('list_items', { generation: 7, scope: 'flows' });
    expect(before.ok).toBe(true);
    advance(1);
    const expired = await call('list_items', { generation: 7, scope: 'flows' });
    expect(expired.error?.code).toBe('rebase_required');
  });

  it('evicts the least recently used entry beyond three snapshots', async () => {
    const { call, cache, seed, advance } = await makeHarness();
    await seed();
    const payload = conformanceBasePayload;
    advance(1);
    cache.insert(await makeSnapshot(payload, 8, true));
    advance(1);
    cache.insert(await makeSnapshot(payload, 9, true));
    advance(1);
    expect(cache.get(CONNECTION_ID, 7)).not.toBeNull();
    advance(1);
    expect(cache.get(CONNECTION_ID, 9)).not.toBeNull();
    advance(1);
    // Only generations 7 and 9 were touched since insertion, so 8 is now the
    // least recently used entry.
    cache.insert(await makeSnapshot(payload, 10, true));
    expect(cache.get(CONNECTION_ID, 8)).toBeNull();
    expect(cache.get(CONNECTION_ID, 9)).not.toBeNull();
    expect(cache.get(CONNECTION_ID, 10)).not.toBeNull();
    const read = await call('list_items', { generation: 7, scope: 'flows' });
    expect(read.ok).toBe(true);
  });

  it('keys snapshots by connection id plus generation', async () => {
    const { call, seed } = await makeHarness();
    await seed();
    const other = await call('list_items', { generation: 8, scope: 'flows' });
    expect(other.error?.code).toBe('rebase_required');
    const own = await call('list_items', { generation: 7, scope: 'flows' });
    expect(own.ok).toBe(true);
  });

  it('treats unverified post-mutation candidates as unusable read bases', async () => {
    const { call, cache } = await makeHarness();
    cache.insert(await makeSnapshot(conformanceBasePayload, 8, false));
    const read = await call('list_items', { generation: 8, scope: 'flows' });
    expect(read.error?.code).toBe('rebase_required');
    const mutation = await call('apply_operations', {
      expectedGeneration: 8,
      operations: [{ op: 'set_default_group_order', value: 2 }],
    });
    expect(mutation.error?.code).toBe('rebase_required');
    cache.insert(await makeSnapshot(conformanceBasePayload, 8, true));
    const verified = await call('list_items', { generation: 8, scope: 'flows' });
    expect(verified.ok).toBe(true);
  });
});

describe('rate limiter', () => {
  it('allows 60 calls per sliding window and rejects excess with rate_limited', async () => {
    const { call, advance } = await makeHarness();
    for (let index = 0; index < 60; index += 1) {
      const result = await call('list_items', { generation: 7, scope: 'flows' });
      expect(result.error?.code).not.toBe('rate_limited');
    }
    const rejected = await call('list_items', { generation: 7, scope: 'flows' });
    expect(rejected.error?.code).toBe('rate_limited');
    advance(60_000);
    const afterWindow = await call('list_items', { generation: 7, scope: 'flows' });
    expect(afterWindow.error?.code).not.toBe('rate_limited');
  });

  it('counts rejected calls in the window', async () => {
    const { call, advance } = await makeHarness();
    for (let index = 0; index < 60; index += 1) await call('list_items', { generation: 7, scope: 'flows' });
    for (let index = 0; index < 59; index += 1) {
      const rejected = await call('list_items', { generation: 7, scope: 'flows' });
      expect(rejected.error?.code).toBe('rate_limited');
    }
    // The window is still saturated by allowed + rejected attempts.
    const stillRejected = await call('list_items', { generation: 7, scope: 'flows' });
    expect(stillRejected.error?.code).toBe('rate_limited');
    advance(60_000);
    const recovered = await call('list_items', { generation: 7, scope: 'flows' });
    expect(recovered.error?.code).not.toBe('rate_limited');
  });
});

describe('concurrency gates', () => {
  it('allows four concurrent reads and rejects the fifth immediately', async () => {
    const gate = deferred();
    let held = 0;
    const { call } = await makeHarness({
      rpcHook: (name) => {
        if (name === 'agent_get_editor_context') {
          held += 1;
          if (held <= 4)
            return gate.promise.then(() => ({
              data: {
                ok: true,
                data: {
                  head: {
                    id: 'current',
                    schemaVersion: '1.0.0',
                    baseRevision: 3,
                    generation: 7,
                    digest: 'd',
                    updatedAt: 'u',
                    lastActor: { kind: 'admin', principalUserId: 'a', connectionId: null },
                  },
                  publishedRevision: 3,
                  principalUserId: 'admin-1',
                  connectionId: CONNECTION_ID,
                  expiresAt: 'e',
                },
              },
            })) as never;
          return { data: { ok: false, error: { code: 'unavailable' } } };
        }
        return undefined;
      },
    });
    const runs = [1, 2, 3, 4, 5].map(() => call('get_editor_context'));
    await new Promise((done) => setTimeout(done, 20));
    expect(held).toBe(4);
    gate.resolve();
    const results = await Promise.all(runs);
    expect(results[4]?.error?.code).toBe('rate_limited');
    expect(results.slice(0, 4).every((result) => result.error?.code !== 'rate_limited')).toBe(true);
    await new Promise((done) => setTimeout(done, 20));
  });

  it('allows one concurrent mutation and rejects the second immediately', async () => {
    const gate = deferred();
    let held = 0;
    const { call, cache } = await makeHarness({
      rpcHook: (name) => {
        if (name === 'agent_apply_operations') {
          held += 1;
          return gate.promise.then(() => ({
            data: {
              ok: true,
              data: {
                head: {
                  id: 'current',
                  schemaVersion: '1.0.0',
                  baseRevision: 3,
                  generation: 8,
                  digest: 'd',
                  updatedAt: 'u',
                  lastActor: { kind: 'agent', principalUserId: 'a', connectionId: CONNECTION_ID },
                },
                changed: true,
              },
            },
          })) as never;
        }
        return undefined;
      },
    });
    cache.insert(await makeSnapshot(conformanceBasePayload, 7, true));
    const first = call('apply_operations', {
      expectedGeneration: 7,
      operations: [{ op: 'set_default_group_order', value: 2 }],
    });
    await new Promise((done) => setTimeout(done, 20));
    expect(held).toBe(1);
    const second = await call('apply_operations', {
      expectedGeneration: 7,
      operations: [{ op: 'set_default_group_order', value: 3 }],
    });
    expect(second.error?.code).toBe('rate_limited');
    gate.resolve();
    expect((await first).ok).toBe(true);
  });
});

describe('read retry policy', () => {
  it('retries a read once after 500 ms on a transient failure', async () => {
    let contextCalls = 0;
    const { call, delays } = await makeHarness({
      rpcHook: (name) => {
        if (name === 'agent_get_editor_context') {
          contextCalls += 1;
          if (contextCalls === 1) return { data: { ok: false, error: { code: 'unavailable' } } };
          return {
            data: {
              ok: true,
              data: {
                head: {
                  id: 'current',
                  schemaVersion: '1.0.0',
                  baseRevision: 3,
                  generation: 7,
                  digest: 'd',
                  updatedAt: 'u',
                  lastActor: { kind: 'admin', principalUserId: 'a', connectionId: null },
                },
                publishedRevision: 3,
                principalUserId: 'admin-1',
                connectionId: CONNECTION_ID,
                expiresAt: 'e',
              },
            },
          };
        }
        return undefined;
      },
    });
    const result = await call('get_editor_context');
    expect(result.ok).toBe(true);
    expect(delays).toEqual([500]);
    expect(contextCalls).toBe(2);
  });

  it('surfaces the error after the single retry is exhausted', async () => {
    let contextCalls = 0;
    const { call, delays } = await makeHarness({
      rpcHook: (name) => {
        if (name === 'agent_get_editor_context') {
          contextCalls += 1;
          return { data: { ok: false, error: { code: 'unavailable' } } };
        }
        return undefined;
      },
    });
    const result = await call('get_editor_context');
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('unavailable');
    expect(delays).toEqual([500]);
    expect(contextCalls).toBe(2);
  });

  it('does not transport-retry mutations and recovers the ambiguous outcome', async () => {
    let applyCalls = 0;
    const savedPayload = { ...conformanceBasePayload, defaultGroupOrder: 4 };
    const { call, cache, delays } = await makeHarness({
      rpcHook: (name) => {
        if (name === 'agent_apply_operations') {
          applyCalls += 1;
          return { data: { ok: false, error: { code: 'unavailable' } } };
        }
        if (name === 'agent_get_draft') {
          return sha256Text(JSON.stringify(savedPayload)).then((digest) => ({
            data: {
              ok: true,
              data: {
                id: 'current',
                schemaVersion: '1.0.0',
                status: 'active',
                baseRevision: 3,
                generation: 7,
                digest,
                updatedAt: 'u',
                lastActor: { kind: 'admin', principalUserId: 'admin-1', connectionId: null },
                payload: savedPayload,
                canonicalPayload: JSON.stringify(savedPayload),
                createdAt: 'c',
                createdBy: 'admin-1',
              },
            },
          }));
        }
        return undefined;
      },
    });
    cache.insert(await makeSnapshot(conformanceBasePayload, 7, true));
    const result = await call('apply_operations', {
      expectedGeneration: 7,
      operations: [{ op: 'set_default_group_order', value: 4 }],
    });
    // The mutating RPC is sent exactly once (no transport-level retry, no retry
    // delay); the ambiguous outcome is resolved by fetching and comparing.
    expect(applyCalls).toBe(1);
    expect(delays).toEqual([]);
    expect(result.ok).toBe(true);
    expect((result.data as { changed: boolean }).changed).toBe(true);
  });
});
