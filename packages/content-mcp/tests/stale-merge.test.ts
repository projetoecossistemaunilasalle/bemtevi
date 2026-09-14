import { describe, expect, it } from 'vitest';
import {
  applyOperations,
  conformanceBasePayload,
  sameContent,
  sha256Text,
  type ContentDraft,
  type DraftHead,
  type PublishedContentPayload,
  type SemanticConflict,
} from '@bemtevi/content-core';
import { createDataApiClientWith } from '../src/client/dataApiClient';
import { BaseSnapshotCache } from '../src/session/baseSnapshotCache';
import { createToolDispatch } from '../src/server/dispatch';
import { registerContentTools } from '../src/tools/definitions';

/**
 * Stale-merge tests (MCP-02 / docs 03-04): one bounded merge-and-CAS retry,
 * overlap/delete/order conflicts with the original conflict objects, the
 * second stale attempt bounded with the base preserved, ambiguous-save
 * recovery, missing-cache safe failure, and the empty encoded delta shortcut.
 */

const CONNECTION_ID = '00000000-0000-4000-8000-0000000000c1';

type Wire = { ok: true; data: unknown } | { ok: false; error: { code: string; message?: string } };

interface FakeState {
  draft: ContentDraft;
  calls: Array<{ name: string; args: Record<string, unknown> }>;
  applyBehavior: (expectedGeneration: number, operations: unknown) => Promise<Wire>;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function headFields(draft: ContentDraft): DraftHead {
  return {
    id: 'current',
    schemaVersion: draft.schemaVersion,
    baseRevision: draft.baseRevision,
    generation: draft.generation,
    digest: draft.digest,
    updatedAt: draft.updatedAt,
    lastActor: draft.lastActor,
  };
}

async function makeDraft(payload: PublishedContentPayload, generation: number): Promise<ContentDraft> {
  const canonicalPayload = JSON.stringify(payload);
  return {
    id: 'current',
    schemaVersion: '1.0.0',
    status: 'active',
    baseRevision: 3,
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
  if (changed) state.draft = await makeDraft(applied.data, state.draft.generation + 1);
  return { ok: true, data: { head: headFields(state.draft), changed } };
}

async function makeHarness() {
  const state: FakeState = {
    draft: await makeDraft(clone(conformanceBasePayload), 7),
    calls: [],
    applyBehavior: (generation, operations) => defaultApply(state, generation, operations),
  };
  const client = createDataApiClientWith(async (name, args) => {
    state.calls.push({ name, args });
    if (name === 'agent_get_editor_context') {
      return {
        data: {
          ok: true,
          data: {
            head: headFields(state.draft),
            publishedRevision: 3,
            principalUserId: 'admin-1',
            connectionId: CONNECTION_ID,
            expiresAt: 'e',
          },
        },
      };
    }
    if (name === 'agent_get_draft') return { data: { ok: true, data: state.draft } };
    if (name === 'agent_apply_operations') {
      return { data: await state.applyBehavior(Number(args['p_expected_generation']), args['p_operations']) };
    }
    return { data: { ok: false, error: { code: 'unavailable' } } };
  });
  const cache = new BaseSnapshotCache({ clock: () => 1_000_000 });
  const dispatch = createToolDispatch();
  registerContentTools(
    {
      client,
      connectionId: CONNECTION_ID,
      agentToken: 'A'.repeat(43),
      clock: () => 1_000_000,
      delay: () => Promise.resolve(),
      cache,
    },
    dispatch,
  );
  const call = async (name: string, args: Record<string, unknown> = {}) => dispatch.dispatch(name, args);
  const applyCalls = () => state.calls.filter((entry) => entry.name === 'agent_apply_operations');
  return { state, cache, call, seed: () => call('get_editor_context'), applyCalls };
}

const TITLE_OP = { op: 'update', scope: 'educationGroups', id: 'grupo-um', patch: { title: 'Grupo local' }, unset: [] };

describe('stale generation merge', () => {
  it('reconciles independent edits and retries once against the remote generation', async () => {
    const { call, seed, state, applyCalls } = await makeHarness();
    await seed();
    const remote = clone(conformanceBasePayload);
    (remote.contacts[0] as unknown as Record<string, unknown>).hours = 'Remota: 8h às 18h';
    state.draft = await makeDraft(remote, 8);
    const result = await call('apply_operations', {
      expectedGeneration: 7,
      operations: [
        TITLE_OP,
        { op: 'update', scope: 'contacts', id: 'contato-um', patch: { address: 'Rua local, 1' }, unset: [] },
      ],
    });
    expect(result.ok).toBe(true);
    const data = result.data as { head: DraftHead; changed: boolean; merged: boolean };
    expect(data.merged).toBe(true);
    expect(data.changed).toBe(true);
    expect(data.head.generation).toBe(9);
    expect(applyCalls()).toHaveLength(2);
    expect(applyCalls()[0]?.args['p_expected_generation']).toBe(7);
    expect(applyCalls()[1]?.args['p_expected_generation']).toBe(8);
    // The retry carries the ENCODED delta against the remote: the local edits
    // only, because the remote hours change is already there.
    const retried = applyCalls()[1]?.args['p_operations'] as Array<Record<string, unknown>>;
    expect(retried).toHaveLength(2);
    expect(retried[0]).toEqual({
      op: 'update',
      scope: 'educationGroups',
      id: 'grupo-um',
      patch: { title: 'Grupo local' },
      unset: [],
    });
    expect(retried[1]).toEqual({
      op: 'update',
      scope: 'contacts',
      id: 'contato-um',
      patch: { address: 'Rua local, 1' },
      unset: [],
    });
  });

  it('skips the second RPC when the encoded delta is empty and reports merged no-op', async () => {
    const { call, seed, state, applyCalls } = await makeHarness();
    await seed();
    const remote = clone(conformanceBasePayload);
    remote.educationGroups[0]!.title = 'Grupo local';
    state.draft = await makeDraft(remote, 8);
    const result = await call('apply_operations', { expectedGeneration: 7, operations: [TITLE_OP] });
    expect(result.ok).toBe(true);
    const data = result.data as { head: DraftHead; changed: boolean; merged: boolean };
    expect(data.merged).toBe(true);
    expect(data.changed).toBe(false);
    expect(data.head.generation).toBe(8);
    expect(applyCalls()).toHaveLength(1);
  });

  it('returns the original semantic conflicts for overlapping edits', async () => {
    const { call, seed, state } = await makeHarness();
    await seed();
    const remote = clone(conformanceBasePayload);
    remote.educationGroups[0]!.title = 'Grupo remoto';
    state.draft = await makeDraft(remote, 8);
    const result = await call('apply_operations', { expectedGeneration: 7, operations: [TITLE_OP] });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('merge_conflict');
    const conflicts = (result.error as unknown as { conflicts: SemanticConflict[] }).conflicts;
    expect(Array.isArray(conflicts)).toBe(true);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.path.at(-1)).toMatchObject({ kind: 'field', key: 'title' });
    expect(conflicts[0]?.local).toEqual({ present: true, value: 'Grupo local' });
    expect(conflicts[0]?.remote).toEqual({ present: true, value: 'Grupo remoto' });
    // The cached base is preserved so the host can inspect the draft.
    const read = await call('list_items', { generation: 7, scope: 'educationGroups' });
    expect(read.ok).toBe(true);
  });

  it('reports delete and order conflicts without resurrecting or silently deleting', async () => {
    const { call, seed, state } = await makeHarness();
    await seed();
    const remote = clone(conformanceBasePayload);
    remote.educationGroups = remote.educationGroups.filter((group) => group.id !== 'grupo-dois');
    state.draft = await makeDraft(remote, 8);
    const deleted = await call('apply_operations', {
      expectedGeneration: 7,
      operations: [
        { op: 'update', scope: 'educationGroups', id: 'grupo-dois', patch: { title: 'Ainda aqui?' }, unset: [] },
      ],
    });
    expect(deleted.error?.code).toBe('merge_conflict');

    const base = clone(conformanceBasePayload);
    base.educationGroups.push({ id: 'grupo-tres', title: 'Grupo tres', order: 3 });
    const harness = await makeHarness();
    harness.state.draft = await makeDraft(base, 7);
    await harness.seed();
    harness.state.draft = await makeDraft(
      { ...base, educationGroups: [base.educationGroups[0]!, base.educationGroups[2]!, base.educationGroups[1]!] },
      8,
    );
    const ordered = await harness.call('apply_operations', {
      expectedGeneration: 7,
      operations: [{ op: 'reorder', scope: 'educationGroups', ids: ['grupo-dois', 'grupo-um', 'grupo-tres'] }],
    });
    expect(ordered.ok).toBe(false);
    expect(ordered.error?.code).toBe('merge_conflict');
    const conflicts = (ordered.error as unknown as { conflicts: SemanticConflict[] }).conflicts;
    expect(conflicts.some((conflict) => conflict.path.at(-1)?.kind === 'order')).toBe(true);
  });

  it('bounds the retry: a second stale attempt is retry_required with the base preserved', async () => {
    const { call, seed, state, applyCalls } = await makeHarness();
    await seed();
    const remote = clone(conformanceBasePayload);
    (remote.contacts[0] as unknown as Record<string, unknown>).address = 'Avenida remota, 9';
    state.draft = await makeDraft(remote, 8);
    state.applyBehavior = () => Promise.resolve({ ok: false, error: { code: 'stale_generation' } });
    const result = await call('apply_operations', { expectedGeneration: 7, operations: [TITLE_OP] });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('retry_required');
    expect(applyCalls()).toHaveLength(2);
    const read = await call('list_items', { generation: 7, scope: 'educationGroups' });
    expect(read.ok).toBe(true);
  });
});

describe('ambiguous save outcomes', () => {
  it('recovers a saved ambiguous result by comparing with sameContent', async () => {
    const { call, seed, state, applyCalls } = await makeHarness();
    await seed();
    const saved = clone(conformanceBasePayload);
    saved.educationGroups[0]!.title = 'Grupo local';
    state.draft = await makeDraft(saved, 8);
    state.applyBehavior = () => Promise.resolve({ ok: false, error: { code: 'unavailable' } });
    const result = await call('apply_operations', { expectedGeneration: 7, operations: [TITLE_OP] });
    expect(result.ok).toBe(true);
    const data = result.data as { head: DraftHead; changed: boolean; merged: boolean };
    expect(data.changed).toBe(true);
    expect(data.merged).toBe(false);
    expect(data.head.generation).toBe(8);
    expect(applyCalls()).toHaveLength(1);
  });

  it('takes the reconcile path when the ambiguous remote differs from the candidate', async () => {
    const { call, seed, state, applyCalls } = await makeHarness();
    await seed();
    const remote = clone(conformanceBasePayload);
    (remote.contacts[0] as unknown as Record<string, unknown>).address = 'Avenida remota, 9';
    state.draft = await makeDraft(remote, 8);
    let applies = 0;
    state.applyBehavior = (generation, operations) => {
      applies += 1;
      if (generation === 7) return Promise.resolve({ ok: false, error: { code: 'unavailable' } });
      return defaultApply(state, generation, operations);
    };
    const result = await call('apply_operations', { expectedGeneration: 7, operations: [TITLE_OP] });
    expect(result.ok).toBe(true);
    expect((result.data as { merged: boolean }).merged).toBe(true);
    expect(applies).toBe(2);
    expect(applyCalls()).toHaveLength(2);
  });
});

describe('missing cache and bounded outputs', () => {
  it('fails safely with rebase_required when no verified base is cached', async () => {
    const { call, state } = await makeHarness();
    const result = await call('apply_operations', { expectedGeneration: 7, operations: [TITLE_OP] });
    expect(result.error?.code).toBe('rebase_required');
    expect(state.calls).toEqual([]);
  });

  it('returns response_too_large when the conflict payload cannot fit the output', async () => {
    const { call, seed, state } = await makeHarness();
    await seed();
    const giant = 'A'.repeat(150_000);
    const remote = clone(conformanceBasePayload);
    (remote.contacts[0] as unknown as Record<string, unknown>).notes = 'B'.repeat(150_000);
    state.draft = await makeDraft(remote, 8);
    const result = await call('apply_operations', {
      expectedGeneration: 7,
      operations: [{ op: 'update', scope: 'contacts', id: 'contato-um', patch: { notes: giant }, unset: [] }],
    });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('response_too_large');
  });
});
