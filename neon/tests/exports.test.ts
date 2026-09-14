import { randomBytes, createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import type { EditExport } from '@bemtevi/content-core';
import type { TCreateContentEditExport, TGetContentEditExport } from './rpc-types';

/**
 * DB-02 live Neon suite: durable edit exports (dossier 15). Executed by the
 * DB-04 harness (`pnpm run check:db`), which provisions a disposable branch
 * and provides the environment below; missing variables fail closed (no skip).
 *
 * Required environment:
 *   NEON_TEST_OWNER_DATABASE_URL   owner pg connection to the disposable branch
 *   NEON_TEST_DATA_API_URL         Data API base URL of the disposable branch
 *   NEON_TEST_ADMIN_A_TOKEN        Neon Auth JWT of verified admin A
 *   NEON_TEST_ADMIN_B_TOKEN        Neon Auth JWT of verified admin B
 *   NEON_TEST_NONADMIN_TOKEN       Neon Auth JWT of verified non-admin
 *   NEON_TEST_ANON_TOKEN           anonymous Data API JWT
 *   NEON_TEST_ADMIN_A_USER_ID      Neon Auth id of admin A
 *   NEON_TEST_ADMIN_B_USER_ID      Neon Auth id of admin B
 *   NEON_TEST_NONADMIN_USER_ID     Neon Auth id of the non-admin
 */

interface EditorialError {
  code: string;
  currentHead?: { generation: number };
}

interface WireResult {
  ok: boolean;
  data?: unknown;
  error?: EditorialError;
}

interface Harness {
  owner: Client;
  dataApiUrl: string;
  tokens: { adminA: string; adminB: string; nonadmin: string; anon: string };
  userIds: { adminA: string; adminB: string; nonadmin: string };
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

function newExportId(): string {
  return randomBytes(16)
    .toString('hex')
    .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
}

async function callRpc(
  token: string,
  functionName: string,
  args: Record<string, unknown>,
): Promise<{ status: number; body: unknown }> {
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
  return { status: response.status, body: text.length > 0 ? JSON.parse(text) : null };
}

async function seedAdmins(): Promise<void> {
  await harness.owner.query(
    `insert into public.admin_users (user_id) values ($1), ($2)
     on conflict (user_id) do nothing`,
    [harness.userIds.adminA, harness.userIds.adminB],
  );
  await harness.owner.query('delete from public.admin_users where user_id = $1', [harness.userIds.nonadmin]);
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

async function draftHead(): Promise<{ generation: number; digest: string }> {
  const head = await callRpc(harness.tokens.adminA, 'get_content_draft_head', {});
  const data = (head.body as WireResult).data as { generation: number; digest: string };
  return { generation: data.generation, digest: data.digest };
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
  const { conformanceBasePayload } = await import('@bemtevi/content-core');
  BASE_PAYLOAD = conformanceBasePayload;
  await harness.owner.connect();
  await seedAdmins();
});

afterAll(async () => {
  await harness.owner.end();
});

describe('export authorization', () => {
  it('rejects anonymous, non-admin and other-admin access to export RPCs', async () => {
    await resetContent({ withPublication: true });
    const head = await draftHead();
    const exportId = newExportId();
    for (const token of [harness.tokens.anon, harness.tokens.nonadmin]) {
      const denied = await callRpc(token, 'create_content_edit_export', {
        p_export_id: exportId,
        p_expected_generation: head.generation,
        p_selection: null,
      });
      expect((denied.body as WireResult).error?.code).toBe('unauthorized');
    }
    const created = await callRpc(harness.tokens.adminA, 'create_content_edit_export', {
      p_export_id: exportId,
      p_expected_generation: head.generation,
      p_selection: null,
    });
    expect((created.body as WireResult).ok).toBe(true);

    // Another admin can neither retrieve the export nor replay its creation.
    const foreignRead = await callRpc(harness.tokens.adminB, 'get_content_edit_export', {
      p_export_id: exportId,
    });
    expect((foreignRead.body as WireResult).error?.code).toBe('export_base_unavailable');
    const foreignReplay = await callRpc(harness.tokens.adminB, 'create_content_edit_export', {
      p_export_id: exportId,
      p_expected_generation: head.generation,
      p_selection: null,
    });
    expect((foreignReplay.body as WireResult).error?.code).toBe('export_base_unavailable');
  });

  it('lets the same admin in a different session retrieve the export', async () => {
    await resetContent({ withPublication: true });
    const head = await draftHead();
    const exportId = newExportId();
    const created = await callRpc(harness.tokens.adminA, 'create_content_edit_export', {
      p_export_id: exportId,
      p_expected_generation: head.generation,
      p_selection: null,
    });
    expect((created.body as WireResult).ok).toBe(true);
    const retrieved = await callRpc(harness.tokens.adminA, 'get_content_edit_export', {
      p_export_id: exportId,
    });
    expect((retrieved.body as WireResult).ok).toBe(true);
    expect((retrieved.body as WireResult).data).toEqual((created.body as WireResult).data);
  });

  it('requires an existing draft and returns missing/unauthorized exports as export_base_unavailable', async () => {
    await resetContent({ withPublication: false });
    const missingDraft = await callRpc(harness.tokens.adminA, 'create_content_edit_export', {
      p_export_id: newExportId(),
      p_expected_generation: 1,
      p_selection: null,
    });
    expect((missingDraft.body as WireResult).error?.code).toBe('draft_unavailable');
    await resetContent({ withPublication: false });
    const missingPublication = await harness.owner.query(
      `insert into public.content_drafts
         (id, base_revision, payload, digest, created_by, last_actor_kind, last_actor_id, last_principal_user_id)
       values ('current', 1, $1::jsonb, $2, $3, 'admin', $3, $3)`,
      [
        JSON.stringify(BASE_PAYLOAD),
        createHash('sha256').update(JSON.stringify(BASE_PAYLOAD), 'utf8').digest('hex'),
        harness.userIds.adminA,
      ],
    );
    expect(missingPublication.rowCount).toBe(1);
    const noPublication = await callRpc(harness.tokens.adminA, 'create_content_edit_export', {
      p_export_id: newExportId(),
      p_expected_generation: 1,
      p_selection: null,
    });
    expect((noPublication.body as WireResult).error?.code).toBe('published_base_unavailable');
    await resetContent({ withPublication: true });
    const unknown = await callRpc(harness.tokens.adminA, 'get_content_edit_export', {
      p_export_id: newExportId(),
    });
    expect((unknown.body as WireResult).error?.code).toBe('export_base_unavailable');
    const invalid = await callRpc(harness.tokens.adminA, 'get_content_edit_export', {
      p_export_id: null,
    });
    expect((invalid.body as WireResult).error?.code).toBe('invalid_input');
  });
});

describe('export creation semantics', () => {
  it('captures draft generation, digest, payload and published revision atomically', async () => {
    await resetContent({ withPublication: true, revision: 42 });
    const head = await draftHead();
    const exportId = newExportId();
    const created = await callRpc(harness.tokens.adminA, 'create_content_edit_export', {
      p_export_id: exportId,
      p_expected_generation: head.generation,
      p_selection: null,
    });
    expect((created.body as WireResult).ok).toBe(true);
    const data = (created.body as WireResult).data as TCreateContentEditExport;
    expect(data.exportId).toBe(exportId);
    expect(data.draftId).toBe('current');
    expect(data.schemaVersion).toBe('2.0.0');
    expect(data.baseGeneration).toBe(head.generation);
    expect(data.baseDigest).toBe(head.digest);
    expect(data.publishedRevision).toBe(42);
    expect(data.createdBy).toBe(harness.userIds.adminA);
    // Digest is the exact SHA-256 of the canonical payload text.
    expect(createHash('sha256').update(data.canonicalPayload, 'utf8').digest('hex')).toBe(data.baseDigest);
    expect(data.basePayload).toEqual(BASE_PAYLOAD);
    expect(data.selection).toBeNull();
    const row = await harness.owner.query(
      `select expires_at = created_at + interval '14 days' as exact_days
       from public.content_edit_exports where export_id = $1`,
      [exportId],
    );
    expect(row.rows[0]?.['exact_days']).toBe(true);
  });

  it('rejects a stale generation with currentHead and without creating a row', async () => {
    await resetContent({ withPublication: true });
    const head = await draftHead();
    const exportId = newExportId();
    const stale = await callRpc(harness.tokens.adminA, 'create_content_edit_export', {
      p_export_id: exportId,
      p_expected_generation: head.generation + 3,
      p_selection: null,
    });
    expect((stale.body as WireResult).error?.code).toBe('stale_generation');
    expect((stale.body as WireResult).error?.currentHead?.generation).toBe(head.generation);
    const rows = await harness.owner.query('select count(*)::int as count from public.content_edit_exports');
    expect(rows.rows[0]?.['count']).toBe(0);
  });

  it('replays the original unexpired export only with identical owner, generation and selection', async () => {
    await resetContent({ withPublication: true });
    const head = await draftHead();
    const exportId = newExportId();
    const selection = { scope: 'educationGroups', ids: ['grupo-um'] };
    const created = await callRpc(harness.tokens.adminA, 'create_content_edit_export', {
      p_export_id: exportId,
      p_expected_generation: head.generation,
      p_selection: selection,
    });
    expect((created.body as WireResult).ok).toBe(true);
    const replay = await callRpc(harness.tokens.adminA, 'create_content_edit_export', {
      p_export_id: exportId,
      p_expected_generation: head.generation,
      p_selection: selection,
    });
    expect((replay.body as WireResult).ok).toBe(true);
    expect((replay.body as WireResult).data).toEqual((created.body as WireResult).data);
    for (const mutated of [
      { p_export_id: exportId, p_expected_generation: head.generation, p_selection: null },
      { p_export_id: exportId, p_expected_generation: head.generation + 1, p_selection: selection },
    ]) {
      const rejected = await callRpc(harness.tokens.adminA, 'create_content_edit_export', mutated);
      expect((rejected.body as WireResult).error?.code).toBe('export_base_unavailable');
    }
    const rows = await harness.owner.query(
      'select count(*)::int as count from public.content_edit_exports where export_id = $1',
      [exportId],
    );
    expect(rows.rows[0]?.['count']).toBe(1);
  });

  it('validates the selection shape against the draft payload', async () => {
    await resetContent({ withPublication: true });
    const head = await draftHead();
    for (const badSelection of [
      { scope: 'educationGroups', ids: [] },
      { scope: 'educationGroups', ids: ['grupo-um', 'grupo-um'] },
      { scope: 'educationGroups', ids: ['id-inexistente'] },
      { scope: 'escopo-inexistente', ids: ['grupo-um'] },
      { scope: 'educationGroups' },
      'not-an-object',
    ]) {
      const rejected = await callRpc(harness.tokens.adminA, 'create_content_edit_export', {
        p_export_id: newExportId(),
        p_expected_generation: head.generation,
        p_selection: badSelection,
      });
      expect((rejected.body as WireResult).error?.code).toBe('invalid_input');
    }
    const rows = await harness.owner.query('select count(*)::int as count from public.content_edit_exports');
    expect(rows.rows[0]?.['count']).toBe(0);
  });

  it('never exceeds five retained rows under concurrent creation by one admin', async () => {
    await resetContent({ withPublication: true });
    const head = await draftHead();
    const attempts = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        callRpc(harness.tokens.adminA, 'create_content_edit_export', {
          p_export_id: newExportId(),
          p_expected_generation: head.generation,
          p_selection: null,
        }).then((response) => ({ index, response })),
      ),
    );
    for (const attempt of attempts) {
      expect((attempt.response.body as WireResult).ok).toBe(true);
    }
    const rows = await harness.owner.query(
      `select count(*)::int as count from public.content_edit_exports
       where created_by = $1`,
      [harness.userIds.adminA],
    );
    expect(Number(rows.rows[0]?.['count'])).toBeLessThanOrEqual(5);
    expect(Number(rows.rows[0]?.['count'])).toBe(5);
  });

  it('prunes serially keeping the newest five per creator without touching other creators', async () => {
    await resetContent({ withPublication: true });
    const head = await draftHead();
    // Six sequential creations collapse to the newest five for admin A.
    for (let index = 0; index < 6; index += 1) {
      const created = await callRpc(harness.tokens.adminA, 'create_content_edit_export', {
        p_export_id: newExportId(),
        p_expected_generation: head.generation,
        p_selection: null,
      });
      expect((created.body as WireResult).ok).toBe(true);
    }
    const adminARows = await harness.owner.query(
      'select count(*)::int as count from public.content_edit_exports where created_by = $1',
      [harness.userIds.adminA],
    );
    expect(Number(adminARows.rows[0]?.['count'])).toBe(5);
    // Admin B's concurrent export is unaffected by A's pruning.
    const adminBExport = await callRpc(harness.tokens.adminB, 'create_content_edit_export', {
      p_export_id: newExportId(),
      p_expected_generation: head.generation,
      p_selection: null,
    });
    expect((adminBExport.body as WireResult).ok).toBe(true);
    const counts = await harness.owner.query(
      `select created_by::text as user_id, count(*)::int as count
       from public.content_edit_exports group by created_by order by created_by`,
    );
    const adminACount = counts.rows.find((row) => row['user_id'] === harness.userIds.adminA);
    const adminBCount = counts.rows.find((row) => row['user_id'] === harness.userIds.adminB);
    expect(Number(adminACount?.['count'])).toBe(5);
    expect(Number(adminBCount?.['count'])).toBe(1);
  });
});

describe('export expiry', () => {
  it('enforces the exact 14-day boundary on read even without pruning', async () => {
    await resetContent({ withPublication: true });
    const head = await draftHead();
    const exportId = newExportId();
    const created = await callRpc(harness.tokens.adminA, 'create_content_edit_export', {
      p_export_id: exportId,
      p_expected_generation: head.generation,
      p_selection: null,
    });
    expect((created.body as WireResult).ok).toBe(true);
    const fresh = await callRpc(harness.tokens.adminA, 'get_content_edit_export', { p_export_id: exportId });
    expect((fresh.body as WireResult).ok).toBe(true);
    expect(((fresh.body as WireResult).data as TGetContentEditExport).expiresAt).toBe(
      ((created.body as WireResult).data as EditExport).expiresAt,
    );

    // Owner-side shift to just past the boundary (creation + 14 days + 1
    // second); expires_at must move with created_at to keep the table check.
    await harness.owner.query(
      `update public.content_edit_exports
       set created_at = now() - interval '14 days' - interval '1 second',
           expires_at = now() - interval '1 second'
       where export_id = $1`,
      [exportId],
    );
    const expired = await callRpc(harness.tokens.adminA, 'get_content_edit_export', { p_export_id: exportId });
    expect((expired.body as WireResult).error?.code).toBe('export_base_unavailable');
    // The expired row is retained: pruning is only a creation-time activity.
    const rows = await harness.owner.query(
      'select count(*)::int as count from public.content_edit_exports where export_id = $1',
      [exportId],
    );
    expect(rows.rows[0]?.['count']).toBe(1);
  });
});
