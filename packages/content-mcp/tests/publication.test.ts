import { describe, expect, it, vi, afterEach } from 'vitest';
import { fromJsonSchema } from '@modelcontextprotocol/server';
import { createHash } from 'node:crypto';
import {
  applyOperations,
  conformanceBasePayload,
  sameContent,
  sha256Text,
  type ContentDraft,
  type DraftHead,
  type PublishedContentPayload,
} from '@bemtevi/content-core';
import { createDataApiClientWith } from '../src/client/dataApiClient';
import { BaseSnapshotCache } from '../src/session/baseSnapshotCache';
import { createToolDispatch } from '../src/server/dispatch';
import { contentToolSpecs, registerContentTools } from '../src/tools/definitions';
import {
  PREPARE_PUBLISH_SCHEMA,
  base64UrlEncode,
  createPreparePublishHandler,
  type RandomSource,
} from '../src/tools/preparePublish';
import { PUBLISH_DRAFT_SCHEMA } from '../src/tools/publishDraft';
import type { ToolRuntime } from '../src/tools/rpc';

/**
 * Guarded publication tests (MCP-03): fail-fast prepare checks (bounds, fresh
 * verified draft/live revision, generation/revision/alignment, semantic
 * inspection and normalized-identity guard), client-side preparation identity
 * with hash-only RPC exposure, raw-token disclosure, exact publish error
 * mapping, the single same-preparation replay, mutation classification, and
 * the "editing never publishes" rule.
 */

const CONNECTION_ID = '00000000-0000-4000-8000-0000000000c3';

type Wire = { ok: true; data: unknown } | { ok: false; error: { code: string; message?: string } };

interface FakeState {
  draft: ContentDraft;
  published: { revision: number; payload: PublishedContentPayload; canonicalPayload: string; digest: string };
  calls: Array<{ name: string; args: Record<string, unknown> }>;
  prepareBehavior: (args: Record<string, unknown>) => Promise<Wire>;
  publishBehavior: (args: Record<string, unknown>) => Promise<Wire>;
  preparedGeneration: number;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Conformance fixture with its two deliberate semantic errors repaired. */
function validPayload(): PublishedContentPayload {
  const payload = clone(conformanceBasePayload);
  (payload.contacts[0] as unknown as Record<string, unknown>).phoneHref = 'tel:4130000000';
  const nodes = (payload.flows[0] as unknown as { nodes: Record<string, { recommendations: string[] }> }).nodes;
  nodes['no-dois'].recommendations = ['material-exemplo'];
  return payload;
}

function headFields(draft: ContentDraft): DraftHead {
  const { id, schemaVersion, baseRevision, generation, digest, updatedAt, lastActor } = draft;
  return { id, schemaVersion, baseRevision, generation, digest, updatedAt, lastActor };
}

async function makeDraft(
  payload: PublishedContentPayload,
  generation: number,
  baseRevision = 3,
): Promise<ContentDraft> {
  const canonicalPayload = JSON.stringify(payload);
  return {
    id: 'current',
    schemaVersion: '1.0.0',
    status: 'active',
    baseRevision,
    generation,
    digest: await sha256Text(canonicalPayload),
    updatedAt: '2026-09-13T00:00:00.000Z',
    lastActor: { kind: 'admin', principalUserId: 'admin-1', connectionId: null },
    payload,
    canonicalPayload,
    createdAt: '2026-09-01T00:00:00.000Z',
    createdBy: 'admin-1',
  };
}

function prepareEcho(args: Record<string, unknown>): Wire {
  return {
    ok: true,
    data: {
      preparationId: args['p_preparation_id'],
      draftId: 'current',
      generation: args['p_generation'],
      expectedRevision: args['p_expected_revision'],
      digest: args['p_digest'],
      expiresAt: '2026-09-13T00:10:00.000Z',
    },
  };
}

const PUBLISH_RESULT = {
  revision: 4,
  publishedAt: '2026-09-13T00:05:00.000Z',
  draftGeneration: 8,
  digest: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
};

const PREPARE_ARGS = { generation: 7, expectedRevision: 3 };
const PUBLISH_ARGS = { preparationId: '12345678-90ab-4cde-8f01-23456789abcd', publishToken: 'A'.repeat(43) };

type ProjectedValidation = { valid: boolean; issues: Array<{ code: string; message: string }> };

const ANNOT = (destructive: boolean, idempotent: boolean) => ({
  readOnlyHint: false,
  destructiveHint: destructive,
  idempotentHint: idempotent,
  openWorldHint: false,
});

const GROUP_OP = [
  { op: 'update', scope: 'educationGroups', id: 'grupo-um', patch: { title: 'Grupo um alterado' }, unset: [] },
];

function groupTitleOp(generation: number): Record<string, unknown> {
  return { expectedGeneration: generation, operations: GROUP_OP };
}

function contextData(state: FakeState): Record<string, unknown> {
  return {
    head: headFields(state.draft),
    publishedRevision: state.published.revision,
    principalUserId: 'admin-1',
    connectionId: CONNECTION_ID,
    expiresAt: '2026-12-31T00:00:00.000Z',
  };
}

async function makeHarness(options: { payload?: PublishedContentPayload; baseRevision?: number } = {}) {
  const draft = await makeDraft(clone(options.payload ?? validPayload()), 7, options.baseRevision);
  const published = {
    revision: 3,
    payload: clone(draft.payload),
    canonicalPayload: draft.canonicalPayload,
    digest: draft.digest,
  };
  const state: FakeState = {
    draft,
    published,
    calls: [],
    prepareBehavior: async (args) => {
      state.preparedGeneration = state.draft.generation;
      return prepareEcho(args);
    },
    publishBehavior: async () =>
      state.draft.generation === state.preparedGeneration
        ? { ok: true, data: { ...PUBLISH_RESULT } }
        : { ok: false, error: { code: 'preparation_stale' } },
    preparedGeneration: 7,
  };
  const now = 1_000_000;
  const client = createDataApiClientWith(async (name, args) => {
    state.calls.push({ name, args: JSON.parse(JSON.stringify(args)) as Record<string, unknown> });
    if (name === 'agent_get_editor_context') {
      return { data: { ok: true, data: contextData(state) } };
    }
    if (name === 'agent_get_draft') return { data: { ok: true, data: state.draft } };
    if (name === 'agent_get_published_content') return { data: { ok: true, data: state.published } };
    if (name === 'agent_prepare_publish') return { data: await state.prepareBehavior(args) };
    if (name === 'agent_publish_draft') return { data: await state.publishBehavior(args) };
    if (name === 'agent_apply_operations') {
      if (Number(args['p_expected_generation']) !== state.draft.generation)
        return { data: { ok: false, error: { code: 'stale_generation' } } };
      const applied = applyOperations(state.draft.payload, args['p_operations'] as never);
      if (applied.ok === false) return { data: { ok: false, error: applied.error } };
      const changed = !sameContent(applied.data, state.draft.payload);
      if (changed) state.draft = await makeDraft(applied.data, state.draft.generation + 1, state.draft.baseRevision);
      return { data: { ok: true, data: { head: headFields(state.draft), changed } } };
    }
    return { data: { ok: false, error: { code: 'unavailable' } } };
  });
  const dispatch = createToolDispatch();
  registerContentTools(
    {
      client,
      connectionId: CONNECTION_ID,
      agentToken: 'A'.repeat(43),
      clock: () => now,
      delay: () => Promise.resolve(),
      cache: new BaseSnapshotCache({ clock: () => now }),
    },
    dispatch,
  );
  const call = async (name: string, args: Record<string, unknown> = {}) => dispatch.dispatch(name, args);
  return { state, client, dispatch, call, seed: () => call('get_editor_context') };
}

function rpcCalls(state: FakeState, name: string): Array<{ name: string; args: Record<string, unknown> }> {
  return state.calls.filter((entry) => entry.name === name);
}

function spyConsole(): Array<{ mock: { calls: unknown[] } }> {
  return (['error', 'log', 'warn', 'info'] as const).map((method) =>
    vi.spyOn(console, method).mockImplementation(() => {}),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('prepare_publish', () => {
  it('pins the verified draft: preparation, raw 43-character token, hash-only RPC exposure', async () => {
    const spies = spyConsole();
    const { call, state } = await makeHarness();
    const result = await call('prepare_publish', PREPARE_ARGS);
    expect(result.ok).toBe(true);
    const data = result.data as Record<string, unknown>;
    const prepare = rpcCalls(state, 'agent_prepare_publish');
    expect(prepare).toHaveLength(1);
    const args = prepare[0]?.args as Record<string, unknown>;
    const token = data['publishToken'] as string;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(args['p_token_hash']).toBe(createHash('sha256').update(Buffer.from(token, 'base64url')).digest('hex'));
    expect(args['p_generation']).toBe(7);
    expect(args['p_expected_revision']).toBe(3);
    expect(args['p_digest']).toBe(state.draft.digest);
    expect(JSON.stringify(args)).not.toContain(token);
    expect(data['preparation']).toEqual({
      preparationId: args['p_preparation_id'],
      draftId: 'current',
      generation: 7,
      expectedRevision: 3,
      digest: state.draft.digest,
      expiresAt: '2026-09-13T00:10:00.000Z',
    });
    expect(data['validation']).toEqual({ valid: true, issues: [] });
    for (const spy of spies) expect(spy.mock.calls).toHaveLength(0);
  });

  it('accepts an injected random source for deterministic preparation identity', async () => {
    const { state, client } = await makeHarness();
    const bytes = new Uint8Array(32).fill(0xab);
    const random: RandomSource = { randomBytes: () => bytes, uuid: () => PUBLISH_ARGS.preparationId };
    const rt: ToolRuntime = {
      client,
      connectionId: CONNECTION_ID,
      agentToken: 'A'.repeat(43),
      cache: new BaseSnapshotCache({ clock: () => 1_000_000 }),
      delay: () => Promise.resolve(),
    };
    const outcome = await createPreparePublishHandler(rt, { random })(PREPARE_ARGS);
    expect(outcome.ok).toBe(true);
    const data = outcome.ok === false ? null : outcome.data;
    expect(data?.publishToken).toBe(base64UrlEncode(bytes));
    expect(data?.preparation.preparationId).toBe(PUBLISH_ARGS.preparationId);
    const args = rpcCalls(state, 'agent_prepare_publish')[0]?.args as Record<string, unknown>;
    expect(args['p_token_hash']).toBe(createHash('sha256').update(Buffer.from(bytes)).digest('hex'));
  });

  it('fails invalid semantic content with the projected report and no prepare RPC', async () => {
    const { call, state } = await makeHarness({ payload: clone(conformanceBasePayload) });
    const result = await call('prepare_publish', PREPARE_ARGS);
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('validation_failed');
    const validation = (result as unknown as Record<string, unknown>)['validation'] as ProjectedValidation;
    expect(validation.valid).toBe(false);
    expect(validation.issues.length).toBeGreaterThan(0);
    expect(validation.issues.length).toBeLessThanOrEqual(20);
    expect(rpcCalls(state, 'agent_prepare_publish')).toHaveLength(0);
  });

  it('blocks a normalized payload substitute and tells the host to save it first', async () => {
    const payload = validPayload() as unknown as Record<string, unknown>;
    // Valid draft whose contact lacks locationId; inspection normalizes it by
    // re-deriving the location reference, changing the payload identity.
    const contacts = payload['contacts'] as Array<Record<string, unknown>>;
    delete contacts[0]?.['locationId'];
    const { call, state } = await makeHarness({ payload: payload as unknown as PublishedContentPayload });
    const result = await call('prepare_publish', PREPARE_ARGS);
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('validation_failed');
    expect(result.error?.message).toContain('normalizou');
    expect(result.error?.message).toContain('apply_operations');
    expect(rpcCalls(state, 'agent_prepare_publish')).toHaveLength(0);
  });

  it('fails stale host generation and revision conflict with current state and no prepare RPC', async () => {
    const { call, state } = await makeHarness();
    const stale = await call('prepare_publish', { generation: 8, expectedRevision: 3 });
    expect(stale.ok).toBe(false);
    expect(stale.error?.code).toBe('stale_generation');
    expect((stale.error as unknown as Record<string, unknown>)['currentHead']).toMatchObject({ generation: 7 });
    const conflict = await call('prepare_publish', { generation: 7, expectedRevision: 4 });
    expect(conflict.ok).toBe(false);
    expect(conflict.error?.code).toBe('revision_conflict');
    expect((conflict.error as unknown as Record<string, unknown>)['currentRevision']).toBe(3);
    expect(rpcCalls(state, 'agent_prepare_publish')).toHaveLength(0);
  });

  it('fails fast on base/live misalignment, unverifiable draft digest, and unverifiable live publication', async () => {
    const misaligned = await makeHarness({ baseRevision: 2 });
    const staleBase = await misaligned.call('prepare_publish', PREPARE_ARGS);
    expect(staleBase.ok).toBe(false);
    expect(staleBase.error?.code).toBe('preparation_stale');
    const badDraftDigest = await makeHarness();
    badDraftDigest.state.draft = { ...badDraftDigest.state.draft, digest: '0'.repeat(64) };
    const draftCheck = await badDraftDigest.call('prepare_publish', PREPARE_ARGS);
    expect(draftCheck.ok).toBe(false);
    expect(draftCheck.error?.code).toBe('unavailable');
    const badLiveDigest = await makeHarness();
    badLiveDigest.state.published = { ...badLiveDigest.state.published, digest: 'bad'.padEnd(64, '0') };
    const liveCheck = await badLiveDigest.call('prepare_publish', PREPARE_ARGS);
    expect(liveCheck.ok).toBe(false);
    expect(liveCheck.error?.code).toBe('published_base_unavailable');
    for (const harness of [misaligned, badDraftDigest, badLiveDigest]) {
      expect(rpcCalls(harness.state, 'agent_prepare_publish')).toHaveLength(0);
    }
  });

  it('rejects out-of-bounds inputs with zero RPC', async () => {
    const { call, state } = await makeHarness();
    const bad = [
      { generation: 7 },
      { expectedRevision: 3 },
      { generation: 0, expectedRevision: 3 },
      { generation: 7, expectedRevision: 0 },
      { generation: '7', expectedRevision: 3 },
      { ...PREPARE_ARGS, payload: { flows: [] } },
    ];
    for (const args of bad) {
      const result = await call('prepare_publish', args);
      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('invalid_input');
    }
    expect(state.calls).toHaveLength(0);
  });

  it('creates another preparation on a repeated tool call (doc 04)', async () => {
    const { call, state } = await makeHarness();
    expect((await call('prepare_publish', PREPARE_ARGS)).ok).toBe(true);
    expect((await call('prepare_publish', PREPARE_ARGS)).ok).toBe(true);
    const prepares = rpcCalls(state, 'agent_prepare_publish');
    expect(prepares).toHaveLength(2);
    expect(prepares[0]?.args['p_preparation_id']).not.toBe(prepares[1]?.args['p_preparation_id']);
  });

  it('counts prepare and publish as mutations: max one concurrent', async () => {
    const { call, state } = await makeHarness();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    state.prepareBehavior = async (args) => {
      await gate;
      return prepareEcho(args);
    };
    const first = call('prepare_publish', PREPARE_ARGS);
    await new Promise((resolve) => setTimeout(resolve, 20));
    const second = await call('prepare_publish', PREPARE_ARGS);
    expect(second.ok).toBe(false);
    expect(second.error?.code).toBe('rate_limited');
    release();
    expect((await first).ok).toBe(true);
  });
});

describe('publish_draft', () => {
  it('publishes the pinned preparation with exactly the given id and token', async () => {
    const { call, state } = await makeHarness();
    const result = await call('publish_draft', PUBLISH_ARGS);
    expect(result.ok).toBe(true);
    expect(result.data).toEqual(PUBLISH_RESULT);
    const publishes = rpcCalls(state, 'agent_publish_draft');
    expect(publishes).toHaveLength(1);
    expect(publishes[0]?.args['p_preparation_id']).toBe(PUBLISH_ARGS.preparationId);
    expect(publishes[0]?.args['p_publish_token']).toBe(PUBLISH_ARGS.publishToken);
  });

  it('replays the same preparation once after an ambiguous outcome, never twice', async () => {
    const { call, state } = await makeHarness();
    let attempts = 0;
    state.publishBehavior = async (args) => {
      attempts += 1;
      if (attempts === 1) return { ok: false, error: { code: 'unavailable' } };
      return { ok: true, data: { ...PUBLISH_RESULT, digest: String(args['p_publish_token']).slice(0, 5) } };
    };
    const result = await call('publish_draft', PUBLISH_ARGS);
    expect(result.ok).toBe(true);
    expect((result.data as Record<string, unknown>)['digest']).toBe(PUBLISH_ARGS.publishToken.slice(0, 5));
    const publishes = rpcCalls(state, 'agent_publish_draft');
    expect(publishes).toHaveLength(2);
    expect(publishes[0]?.args).toEqual(publishes[1]?.args);
    expect(publishes[1]?.args['p_preparation_id']).toBe(PUBLISH_ARGS.preparationId);
    expect(publishes[1]?.args['p_publish_token']).toBe(PUBLISH_ARGS.publishToken);
    // A persistently ambiguous transport is retried at most once per invocation.
    const down = await makeHarness();
    down.state.publishBehavior = async () => ({ ok: false, error: { code: 'unavailable' } });
    const failed = await down.call('publish_draft', PUBLISH_ARGS);
    expect(failed.ok).toBe(false);
    expect(failed.error?.code).toBe('unavailable');
    expect(rpcCalls(down.state, 'agent_publish_draft')).toHaveLength(2);
  });

  it('maps preparation failures exactly and gives PT-BR guidance', async () => {
    const codes = [
      'preparation_invalid',
      'preparation_expired',
      'preparation_stale',
      'revision_conflict',
      'invalid_capability',
    ];
    for (const code of codes) {
      const { call, state } = await makeHarness();
      state.publishBehavior = async () => ({ ok: false, error: { code } });
      const result = await call('publish_draft', PUBLISH_ARGS);
      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe(code);
      expect(result.error?.message).not.toBe('A operação falhou.');
      expect(rpcCalls(state, 'agent_prepare_publish')).toHaveLength(0);
    }
  });

  it('reports preparation_stale when a mutation intervened after prepare', async () => {
    const { call, seed, state } = await makeHarness();
    await seed();
    expect((await call('prepare_publish', PREPARE_ARGS)).ok).toBe(true);
    expect((await call('apply_operations', groupTitleOp(state.draft.generation))).ok).toBe(true);
    const result = await call('publish_draft', PUBLISH_ARGS);
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('preparation_stale');
  });

  it('rejects malformed preparation ids, tokens, and arbitrary payload input with zero RPC', async () => {
    const { call, state } = await makeHarness();
    const bad = [
      { ...PUBLISH_ARGS, preparationId: 'not-a-uuid' },
      { ...PUBLISH_ARGS, preparationId: PUBLISH_ARGS.preparationId.toUpperCase() },
      { ...PUBLISH_ARGS, publishToken: 'A'.repeat(42) },
      { ...PUBLISH_ARGS, publishToken: `${'A'.repeat(43)}=` },
      { ...PUBLISH_ARGS, payload: { flows: [] } },
      { preparationId: PUBLISH_ARGS.preparationId },
      {},
    ];
    for (const args of bad) {
      const result = await call('publish_draft', args);
      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('invalid_input');
    }
    expect(rpcCalls(state, 'agent_publish_draft')).toHaveLength(0);
    expect(state.calls).toHaveLength(0);
  });

  it('rejects arbitrary publication payload input at the schema level', () => {
    const validate = (schema: Record<string, unknown>) =>
      fromJsonSchema(schema as Parameters<typeof fromJsonSchema>[0])['~standard'].validate;
    expect('issues' in validate(PUBLISH_DRAFT_SCHEMA)({ ...PUBLISH_ARGS })).toBe(false);
    expect('issues' in validate(PUBLISH_DRAFT_SCHEMA)({ ...PUBLISH_ARGS, payload: { flows: [] } })).toBe(true);
    expect('issues' in validate(PUBLISH_DRAFT_SCHEMA)({ ...PUBLISH_ARGS, publishToken: 'A'.repeat(42) })).toBe(true);
    expect('issues' in validate(PREPARE_PUBLISH_SCHEMA)(PREPARE_ARGS)).toBe(false);
    expect('issues' in validate(PREPARE_PUBLISH_SCHEMA)({ ...PREPARE_ARGS, content: {} })).toBe(true);
    expect('issues' in validate(PREPARE_PUBLISH_SCHEMA)({ generation: 0, expectedRevision: 1 })).toBe(true);
  });
});

describe('edit/save never publishes', () => {
  it('apply_operations and set_material_image issue no publication RPC', async () => {
    const { call, seed, state } = await makeHarness();
    await seed();
    expect((await call('apply_operations', groupTitleOp(state.draft.generation))).ok).toBe(true);
    await seed();
    const image = await call('set_material_image', {
      expectedGeneration: state.draft.generation,
      materialId: 'material-exemplo',
      slot: { kind: 'featured' },
      image: { kind: 'catalog', imageId: 'green-patch' },
    });
    expect(image.ok).toBe(true);
    const names = state.calls.map((entry) => entry.name);
    expect(names).not.toContain('agent_prepare_publish');
    expect(names).not.toContain('agent_publish_draft');
    expect(names).toContain('agent_apply_operations');
  });
});

describe('publication catalog', () => {
  it('ships the exact descriptions and annotations for the publication tools', () => {
    const specs = new Map(contentToolSpecs().map((spec) => [spec.name, spec]));
    const prepare = specs.get('prepare_publish');
    const publish = specs.get('publish_draft');
    expect(prepare?.description).toBe(
      'Validate and pin the exact current canonical draft for publication for 10 minutes. This does not publish. Obtain explicit user publication intent before publishing.',
    );
    expect(publish?.description).toBe(
      'Publish only when the user explicitly asks to publish. Editing, rewriting, improving, reviewing, importing, generating, or saving does not imply permission. Publishes the entire pinned shared draft, never arbitrary content. This changes live content and is destructive.',
    );
    expect(prepare?.annotations).toEqual(ANNOT(false, false));
    expect(publish?.annotations).toEqual(ANNOT(true, true));
  });
});
