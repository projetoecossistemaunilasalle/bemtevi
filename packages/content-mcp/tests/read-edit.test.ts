import { describe, expect, it } from 'vitest';
import { fromJsonSchema } from '@modelcontextprotocol/server';
import {
  applyOperations,
  conformanceBasePayload,
  sameContent,
  sha256Text,
  type ContentDraft,
  type ContentValidation,
  type DraftHead,
  type PublishedContentPayload,
} from '@bemtevi/content-core';
import { createDataApiClientWith } from '../src/client/dataApiClient';
import { BaseSnapshotCache } from '../src/session/baseSnapshotCache';
import { createToolDispatch } from '../src/server/dispatch';
import { createServer } from '../src/server/createServer';
import { SERVER_INSTRUCTIONS } from '../src/server/instructions';
import { contentToolSpecs, registerContentTools } from '../src/tools/definitions';
import { APPLY_OPERATIONS_SCHEMA } from '../src/tools/schemas';
import { projectValidation } from '../src/tools/shared';

/**
 * Read/edit tests (MCP-02): catalog schemas/descriptions/annotations,
 * get_editor_context double-fetch race and counts, list/get paging and labels,
 * find_references traversal and exclusions, validation projection, accepted
 * no-op, and input bounds.
 */

const CONNECTION_ID = '00000000-0000-4000-8000-0000000000c1';

const PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const GROUP_NOOP_OP = {
  op: 'update',
  scope: 'educationGroups',
  id: 'grupo-um',
  patch: { title: 'Grupo um' },
  unset: [],
};

type Wire = { ok: true; data: unknown } | { ok: false; error: { code: string; message?: string } };

interface FakeState {
  draft: ContentDraft;
  publishedRevision: number;
  calls: Array<{ name: string; args: Record<string, unknown> }>;
  contextBehavior: () => Wire;
  applyBehavior: (expectedGeneration: number, operations: unknown) => Promise<Wire>;
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

async function defaultApply(state: FakeState, expectedGeneration: number, operations: unknown): Promise<Wire> {
  if (expectedGeneration !== state.draft.generation) return { ok: false, error: { code: 'stale_generation' } };
  const applied = applyOperations(state.draft.payload, operations as never);
  if (applied.ok === false) return { ok: false, error: { code: applied.error.code, message: applied.error.message } };
  const changed = !sameContent(applied.data, state.draft.payload);
  if (changed) state.draft = await makeDraft(applied.data, state.draft.generation + 1, state.draft.baseRevision);
  return { ok: true, data: { head: headFields(state.draft), changed } };
}

function contextWire(head: DraftHead, publishedRevision: number): Wire {
  const expiresAt = '2026-12-31T00:00:00.000Z';
  return {
    ok: true,
    data: { head, publishedRevision, principalUserId: 'admin-1', connectionId: CONNECTION_ID, expiresAt },
  };
}

async function makeHarness(options: { payload?: PublishedContentPayload; generation?: number } = {}) {
  const state: FakeState = {
    draft: await makeDraft(clone(options.payload ?? validPayload()), options.generation ?? 7),
    publishedRevision: 3,
    calls: [],
    contextBehavior: () => contextWire(headFields(state.draft), state.publishedRevision),
    applyBehavior: (generation, operations) => defaultApply(state, generation, operations),
  };
  const now = 1_000_000;
  const client = createDataApiClientWith(async (name, args) => {
    state.calls.push({ name, args });
    if (name === 'agent_get_editor_context') return { data: state.contextBehavior() };
    if (name === 'agent_get_draft') return { data: { ok: true, data: state.draft } };
    if (name === 'agent_apply_operations') {
      return { data: await state.applyBehavior(Number(args['p_expected_generation']), args['p_operations']) };
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
      delay: () => Promise.resolve(),
      cache,
    },
    dispatch,
  );
  const call = async (name: string, args: Record<string, unknown> = {}) => dispatch.dispatch(name, args);
  return { state, dispatch, cache, call, seed: () => call('get_editor_context') };
}

const READ_ANNOTATIONS = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const WRITE_ANNOTATIONS = { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false };

const DESCRIPTIONS: Record<string, string> = {
  get_editor_context:
    'Read the current shared draft generation and editorial rules. This caches a base for 15 minutes. It does not edit or publish.',
  list_items:
    'List draft item IDs and labels at a cached generation, up to 100 per page. Call get_editor_context again if the base has expired.',
  get_item:
    'Read a draft item or one top-level field as paged JSON text, without embedded image bytes. Concatenate pages before parsing. It does not edit.',
  find_references:
    'Find exact string references to an ID in the cached draft. Results are advisory and may include non-reference text. They do not authorize deletion.',
  apply_operations:
    'Apply 1 to 200 explicit operations atomically to the shared draft. Uses generation checks and one safe semantic-merge retry. Invalid structure is rejected; semantic issues are reported. This never publishes.',
  set_material_image:
    'Set or remove one material image with generation checks. Upload PNG, JPEG or WebP bytes up to 1 MiB, at most 4096 per dimension and 16 megapixels. No local path or URL fetching. This never publishes.',
  get_diff:
    'Compare the cached draft with the current live publication. Read all pages before deciding to publish. No content is changed.',
};

describe('tool catalog', () => {
  it('registers the seven read/edit/image tools plus the MCP-03 publication tools', async () => {
    const { dispatch } = await makeHarness();
    expect(dispatch.names()).toEqual([...Object.keys(DESCRIPTIONS), 'prepare_publish', 'publish_draft']);
  });

  it('ships the exact doc-04 descriptions', () => {
    const specs = new Map(contentToolSpecs().map((spec) => [spec.name, spec.description]));
    for (const [name, description] of Object.entries(DESCRIPTIONS)) expect(specs.get(name)).toBe(description);
  });

  it('uses read annotations for reads, destructive annotations for mutations, openWorldHint false everywhere', () => {
    const specs = new Map(contentToolSpecs().map((spec) => [spec.name, spec.annotations]));
    for (const name of ['get_editor_context', 'list_items', 'get_item', 'find_references', 'get_diff']) {
      expect(specs.get(name)).toEqual(READ_ANNOTATIONS);
    }
    for (const name of ['apply_operations', 'set_material_image']) {
      expect(specs.get(name)).toEqual(WRITE_ANNOTATIONS);
    }
  });

  it('fills strict input schemas and adapts them through the SDK fromJsonSchema', () => {
    const specs = contentToolSpecs();
    for (const spec of specs) {
      expect(spec.inputSchema['type']).toBe('object');
      expect(spec.inputSchema['additionalProperties']).toBe(false);
      expect(Array.isArray(spec.inputSchema['required'])).toBe(true);
    }
    const apply = specs.find((spec) => spec.name === 'apply_operations');
    expect((apply?.inputSchema['properties'] as Record<string, unknown>)['operations']).toBeDefined();
    // The factory compiles every schema through the SDK adapter (throws if invalid).
    expect(() => createServer(createToolDispatch(), specs)).not.toThrow();
  });

  it('rejects unknown keys and empty batches through the adapted schema', () => {
    const adapted = fromJsonSchema(APPLY_OPERATIONS_SCHEMA as Parameters<typeof fromJsonSchema>[0]);
    const validate = adapted['~standard'].validate;
    const valid = validate({ expectedGeneration: 7, operations: [{ op: 'set_default_group_order', value: 2 }] });
    expect('issues' in valid).toBe(false);
    const extraKey = validate({
      expectedGeneration: 7,
      operations: [{ op: 'set_default_group_order', value: 2 }],
      extra: 1,
    });
    expect('issues' in extraKey).toBe(true);
    const emptyBatch = validate({ expectedGeneration: 7, operations: [] });
    expect('issues' in emptyBatch).toBe(true);
  });
});

describe('get_editor_context', () => {
  it('returns head, published revision, connection identity, instructions, and per-scope counts', async () => {
    const { call, state } = await makeHarness();
    const result = await call('get_editor_context');
    expect(result.ok).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect((data.head as DraftHead).generation).toBe(7);
    expect(data.publishedRevision).toBe(3);
    expect(data.connectionId).toBe(CONNECTION_ID);
    expect(data.principalUserId).toBe('admin-1');
    expect(data.expiresAt).toBe('2026-12-31T00:00:00.000Z');
    expect(data.instructions).toBe(SERVER_INSTRUCTIONS);
    expect(data.counts).toEqual({ flows: 1, educationMaterials: 1, educationGroups: 2, contacts: 1, locations: 1 });
    expect(state.calls.map((entry) => entry.name)).toEqual(['agent_get_editor_context', 'agent_get_draft']);
  });

  it('repeats the context+draft pair once when the generation raced and then succeeds', async () => {
    const { call, state } = await makeHarness();
    let contextCalls = 0;
    state.contextBehavior = () => {
      contextCalls += 1;
      const head = headFields(state.draft);
      return contextWire({ ...head, generation: contextCalls === 1 ? head.generation + 1 : head.generation }, 3);
    };
    const result = await call('get_editor_context');
    expect(result.ok).toBe(true);
    expect((result.data as Record<string, unknown>)['head']).toMatchObject({ generation: 7 });
    expect(state.calls.filter((entry) => entry.name === 'agent_get_editor_context')).toHaveLength(2);
    expect(state.calls.filter((entry) => entry.name === 'agent_get_draft')).toHaveLength(2);
  });

  it('returns retry_required when the generation races twice', async () => {
    const { call, state } = await makeHarness();
    state.contextBehavior = () => {
      const head = headFields(state.draft);
      return contextWire({ ...head, generation: head.generation + 5 }, 3);
    };
    const result = await call('get_editor_context');
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('retry_required');
  });

  it('caches a verified base so paged reads work without a new fetch', async () => {
    const { call, seed, state } = await makeHarness();
    await seed();
    const reads = state.calls.length;
    const page = await call('list_items', { generation: 7, scope: 'educationGroups' });
    expect(page.ok).toBe(true);
    expect(state.calls.length).toBe(reads);
  });
});

describe('list_items', () => {
  it('pages a scope collection with nextOffset and stable labels', async () => {
    const { call, seed } = await makeHarness();
    await seed();
    const first = await call('list_items', { generation: 7, scope: 'educationGroups', limit: 1 });
    expect(first.data).toEqual({ generation: 7, items: [{ id: 'grupo-um', label: 'Grupo um' }], nextOffset: 1 });
    const second = await call('list_items', { generation: 7, scope: 'educationGroups', offset: 1, limit: 1 });
    expect(second.data).toMatchObject({ items: [{ id: 'grupo-dois', label: 'Grupo dois' }], nextOffset: null });
  });

  it('uses title, then name, then id for labels and truncates to 160 characters', async () => {
    const payload = clone(conformanceBasePayload);
    payload.flows[0]!.title = 'F'.repeat(200);
    (payload.contacts[0] as unknown as Record<string, unknown>) = { id: 'contato-um', name: 'CVV' };
    const { call, cache } = await makeHarness();
    const draft = await makeDraft(payload, 7);
    cache.insert({
      connectionId: CONNECTION_ID,
      generation: 7,
      head: headFields(draft),
      payload,
      canonicalPayload: JSON.stringify(payload),
      verified: true,
    });
    const flows = await call('list_items', { generation: 7, scope: 'flows' });
    expect((flows.data as { items: Array<{ label: string }> }).items[0]?.label).toHaveLength(160);
    const contacts = await call('list_items', { generation: 7, scope: 'contacts' });
    expect((contacts.data as { items: Array<{ label: string }> }).items[0]?.label).toBe('CVV');
    const locations = await call('list_items', { generation: 7, scope: 'locations' });
    expect((locations.data as { items: Array<{ label: string }> }).items[0]?.label).toBe('local-um');
  });

  it('fails safely when the generation is not in cache', async () => {
    const { call } = await makeHarness();
    const page = await call('list_items', { generation: 42, scope: 'flows' });
    expect(page.ok).toBe(false);
    expect(page.error?.code).toBe('rebase_required');
  });
});

describe('get_item', () => {
  it('returns the whole item as paged JSON text with concatenated pages', async () => {
    const { call, seed } = await makeHarness();
    await seed();
    const first = await call('get_item', { generation: 7, scope: 'educationGroups', id: 'grupo-um', limit: 10 });
    const total = (first.data as { totalCharacters: number }).totalCharacters;
    expect(first.data).toMatchObject({ generation: 7, id: 'grupo-um', field: null, nextOffset: 10 });
    const second = await call('get_item', {
      generation: 7,
      scope: 'educationGroups',
      id: 'grupo-um',
      offset: 10,
      limit: Math.max(total - 10, 1),
    });
    const concatenated = (first.data as { jsonText: string }).jsonText + (second.data as { jsonText: string }).jsonText;
    expect(JSON.parse(concatenated)).toEqual({
      id: 'grupo-um',
      title: 'Grupo um',
      description: 'Primeiro grupo.',
      order: 1,
    });
    expect((second.data as { nextOffset: number | null }).nextOffset).toBeNull();
  });

  it('reads a single top-level field and rejects unknown fields and missing items', async () => {
    const { call, seed } = await makeHarness();
    await seed();
    const field = await call('get_item', { generation: 7, scope: 'locations', id: 'local-um', field: 'city' });
    expect(JSON.parse((field.data as { jsonText: string }).jsonText)).toBe('Curitiba');
    expect((field.data as { field: string | null }).field).toBe('city');
    const unknownField = await call('get_item', { generation: 7, scope: 'locations', id: 'local-um', field: 'nope' });
    expect(unknownField.error?.code).toBe('invalid_input');
    const missing = await call('get_item', { generation: 7, scope: 'locations', id: 'outro' });
    expect(missing.error?.code).toBe('invalid_input');
  });

  it('replaces embedded data URLs but preserves catalog IDs and external URLs', async () => {
    const payload = clone(conformanceBasePayload);
    const material = payload.educationMaterials[0] as unknown as Record<string, unknown>;
    material.imageUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';
    const { call, cache } = await makeHarness();
    const draft = await makeDraft(payload, 7);
    cache.insert({
      connectionId: CONNECTION_ID,
      generation: 7,
      head: headFields(draft),
      payload,
      canonicalPayload: JSON.stringify(payload),
      verified: true,
    });
    const page = await call('get_item', { generation: 7, scope: 'educationMaterials', id: 'material-exemplo' });
    const text = (page.data as { jsonText: string }).jsonText;
    expect(text).toContain('[embedded image omitted]');
    expect(text).not.toContain('data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==');
    expect(text).toContain('https://exemplo.bemtevi.org/corpo.png');
  });
});

describe('find_references', () => {
  it('finds exact string references with deterministic JSON-pointer paths', async () => {
    const { call, seed } = await makeHarness();
    await seed();
    const result = await call('find_references', { generation: 7, id: 'local-um' });
    expect(result.data).toEqual({
      generation: 7,
      references: [{ scope: 'contacts', id: 'contato-um', path: '/contacts/0/locationId' }],
      nextOffset: null,
    });
    const group = await call('find_references', { generation: 7, id: 'grupo-um' });
    expect((group.data as { references: Array<{ path: string }> }).references).toEqual([
      { scope: 'educationMaterials', id: 'material-exemplo', path: '/educationMaterials/0/group' },
    ]);
  });

  it('excludes keys named id and image data fields', async () => {
    const { call, seed } = await makeHarness();
    await seed();
    const byId = await call('find_references', { generation: 7, id: 'grupo-um' });
    expect(JSON.stringify((byId.data as { references: unknown[] }).references)).not.toContain('/educationGroups');
    const dataUrl = PNG_DATA_URL;
    const payload = clone(conformanceBasePayload);
    (payload.educationMaterials[0] as unknown as Record<string, unknown>).imageUrl = dataUrl;
    const harness = await makeHarness({ payload });
    await harness.seed();
    const imageSearch = await harness.call('find_references', { generation: 7, id: dataUrl });
    expect((imageSearch.data as { references: unknown[] }).references).toEqual([]);
  });

  it('paginates references', async () => {
    const payload = clone(conformanceBasePayload);
    payload.educationMaterials[0]!.group = 'grupo-um';
    payload.educationGroups[0]!.description = 'grupo-um';
    const harness = await makeHarness({ payload });
    await harness.seed();
    const page = await harness.call('find_references', { generation: 7, id: 'grupo-um', limit: 1 });
    expect(page.data).toMatchObject({ references: [{ path: '/educationMaterials/0/group' }], nextOffset: 1 });
    const rest = await harness.call('find_references', { generation: 7, id: 'grupo-um', offset: 1, limit: 10 });
    expect((rest.data as { references: Array<{ path: string }> }).references).toEqual([
      { scope: 'educationGroups', id: 'grupo-um', path: '/educationGroups/0/description' },
    ]);
  });
});

describe('candidate validation reporting', () => {
  it('projects at most 20 issues and appends one output_truncated warning', () => {
    const issues = Array.from({ length: 25 }, (_, index) => ({
      code: `codigo_${index}`,
      level: 'warning' as const,
      message: `Problema ${index}`,
      path: `/flows/${index}`,
    }));
    const projected = projectValidation({ valid: true, issues } satisfies ContentValidation);
    expect(projected.valid).toBe(true);
    expect(projected.issues).toHaveLength(21);
    expect(projected.issues[20]).toMatchObject({ code: 'output_truncated', level: 'warning' });
    expect(projected.issues[0]).toMatchObject({ code: 'codigo_0' });
  });

  it('truncates code, message, and path fields to the frozen bounds', () => {
    const projected = projectValidation({
      valid: false,
      issues: [{ code: 'c'.repeat(300), level: 'error', message: 'm'.repeat(400), path: '/'.concat('p'.repeat(400)) }],
    } satisfies ContentValidation);
    expect(projected.issues[0]?.code).toHaveLength(120);
    expect(projected.issues[0]?.message).toHaveLength(300);
    expect(projected.issues[0]?.path).toHaveLength(200);
    expect(projected.valid).toBe(false);
  });

  it('reports semantic issues from a mutated candidate without rejecting the save', async () => {
    // The conformance fixture carries two deliberate semantic errors; the save
    // is still accepted and the complete report is projected into the result.
    const { call, seed } = await makeHarness({ payload: clone(conformanceBasePayload) });
    await seed();
    const result = await call('apply_operations', { expectedGeneration: 7, operations: [GROUP_NOOP_OP] });
    expect(result.ok).toBe(true);
    const data = result.data as { changed: boolean; validation: ContentValidation; merged: boolean };
    expect(data.changed).toBe(false);
    expect(data.validation.valid).toBe(false);
    expect(data.validation.issues.length).toBeGreaterThanOrEqual(2);
    expect(data.merged).toBe(false);
  });
});

describe('accepted no-op and input bounds', () => {
  it('keeps the generation and the verified base for an accepted no-op', async () => {
    const { call, seed, state } = await makeHarness();
    await seed();
    const callsBefore = state.calls.length;
    const result = await call('apply_operations', { expectedGeneration: 7, operations: [GROUP_NOOP_OP] });
    expect(result.ok).toBe(true);
    expect((result.data as { head: DraftHead }).head.generation).toBe(7);
    expect((result.data as { changed: boolean }).changed).toBe(false);
    expect(state.calls.slice(callsBefore).map((entry) => entry.name)).toEqual(['agent_apply_operations']);
    const read = await call('list_items', { generation: 7, scope: 'flows' });
    expect(read.ok).toBe(true);
  });

  it('rejects batches outside 1..200 operations with no RPC call', async () => {
    const { call, seed, state } = await makeHarness();
    await seed();
    const callsBefore = state.calls.length;
    const huge = Array.from({ length: 201 }, (_, index) => ({ ...GROUP_NOOP_OP, patch: { title: `T${index}` } }));
    const tooMany = await call('apply_operations', { expectedGeneration: 7, operations: huge });
    expect(tooMany.error?.code).toBe('invalid_input');
    const empty = await call('apply_operations', { expectedGeneration: 7, operations: [] });
    expect(empty.error?.code).toBe('invalid_input');
    expect(state.calls.length).toBe(callsBefore);
  });

  it('rejects structurally invalid operations locally with the frozen code', async () => {
    const { call, seed } = await makeHarness();
    await seed();
    const bad = await call('apply_operations', {
      expectedGeneration: 7,
      operations: [{ op: 'update', scope: 'educationGroups', id: 'grupo-um', patch: { naoPermitido: 'x' }, unset: [] }],
    });
    expect(bad.error?.code).toBe('invalid_operations');
    const missing = await call('apply_operations', {
      expectedGeneration: 7,
      operations: [{ op: 'delete', scope: 'locations', id: 'local-inexistente', confirmation: true }],
    });
    expect(missing.error?.code).toBe('invalid_operations');
  });
});
