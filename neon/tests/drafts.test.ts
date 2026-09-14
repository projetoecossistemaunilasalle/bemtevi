import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import type { DraftHead } from '@bemtevi/content-core';
import type { TApplyContentDraftOperations, TGetContentDraft, TGetContentDraftHead } from './rpc-types';

/**
 * DB-01 live Neon suite: draft tables, initialization, head projection and
 * generation CAS (dossier 15). Executed by the DB-04 harness (`pnpm run
 * check:db`), which provisions a disposable branch and provides the
 * environment below; missing variables fail closed (no skip).
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
  currentHead?: DraftHead;
  currentRevision?: number;
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
  }
}

let BASE_PAYLOAD: unknown;

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

describe('exact schema inspection (owner role)', () => {
  it('creates the four draft tables with RLS and no policies and no direct grants', async () => {
    for (const table of [
      'content_drafts',
      'content_agent_connections',
      'content_edit_exports',
      'content_publish_preparations',
    ]) {
      const rls = await harness.owner.query(
        `select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relname = $1`,
        [table],
      );
      expect(rls.rows[0]?.['relrowsecurity']).toBe(true);
      const policies = await harness.owner.query(
        `select count(*)::int as count from pg_policies
         where schemaname = 'public' and tablename = $1`,
        [table],
      );
      expect(policies.rows[0]?.['count']).toBe(0);
      for (const role of ['anonymous', 'authenticated']) {
        const granted = await harness.owner.query(
          `select has_table_privilege($2, $1::regclass, 'SELECT') as can_read,
                  has_table_privilege($2, $1::regclass, 'INSERT') as can_insert,
                  has_table_privilege($2, $1::regclass, 'UPDATE') as can_update,
                  has_table_privilege($2, $1::regclass, 'DELETE') as can_delete`,
          [`public.${table}`, role],
        );
        expect(granted.rows[0]).toEqual({
          can_read: false,
          can_insert: false,
          can_update: false,
          can_delete: false,
        });
      }
    }
  });

  it('defines the exact draft columns and counter/digest checks', async () => {
    const columns = await harness.owner.query(
      `select column_name, data_type, is_nullable from information_schema.columns
       where table_schema = 'public' and table_name = 'content_drafts' order by column_name`,
    );
    expect(columns.rows.map((row) => row['column_name'])).toEqual([
      'base_revision',
      'created_at',
      'created_by',
      'digest',
      'generation',
      'id',
      'last_actor_id',
      'last_actor_kind',
      'last_principal_user_id',
      'payload',
      'schema_version',
      'status',
      'updated_at',
    ]);
    const checks = await harness.owner.query(
      `select conname from pg_constraint
       where conrelid = 'public.content_drafts'::regclass and contype = 'c'`,
    );
    const names = checks.rows.map((row) => row['conname'] as string).join('|');
    expect(names).toContain('generation');
    expect(names).toContain('base_revision');
    expect(names).toContain('digest');
  });

  it('adds the publication audit column and copies it in the history trigger', async () => {
    for (const table of ['published_content', 'published_content_history']) {
      const column = await harness.owner.query(
        `select column_name from information_schema.columns
         where table_schema = 'public' and table_name = $1 and column_name = 'published_via_connection_id'`,
        [table],
      );
      expect(column.rowCount).toBe(1);
    }
    const definition = await harness.owner.query(
      `select pg_get_functiondef('public.archive_published_content()'::regprocedure) as def`,
    );
    const source = definition.rows[0]?.['def'] as string;
    expect(source).toContain('published_via_connection_id');
  });

  it('exposes only the three admin RPCs to authenticated and nothing from content_private', async () => {
    const rpcs = ['get_content_draft()', 'get_content_draft_head()', 'apply_content_draft_operations(bigint, jsonb)'];
    for (const signature of rpcs) {
      const exists = await harness.owner.query(
        `select count(*)::int as count from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.oid = ('public.' || $1)::regprocedure`,
        [signature],
      );
      expect(exists.rows[0]?.['count']).toBe(1);
      const granted = await harness.owner.query(
        `select has_function_privilege('authenticated', ('public.' || $1)::regprocedure, 'EXECUTE') as can_call,
                has_function_privilege('anonymous', ('public.' || $1)::regprocedure, 'EXECUTE') as anon_can_call,
                has_function_privilege('public', ('public.' || $1)::regprocedure, 'EXECUTE') as public_can_call`,
        [signature],
      );
      expect(granted.rows[0]).toEqual({ can_call: true, anon_can_call: false, public_can_call: false });
    }
    const privateLeak = await harness.owner.query(
      `select count(*)::int as count from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'content_private'
         and has_function_privilege('authenticated', p.oid, 'EXECUTE')`,
    );
    expect(privateLeak.rows[0]?.['count']).toBe(0);
  });
});

describe('authorization precedes any data-bearing error', () => {
  it('rejects anonymous, non-admin and missing drafts in that order', async () => {
    await resetContent({ withPublication: false });
    const anonLoad = await callRpc(harness.tokens.anon, 'get_content_draft', {});
    expect((anonLoad.body as WireResult).error?.code).toBe('unauthorized');
    const nonAdminHead = await callRpc(harness.tokens.nonadmin, 'get_content_draft_head', {});
    expect((nonAdminHead.body as WireResult).error?.code).toBe('unauthorized');
    const adminHead = await callRpc(harness.tokens.adminA, 'get_content_draft_head', {});
    expect((adminHead.body as WireResult).error?.code).toBe('draft_unavailable');
    const rows = await harness.owner.query('select count(*)::int as count from public.content_drafts');
    expect(rows.rows[0]?.['count']).toBe(0);
  });
});

describe('initialization', () => {
  it('fails safely when no publication exists', async () => {
    await resetContent({ withPublication: false });
    const result = await callRpc(harness.tokens.adminA, 'get_content_draft', {});
    const body = result.body as WireResult;
    expect(body.ok).toBe(false);
    expect(body.error?.code).toBe('published_base_unavailable');
    const rows = await harness.owner.query('select count(*)::int as count from public.content_drafts');
    expect(rows.rows[0]?.['count']).toBe(0);
  });

  it('initializes from the live publication and concurrent calls create exactly one row', async () => {
    await resetContent({ withPublication: true, revision: 42 });
    const [first, second] = await Promise.all([
      callRpc(harness.tokens.adminA, 'get_content_draft', {}),
      callRpc(harness.tokens.adminB, 'get_content_draft', {}),
    ]);
    for (const response of [first, second]) {
      const body = response.body as WireResult;
      expect(body.ok).toBe(true);
      const data = body.data as TGetContentDraft;
      expect(data.generation).toBe(1);
      expect(data.baseRevision).toBe(42);
      expect(data.status).toBe('active');
      expect(data.canonicalPayload.length).toBeGreaterThan(0);
    }
    const rows = await harness.owner.query(
      'select count(*)::int as count, min(generation) as generation from public.content_drafts',
    );
    expect(rows.rows[0]?.['count']).toBe(1);
    expect(Number(rows.rows[0]?.['generation'])).toBe(1);
  });
});

describe('head projection', () => {
  it('omits payload and canonical payload from the head', async () => {
    await resetContent({ withPublication: true });
    await callRpc(harness.tokens.adminA, 'get_content_draft', {});
    const result = await callRpc(harness.tokens.adminB, 'get_content_draft_head', {});
    const body = result.body as WireResult;
    expect(body.ok).toBe(true);
    const head = body.data as TGetContentDraftHead;
    expect(head.id).toBe('current');
    expect(head.schemaVersion).toBe('1.0.0');
    expect(head.baseRevision).toBe(42);
    expect(head.lastActor.kind).toBe('admin');
    expect(head.lastActor.connectionId).toBeNull();
    expect(Object.keys(head)).not.toContain('payload');
    expect(Object.keys(head)).not.toContain('canonicalPayload');
  });
});

describe('generation CAS', () => {
  async function loadHead(): Promise<TGetContentDraftHead> {
    const result = await callRpc(harness.tokens.adminA, 'get_content_draft_head', {});
    return (result.body as WireResult).data as TGetContentDraftHead;
  }

  it('accepts the same-generation no-op without advancing generation', async () => {
    await resetContent({ withPublication: true });
    await callRpc(harness.tokens.adminA, 'get_content_draft', {});
    const head = await loadHead();
    const result = await callRpc(harness.tokens.adminA, 'apply_content_draft_operations', {
      p_expected_generation: head.generation,
      p_operations: [
        { op: 'update', scope: 'educationGroups', id: 'grupo-um', patch: { title: 'Grupo um' }, unset: [] },
      ],
    });
    const body = result.body as WireResult;
    expect(body.ok).toBe(true);
    const data = body.data as TApplyContentDraftOperations;
    expect(data.changed).toBe(false);
    expect(data.head.generation).toBe(head.generation);
    expect(data.head.updatedAt).toBe(head.updatedAt);
  });

  it('rejects stale generations with currentHead and without side effects', async () => {
    await resetContent({ withPublication: true });
    await callRpc(harness.tokens.adminA, 'get_content_draft', {});
    const head = await loadHead();
    const result = await callRpc(harness.tokens.adminA, 'apply_content_draft_operations', {
      p_expected_generation: head.generation + 5,
      p_operations: [{ op: 'update', scope: 'educationGroups', id: 'grupo-um', patch: { title: 'Outro' }, unset: [] }],
    });
    const body = result.body as WireResult;
    expect(body.ok).toBe(false);
    expect(body.error?.code).toBe('stale_generation');
    expect(body.error?.currentHead?.generation).toBe(head.generation);
    expect((await loadHead()).generation).toBe(head.generation);
  });

  it('lets exactly one same-generation concurrent writer change the draft', async () => {
    await resetContent({ withPublication: true });
    await callRpc(harness.tokens.adminA, 'get_content_draft', {});
    const head = await loadHead();
    const [first, second] = await Promise.all([
      callRpc(harness.tokens.adminA, 'apply_content_draft_operations', {
        p_expected_generation: head.generation,
        p_operations: [
          { op: 'update', scope: 'educationGroups', id: 'grupo-um', patch: { title: 'Escritor um' }, unset: [] },
        ],
      }),
      callRpc(harness.tokens.adminB, 'apply_content_draft_operations', {
        p_expected_generation: head.generation,
        p_operations: [
          { op: 'update', scope: 'educationGroups', id: 'grupo-dois', patch: { title: 'Escritor dois' }, unset: [] },
        ],
      }),
    ]);
    const changed = [first, second].filter((response) => (response.body as WireResult).ok === true);
    expect(changed).toHaveLength(1);
    expect(((changed[0]?.body as WireResult).data as TApplyContentDraftOperations).changed).toBe(true);
    const rejected = [first, second].find((response) => (response.body as WireResult).ok === false);
    expect((rejected?.body as WireResult).error?.code).toBe('stale_generation');
    const after = await loadHead();
    expect(after.generation).toBe(head.generation + 1);
    expect(after.lastActor.kind).toBe('admin');
  });
});
