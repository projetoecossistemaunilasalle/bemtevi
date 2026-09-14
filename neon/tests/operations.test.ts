import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import type { DraftHead } from '@bemtevi/content-core';
import {
  applyOperations,
  conformanceBasePayload,
  fixtureAddValues,
  fixtureImageActionOperations,
  fixtureNoopOperations,
  fixtureSemanticInvalidOperations,
  fixtureUnsetOperations,
  sha256Text,
  type EditorialOperation,
} from '@bemtevi/content-core';
import type { TApplyContentDraftOperations, TGetContentDraft } from './rpc-types';

/**
 * DB-01 live Neon suite: SQL/TS operation fixture parity, allowlist
 * enforcement and all-or-nothing batch semantics (dossier 14/15). Executed by
 * the DB-04 harness; missing environment fails closed (no skip). See
 * drafts.test.ts for the required environment contract.
 */

interface WireResult {
  ok: boolean;
  data?: unknown;
  error?: { code: string };
}

interface Harness {
  owner: Client;
  dataApiUrl: string;
  adminAToken: string;
  adminBToken: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`missing required environment variable: ${name}`);
  }
  return value;
}

const harness: Harness = {
  owner: new Client({ connectionString: 'pending' }),
  dataApiUrl: 'pending',
  adminAToken: 'pending',
  adminBToken: 'pending',
};

const BASE = conformanceBasePayload;

async function callRpc(token: string, functionName: string, args: Record<string, unknown>): Promise<WireResult> {
  const response = await fetch(`${harness.dataApiUrl}/rpc/${functionName}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(args),
  });
  // The Data API denies EXECUTE at the HTTP layer when a role lacks the grant;
  // normalize it to the wrapper's `unauthorized` envelope.
  if (response.status === 401 || response.status === 403 || response.status === 404) {
    return { ok: false, error: { code: 'unauthorized' } } as WireResult;
  }
  return (await response.json()) as WireResult;
}

async function resetDraft(): Promise<void> {
  // FK-safe reset order: rows on real Neon reference connections via history.
  await harness.owner.query(
    `delete from public.content_publish_preparations;
     delete from public.content_edit_exports;
     delete from public.published_content;
     delete from public.published_content_history;
     delete from public.content_agent_connections;
     delete from public.content_drafts;`,
  );
  await harness.owner.query(
    `insert into public.published_content (id, schema_version, revision, payload, published_by)
     values ('current', '1.0.0', 42, $1::jsonb, $2)`,
    [JSON.stringify(BASE), process.env['NEON_TEST_ADMIN_A_USER_ID']],
  );
  await callRpc(harness.adminAToken, 'get_content_draft', {});
}

async function loadDraft(): Promise<TGetContentDraft> {
  const result = await callRpc(harness.adminAToken, 'get_content_draft', {});
  return (result as { ok: boolean; data?: unknown }).data as TGetContentDraft;
}

async function loadHead(): Promise<DraftHead> {
  const result = await callRpc(harness.adminAToken, 'get_content_draft_head', {});
  return (result as { ok: boolean; data?: unknown }).data as DraftHead;
}

async function applyOperationsRemote(operations: unknown[]): Promise<WireResult> {
  const head = await loadHead();
  return callRpc(harness.adminAToken, 'apply_content_draft_operations', {
    p_expected_generation: head.generation,
    p_operations: operations,
  });
}

beforeAll(async () => {
  harness.owner = new Client({ connectionString: requireEnv('NEON_TEST_OWNER_DATABASE_URL') });
  harness.dataApiUrl = requireEnv('NEON_TEST_DATA_API_URL');
  harness.adminAToken = requireEnv('NEON_TEST_ADMIN_A_TOKEN');
  harness.adminBToken = requireEnv('NEON_TEST_ADMIN_B_TOKEN');
  await harness.owner.connect();
  await harness.owner.query(
    `insert into public.admin_users (user_id) values ($1)
     on conflict (user_id) do nothing`,
    [requireEnv('NEON_TEST_ADMIN_A_USER_ID')],
  );
});

afterAll(async () => {
  await harness.owner.end();
});

describe('SQL/TS operation fixture parity', () => {
  const addCases = Object.entries(fixtureAddValues) as Array<[string, Record<string, unknown>]>;
  it.each(addCases)('add fixture for %s matches the core result', async (scope, value) => {
    const operation = {
      op: 'add',
      scope,
      value,
    } as unknown as EditorialOperation;
    const local = applyOperations(BASE, [operation]);
    await resetDraft();
    const remote = await applyOperationsRemote([operation]);
    expect(remote.ok).toBe(true);
    expect(local.ok).toBe(true);
    const draft = await loadDraft();
    expect(draft.payload).toEqual((local as { ok: true; data: unknown }).data);
  });

  it.each(Object.entries(fixtureUnsetOperations))(
    'unset fixtures for %s match the core result',
    async (scope, operations) => {
      if (operations.length === 0) return;
      const local = applyOperations(BASE, operations);
      await resetDraft();
      const remote = await applyOperationsRemote(operations);
      expect(remote.ok).toBe(local.ok);
      expect(local.ok).toBe(true);
      const draft = await loadDraft();
      expect(draft.payload).toEqual((local as { ok: true; data: unknown }).data);
    },
  );

  it.each(fixtureImageActionOperations)(
    'image action fixture %s matches the core result',
    async ({ name, operation }) => {
      const local = applyOperations(BASE, [operation]);
      await resetDraft();
      const remote = await applyOperationsRemote([operation]);
      expect(remote.ok).toBe(true);
      expect(local.ok).toBe(true);
      const draft = await loadDraft();
      expect(draft.payload).toEqual((local as { ok: true; data: unknown }).data);
      expect(name.length).toBeGreaterThan(0);
    },
  );

  it('accepts the no-op fixture on both sides without advancing generation', async () => {
    const local = applyOperations(BASE, fixtureNoopOperations);
    await resetDraft();
    const before = await loadDraft();
    const remote = await applyOperationsRemote(fixtureNoopOperations);
    expect(local.ok).toBe(true);
    expect(remote.ok).toBe(true);
    expect((remote.data as TApplyContentDraftOperations).changed).toBe(false);
    const after = await loadDraft();
    expect(after.generation).toBe(before.generation);
    expect(after.payload).toEqual(before.payload);
  });

  const semanticCases = fixtureSemanticInvalidOperations.map((fixture) => [fixture.name, fixture.operation]) as Array<
    [string, unknown]
  >;
  it.each(semanticCases)('semantic-invalid fixture %s fails on both sides', async (name, operation) => {
    const local = applyOperations(BASE, [operation as EditorialOperation]);
    await resetDraft();
    const remote = await applyOperationsRemote([operation]);
    expect(local.ok).toBe(false);
    expect(remote.ok).toBe(false);
    const expectedCode = name === 'missing-body-block' ? 'invalid_image' : 'invalid_operations';
    expect(remote.error?.code).toBe(expectedCode);
  });
});

describe('digest and canonical payload', () => {
  it('persists the SHA-256 of the canonical payload text', async () => {
    await resetDraft();
    const draft = await loadDraft();
    const digest = await sha256Text(draft.canonicalPayload);
    expect(draft.digest).toBe(digest);
    expect(JSON.parse(draft.canonicalPayload)).toEqual(draft.payload);
  });
});

describe('all-or-nothing batches', () => {
  it('rolls back the whole batch when a later operation fails', async () => {
    await resetDraft();
    const before = await loadDraft();
    const batch: unknown[] = [
      { op: 'update', scope: 'educationGroups', id: 'grupo-um', patch: { title: 'Alterado' }, unset: [] },
      { op: 'add', scope: 'educationGroups', value: { id: 'grupo-um', title: 'Duplicado', order: 9 } },
    ];
    const remote = await applyOperationsRemote(batch);
    expect(remote.ok).toBe(false);
    expect(remote.error?.code).toBe('invalid_operations');
    const after = await loadDraft();
    expect(after.generation).toBe(before.generation);
    expect(after.digest).toBe(before.digest);
    expect(after.payload).toEqual(before.payload);
  });

  it('rejects oversized batches and unknown keys without side effects', async () => {
    await resetDraft();
    const before = await loadDraft();
    const oversized = Array.from({ length: 201 }, (_, index) => ({
      op: 'update',
      scope: 'educationGroups',
      id: 'grupo-um',
      patch: { title: `T${index}` },
      unset: [],
    }));
    const tooMany = await applyOperationsRemote(oversized);
    expect(tooMany.ok).toBe(false);
    expect(tooMany.error?.code).toBe('invalid_operations');
    const unknownKey = await applyOperationsRemote([
      { op: 'update', scope: 'locations', id: 'local-um', patch: { city: 'X' }, unset: [] },
      { op: 'explode', scope: 'locations' },
    ]);
    expect(unknownKey.ok).toBe(false);
    expect(unknownKey.error?.code).toBe('invalid_operations');
    const protectedKey = await applyOperationsRemote([
      {
        op: 'add',
        scope: 'educationMaterials',
        value: { id: 'm-novo', title: 'M', imageUrl: 'https://x.bemtevi.org/a.png' },
      },
    ]);
    expect(protectedKey.ok).toBe(false);
    expect(protectedKey.error?.code).toBe('invalid_operations');
    const after = await loadDraft();
    expect(after.generation).toBe(before.generation);
    expect(after.payload).toEqual(before.payload);
  });

  it('requires exact delete confirmation and reorder permutations', async () => {
    await resetDraft();
    const missingConfirmation = await applyOperationsRemote([{ op: 'delete', scope: 'locations', id: 'local-um' }]);
    expect(missingConfirmation.ok).toBe(false);
    const badPermutation = await applyOperationsRemote([
      { op: 'reorder', scope: 'educationGroups', ids: ['grupo-um'] },
    ]);
    expect(badPermutation.ok).toBe(false);
    const reorder = await applyOperationsRemote([
      { op: 'reorder', scope: 'educationGroups', ids: ['grupo-dois', 'grupo-um'] },
    ]);
    expect(reorder.ok).toBe(true);
    const draft = await loadDraft();
    expect(
      (draft.payload as { educationGroups: Array<{ id: string }> }).educationGroups.map((group) => group.id),
    ).toEqual(['grupo-dois', 'grupo-um']);
  });

  it('bounds the scalar default group order to safe integers', async () => {
    await resetDraft();
    const invalid = await applyOperationsRemote([{ op: 'set_default_group_order', value: 1.5 }]);
    expect(invalid.ok).toBe(false);
    expect(invalid.error?.code).toBe('invalid_operations');
    const valid = await applyOperationsRemote([{ op: 'set_default_group_order', value: 3 }]);
    expect(valid.ok).toBe(true);
  });
});
