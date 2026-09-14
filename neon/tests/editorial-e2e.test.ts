import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import type { DraftHead } from '@bemtevi/content-core';
import { PNG_1X1_BASE64 } from '@bemtevi/content-core';
import type {
  TCreateContentEditExport,
  TGetContentDraft,
  TGetContentEditExport,
  TPrepareContentDraftPublish,
  TPublishContentDraft,
} from './rpc-types';

/**
 * INTEGRATION-03 live replacement E2E suite (Gates C/D/E-live). Executed by
 * the DB-04 harness (`pnpm run check:db`); missing NEON_TEST_* variables fail
 * closed (no skip). Proves the full editorial path on the disposable branch:
 * aligned base/live revision, distinct-field merge, overlapping/delete/order
 * conflict, same-generation one-winner publication CAS, image/file roundtrip,
 * cross-session export retrieval, revoked capability denial, guarded admin
 * publication, guarded MCP/agent publication, and the post-revocation
 * linearization fact (weak proof; full kill-artifact proof is cutover-phase).
 */

interface WireResult {
  ok: boolean;
  data?: unknown;
  error?: { code: string; currentHead?: DraftHead; currentRevision?: number };
}

interface Harness {
  owner: Client;
  dataApiUrl: string;
  tokens: { adminA: string; adminB: string; nonadmin: string; anon: string };
  userIds: { adminA: string; adminB: string; nonadmin: string };
}

interface Capability {
  id: string;
  token: string;
  tokenHash: string;
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
  tokens: { adminA: 'pending', adminB: 'pending', nonadmin: 'pending', anon: 'pending' },
  userIds: { adminA: 'pending', adminB: 'pending', nonadmin: 'pending' },
};

function newCapability(): Capability {
  const token = randomBytes(32).toString('base64url');
  expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  const tokenHash = createHash('sha256').update(Buffer.from(token, 'base64url')).digest('hex');
  return { id: randomUUID(), token, tokenHash };
}

function cap(capability: Capability): { p_connection_id: string; p_token: string } {
  return { p_connection_id: capability.id, p_token: capability.token };
}

function newPublishToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  const hash = createHash('sha256').update(Buffer.from(token, 'base64url')).digest('hex');
  return { token, hash };
}

async function callRpc(
  token: string,
  functionName: string,
  args: Record<string, unknown>,
): Promise<{ status: number; body: WireResult }> {
  const response = await fetch(`${harness.dataApiUrl}/rpc/${functionName}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(args),
  });
  const text = await response.text();
  // The Data API denies EXECUTE at the HTTP layer (401/403/404 PostgREST error
  // body) when a role lacks the function grant; normalize it to the same
  // `unauthorized` envelope the wrapper returns for in-function denials.
  if (response.status === 401 || response.status === 403 || response.status === 404) {
    return { status: response.status, body: { ok: false, error: { code: 'unauthorized' } } };
  }
  return {
    status: response.status,
    body: text.length > 0 ? (JSON.parse(text) as WireResult) : ({ ok: false } as WireResult),
  };
}

let BASE_PAYLOAD: unknown;

async function resetContent(options: { withPublication: boolean; revision?: number }): Promise<void> {
  await harness.owner.query('delete from public.content_publish_preparations');
  await harness.owner.query('delete from public.content_edit_exports');
  await harness.owner.query('delete from public.published_content');
  await harness.owner.query('delete from public.published_content_history');
  await harness.owner.query('delete from public.content_agent_connections');
  await harness.owner.query('delete from public.content_drafts');
  if (options.withPublication) {
    await harness.owner.query(
      `insert into public.published_content (id, schema_version, revision, payload, published_by)
       values ('current', '1.0.0', $1, $2::jsonb, $3)`,
      [options.revision ?? 42, JSON.stringify(BASE_PAYLOAD), harness.userIds.adminA],
    );
    await callRpc(harness.tokens.adminA, 'get_content_draft', {});
  }
}

async function loadHead(token = harness.tokens.adminA): Promise<DraftHead> {
  const result = await callRpc(token, 'get_content_draft_head', {});
  expect(result.body.ok).toBe(true);
  return result.body.data as DraftHead;
}

async function loadDraft(token = harness.tokens.adminA): Promise<TGetContentDraft> {
  const result = await callRpc(token, 'get_content_draft', {});
  expect(result.body.ok).toBe(true);
  return result.body.data as TGetContentDraft;
}

async function createConnection(adminToken: string, label: string): Promise<Capability> {
  const capability = newCapability();
  const created = await callRpc(adminToken, 'create_content_agent_connection', {
    p_connection_id: capability.id,
    p_token_hash: capability.tokenHash,
    p_label: label,
  });
  expect(created.body.ok).toBe(true);
  return capability;
}

async function liveRevision(): Promise<number> {
  const rows = await harness.owner.query(
    `select revision::int as revision from public.published_content where id = 'current'`,
  );
  return Number(rows.rows[0]?.['revision']);
}

beforeAll(async () => {
  harness.owner = new Client({ connectionString: requireEnv('NEON_TEST_OWNER_DATABASE_URL') });
  harness.dataApiUrl = requireEnv('NEON_TEST_DATA_API_URL');
  harness.tokens = {
    adminA: requireEnv('NEON_TEST_ADMIN_A_TOKEN'),
    adminB: requireEnv('NEON_TEST_ADMIN_B_TOKEN'),
    nonadmin: requireEnv('NEON_TEST_NONADMIN_TOKEN'),
    anon: requireEnv('NEON_TEST_ANON_TOKEN'),
  };
  harness.userIds = {
    adminA: requireEnv('NEON_TEST_ADMIN_A_USER_ID'),
    adminB: requireEnv('NEON_TEST_ADMIN_B_USER_ID'),
    nonadmin: requireEnv('NEON_TEST_NONADMIN_USER_ID'),
  };
  BASE_PAYLOAD = (await import('@bemtevi/content-core')).conformanceBasePayload;
  await harness.owner.connect();
  await harness.owner.query(
    `insert into public.admin_users (user_id) values ($1), ($2)
     on conflict (user_id) do nothing`,
    [harness.userIds.adminA, harness.userIds.adminB],
  );
  await harness.owner.query('delete from public.admin_users where user_id = $1', [harness.userIds.nonadmin]);
});

afterAll(async () => {
  await harness.owner.end();
});

describe('aligned base/live revision', () => {
  it('initializes the draft with baseRevision equal to the live published revision', async () => {
    await resetContent({ withPublication: true, revision: 42 });
    const draft = await loadDraft();
    expect(draft.baseRevision).toBe(42);
    expect(draft.generation).toBe(1);
    expect(await liveRevision()).toBe(42);
  });
});

describe('distinct-field merge across two admins', () => {
  it('rejects the second same-generation writer and applies the loser after refetch', async () => {
    await resetContent({ withPublication: true });
    const head = await loadHead();
    // AdminA edits a material title (field set X).
    const first = await callRpc(harness.tokens.adminA, 'apply_content_draft_operations', {
      p_expected_generation: head.generation,
      p_operations: [
        {
          op: 'update',
          scope: 'educationMaterials',
          id: 'material-exemplo',
          patch: { title: 'Titulo do admin A' },
          unset: [],
        },
      ],
    });
    expect(first.body.ok).toBe(true);
    // AdminB edits a disjoint field set Y at the same expected generation.
    const second = await callRpc(harness.tokens.adminB, 'apply_content_draft_operations', {
      p_expected_generation: head.generation,
      p_operations: [
        { op: 'update', scope: 'educationGroups', id: 'grupo-um', patch: { title: 'Grupo do admin B' }, unset: [] },
      ],
    });
    expect(second.body.ok).toBe(false);
    expect(second.body.error?.code).toBe('stale_generation');
    // After refetch, apply B's ops against the new head — both changes present.
    const next = await loadHead(harness.tokens.adminB);
    const retry = await callRpc(harness.tokens.adminB, 'apply_content_draft_operations', {
      p_expected_generation: next.generation,
      p_operations: [
        { op: 'update', scope: 'educationGroups', id: 'grupo-um', patch: { title: 'Grupo do admin B' }, unset: [] },
      ],
    });
    expect(retry.body.ok).toBe(true);
    const merged = await loadDraft();
    const payload = merged.payload as {
      educationMaterials: Array<{ id: string; title: string }>;
      educationGroups: Array<{ id: string; title: string }>;
    };
    expect(payload.educationMaterials.find((m) => m.id === 'material-exemplo')?.title).toBe('Titulo do admin A');
    expect(payload.educationGroups.find((g) => g.id === 'grupo-um')?.title).toBe('Grupo do admin B');
  });
});

describe('overlapping and delete/order conflicts', () => {
  it('gives stale_generation on overlapping fields and invalid_operations on a non-permutation reorder after delete', async () => {
    await resetContent({ withPublication: true });
    const head = await loadHead();
    // Overlapping field: both edit the same material title at the same generation.
    const [overlapA, overlapB] = await Promise.all([
      callRpc(harness.tokens.adminA, 'apply_content_draft_operations', {
        p_expected_generation: head.generation,
        p_operations: [
          { op: 'update', scope: 'educationMaterials', id: 'material-exemplo', patch: { title: 'A' }, unset: [] },
        ],
      }),
      callRpc(harness.tokens.adminB, 'apply_content_draft_operations', {
        p_expected_generation: head.generation,
        p_operations: [
          { op: 'update', scope: 'educationMaterials', id: 'material-exemplo', patch: { title: 'B' }, unset: [] },
        ],
      }),
    ]);
    const winners = [overlapA, overlapB].filter((r) => r.body.ok === true);
    const losers = [overlapA, overlapB].filter((r) => r.body.ok === false);
    expect(winners).toHaveLength(1);
    expect(losers[0]?.body.error?.code).toBe('stale_generation');

    // Delete + reorder: A deletes grupo-dois; B tried the same generation (stale).
    // After refetch, B's reorder including the deleted id is not a permutation.
    await resetContent({ withPublication: true });
    const h2 = await loadHead();
    const del = await callRpc(harness.tokens.adminA, 'apply_content_draft_operations', {
      p_expected_generation: h2.generation,
      p_operations: [{ op: 'delete', scope: 'educationGroups', id: 'grupo-dois', confirmation: true }],
    });
    expect(del.body.ok).toBe(true);
    const race = await callRpc(harness.tokens.adminB, 'apply_content_draft_operations', {
      p_expected_generation: h2.generation,
      p_operations: [{ op: 'reorder', scope: 'educationGroups', ids: ['grupo-dois', 'grupo-um'] }],
    });
    expect(race.body.ok).toBe(false);
    expect(race.body.error?.code).toBe('stale_generation');
    const after = await loadHead(harness.tokens.adminB);
    const badReorder = await callRpc(harness.tokens.adminB, 'apply_content_draft_operations', {
      p_expected_generation: after.generation,
      p_operations: [{ op: 'reorder', scope: 'educationGroups', ids: ['grupo-dois', 'grupo-um'] }],
    });
    expect(badReorder.body.ok).toBe(false);
    expect(badReorder.body.error?.code).toBe('invalid_operations');
  });
});

describe('same-generation one-winner publication CAS', () => {
  it('lets the first prepare+publish win; the second prepare hits revision_conflict and the stale publish preparation_stale', async () => {
    await resetContent({ withPublication: true, revision: 42 });
    const head = await loadHead();
    const a = newPublishToken();
    const b = newPublishToken();
    // Both prepare the same generation while live revision is still 42.
    const prepA = await callRpc(harness.tokens.adminA, 'prepare_content_draft_publish', {
      p_preparation_id: randomUUID(),
      p_generation: head.generation,
      p_expected_revision: head.baseRevision,
      p_digest: head.digest,
      p_token_hash: a.hash,
    });
    expect(prepA.body.ok).toBe(true);
    const prepB = await callRpc(harness.tokens.adminB, 'prepare_content_draft_publish', {
      p_preparation_id: randomUUID(),
      p_generation: head.generation,
      p_expected_revision: head.baseRevision,
      p_digest: head.digest,
      p_token_hash: b.hash,
    });
    expect(prepB.body.ok).toBe(true);
    const idA = (prepA.body.data as TPrepareContentDraftPublish).preparationId;
    const idB = (prepB.body.data as TPrepareContentDraftPublish).preparationId;
    // First publish wins.
    const pubA = await callRpc(harness.tokens.adminA, 'publish_content_draft', {
      p_preparation_id: idA,
      p_publish_token: a.token,
    });
    expect(pubA.body.ok).toBe(true);
    expect((pubA.body.data as TPublishContentDraft).revision).toBe(43);
    // A fresh prepare against the advanced live revision conflicts.
    const headAfter = await loadHead();
    const reprepare = await callRpc(harness.tokens.adminB, 'prepare_content_draft_publish', {
      p_preparation_id: randomUUID(),
      p_generation: headAfter.generation,
      p_expected_revision: head.baseRevision,
      p_digest: headAfter.digest,
      p_token_hash: b.hash,
    });
    expect(reprepare.body.ok).toBe(false);
    expect(reprepare.body.error?.code).toBe('revision_conflict');
    // B's already-pinned same-generation preparation is stale on publish.
    const pubB = await callRpc(harness.tokens.adminB, 'publish_content_draft', {
      p_preparation_id: idB,
      p_publish_token: b.token,
    });
    expect(pubB.body.ok).toBe(false);
    expect(pubB.body.error?.code).toBe('preparation_stale');
    expect(await liveRevision()).toBe(43);
  });
});

describe('image/file roundtrip and cross-session export retrieval', () => {
  it('captures an image-bearing material export with stable digest and owner-only retrieval', async () => {
    await resetContent({ withPublication: true });
    const head = await loadHead();
    const imageOp = await callRpc(harness.tokens.adminA, 'apply_content_draft_operations', {
      p_expected_generation: head.generation,
      p_operations: [
        {
          op: 'set_material_image',
          materialId: 'material-exemplo',
          slot: { kind: 'featured' },
          image: {
            kind: 'uploaded',
            mime: 'image/png',
            base64: PNG_1X1_BASE64,
            fileName: 'destaque.png',
            alt: 'Destaque',
          },
        },
      ],
    });
    expect(imageOp.body.ok).toBe(true);
    const afterImage = await loadHead();
    const exportId = randomUUID();
    const created = await callRpc(harness.tokens.adminA, 'create_content_edit_export', {
      p_export_id: exportId,
      p_expected_generation: afterImage.generation,
      p_selection: { scope: 'educationMaterials', ids: ['material-exemplo'] },
    });
    expect(created.body.ok).toBe(true);
    const exportData = created.body.data as TCreateContentEditExport;
    expect(exportData.baseGeneration).toBe(afterImage.generation);
    expect(exportData.baseDigest).toBe(afterImage.digest);
    expect(exportData.selection).toEqual({ scope: 'educationMaterials', ids: ['material-exemplo'] });
    // Canonical payload round-trips through JSON.parse stably.
    // Uploaded featured images are stored as data URLs (materialImageSlots).
    const parsed = JSON.parse(exportData.canonicalPayload) as {
      educationMaterials: Array<{ id: string; featuredImage?: { kind: string; dataUrl?: string } }>;
    };
    const material = parsed.educationMaterials.find((m) => m.id === 'material-exemplo');
    expect(material?.featuredImage?.kind).toBe('uploaded');
    expect(material?.featuredImage?.dataUrl).toBe(`data:image/png;base64,${PNG_1X1_BASE64}`);
    expect(createHash('sha256').update(exportData.canonicalPayload, 'utf8').digest('hex')).toBe(exportData.baseDigest);

    // Cross-session: same admin retrieves in a fresh call; adminB is denied.
    const sessionTwo = await callRpc(harness.tokens.adminA, 'get_content_edit_export', { p_export_id: exportId });
    expect(sessionTwo.body.ok).toBe(true);
    expect((sessionTwo.body.data as TGetContentEditExport).baseDigest).toBe(exportData.baseDigest);
    const foreign = await callRpc(harness.tokens.adminB, 'get_content_edit_export', { p_export_id: exportId });
    expect(foreign.body.ok).toBe(false);
    expect(foreign.body.error?.code).toBe('export_base_unavailable');
  });
});

describe('revoked capability denial', () => {
  it('allows agent context before revoke and denies after revoke', async () => {
    await resetContent({ withPublication: true });
    const capability = await createConnection(harness.tokens.adminA, 'E2E revoke');
    const before = await callRpc(harness.tokens.anon, 'agent_get_editor_context', cap(capability));
    expect(before.body.ok).toBe(true);
    const revoked = await callRpc(harness.tokens.adminB, 'revoke_content_agent_connection', {
      p_connection_id: capability.id,
    });
    expect(revoked.body.ok).toBe(true);
    const after = await callRpc(harness.tokens.anon, 'agent_get_editor_context', cap(capability));
    expect(after.body.ok).toBe(false);
    expect(after.body.error?.code).toBe('invalid_capability');
  });
});

describe('guarded admin and agent publication', () => {
  it('publishes via admin with null connection id and via agent with the delegating connection', async () => {
    // Admin path.
    await resetContent({ withPublication: true, revision: 42 });
    const head = await loadHead();
    const adminTok = newPublishToken();
    const prep = await callRpc(harness.tokens.adminA, 'prepare_content_draft_publish', {
      p_preparation_id: randomUUID(),
      p_generation: head.generation,
      p_expected_revision: head.baseRevision,
      p_digest: head.digest,
      p_token_hash: adminTok.hash,
    });
    expect(prep.body.ok).toBe(true);
    const pub = await callRpc(harness.tokens.adminA, 'publish_content_draft', {
      p_preparation_id: (prep.body.data as TPrepareContentDraftPublish).preparationId,
      p_publish_token: adminTok.token,
    });
    expect(pub.body.ok).toBe(true);
    expect((pub.body.data as TPublishContentDraft).revision).toBe(43);
    const liveAdmin = await harness.owner.query(
      `select revision::int as revision, published_by, published_via_connection_id
       from public.published_content where id = 'current'`,
    );
    expect(liveAdmin.rows[0]).toEqual({
      revision: 43,
      published_by: harness.userIds.adminA,
      published_via_connection_id: null,
    });
    const afterAdmin = await loadHead();
    expect(afterAdmin.baseRevision).toBe(43);
    expect(afterAdmin.generation).toBe(head.generation + 1);

    // Agent/MCP path.
    await resetContent({ withPublication: true, revision: 42 });
    const connection = await createConnection(harness.tokens.adminB, 'E2E publish');
    const agentHead = await loadHead();
    const agentTok = newPublishToken();
    const agentPrep = await callRpc(harness.tokens.anon, 'agent_prepare_publish', {
      ...cap(connection),
      p_preparation_id: randomUUID(),
      p_generation: agentHead.generation,
      p_expected_revision: agentHead.baseRevision,
      p_digest: agentHead.digest,
      p_token_hash: agentTok.hash,
    });
    expect(agentPrep.body.ok).toBe(true);
    const agentPub = await callRpc(harness.tokens.anon, 'agent_publish_draft', {
      ...cap(connection),
      p_preparation_id: (agentPrep.body.data as TPrepareContentDraftPublish).preparationId,
      p_publish_token: agentTok.token,
    });
    expect(agentPub.body.ok).toBe(true);
    expect((agentPub.body.data as TPublishContentDraft).revision).toBe(43);
    const liveAgent = await harness.owner.query(
      `select published_by, published_via_connection_id
       from public.published_content where id = 'current'`,
    );
    expect(liveAgent.rows[0]).toEqual({
      published_by: harness.userIds.adminB,
      published_via_connection_id: connection.id,
    });
  });
});

describe('post-kill linearization (weak revocation proof)', () => {
  it('denies an already-loaded client after revoke and documents full kill-artifact proof as cutover-phase', async () => {
    // Weak live fact (Gate C/D/E-live): after revocation, an in-flight client
    // that previously succeeded gets invalid_capability on the next call.
    // Full disable_editorial_writes.sql kill-artifact verification is the
    // cutover phase (run.ts re-runs only grants.test.ts); recorded in
    // docs/editorial-v2-rollout.md.
    await resetContent({ withPublication: true });
    const capability = await createConnection(harness.tokens.adminA, 'E2E linearize');
    const warm = await callRpc(harness.tokens.anon, 'agent_get_draft', cap(capability));
    expect(warm.body.ok).toBe(true);
    await callRpc(harness.tokens.adminA, 'revoke_content_agent_connection', { p_connection_id: capability.id });
    // Same anonymous Data API client (same fetch path / JWT) that just succeeded.
    const after = await callRpc(harness.tokens.anon, 'agent_get_draft', cap(capability));
    expect(after.body.ok).toBe(false);
    expect(after.body.error?.code).toBe('invalid_capability');
  });
});
