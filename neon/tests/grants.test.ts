import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Client } from 'pg';
import type { DraftHead } from '@bemtevi/content-core';

/**
 * DB-03 live Neon suite: publication wrapper grants and the direct-write
 * cutover assertions (dossier 15, Migration Order item 5). Executed by the
 * DB-04 harness; missing variables fail closed (no skip).
 *
 * Phase control: this file first asserts the legacy direct-write coexistence
 * grants, then (separately) the cutover assertions. DB-04 applies
 * `neon/cutover/20260910004000_content_draft_revoke_direct_publish.sql` in its
 * dedicated cutover subsection and re-runs this file with
 * NEON_TEST_CUTOVER_APPLIED=true; any other non-empty value throws (no silent
 * phase mismatch).
 *
 * Required environment: same NEON_TEST_* variables as the other live suites,
 * plus NEON_TEST_CUTOVER_APPLIED (optional; see above).
 */

interface EditorialError {
  code: string;
}

interface WireResult {
  ok: boolean;
  data?: unknown;
  error?: EditorialError;
}

interface Harness {
  owner: Client;
  dataApiUrl: string;
  tokens: { adminA: string; nonadmin: string; anon: string };
  userIds: { adminA: string };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`missing required environment variable: ${name}`);
  }
  return value;
}

const cutoverEnv = process.env.NEON_TEST_CUTOVER_APPLIED;
if (cutoverEnv !== undefined && cutoverEnv !== 'true') {
  throw new Error(`NEON_TEST_CUTOVER_APPLIED must be unset or exactly "true", got: ${cutoverEnv}`);
}
const cutoverApplied = cutoverEnv === 'true';

const harness: Harness = {
  owner: new Client({ connectionString: 'pending' }),
  dataApiUrl: 'pending',
  tokens: { adminA: 'pending', nonadmin: 'pending', anon: 'pending' },
  userIds: { adminA: 'pending' },
};

const ADMIN_WRAPPERS = [
  'prepare_content_draft_publish(uuid, bigint, bigint, text, text)',
  'publish_content_draft(uuid, text)',
];

const AGENT_WRAPPERS = [
  'agent_prepare_publish(uuid, text, uuid, bigint, bigint, text, text)',
  'agent_publish_draft(uuid, text, uuid, text)',
];

const PRIVATE_HELPERS = [
  'content_private.prepare_publish(uuid, bigint, bigint, text, text, text, uuid, uuid)',
  'content_private.publish_draft(uuid, text, text, uuid, uuid)',
];

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

async function functionPrivilege(signature: string, role: string): Promise<boolean> {
  // Fail closed: an unknown signature makes regprocedure input raise.
  const result = await harness.owner.query(
    `select has_function_privilege($2, $1::regprocedure, 'EXECUTE') as can_call`,
    [signature, role],
  );
  return result.rows[0]?.['can_call'] === true;
}

function cutoverFile(name: string): string {
  // neon/tests/grants.test.ts -> neon/cutover/<name>
  return readFileSync(new URL(`../cutover/${name}`, import.meta.url), 'utf8');
}

beforeAll(async () => {
  harness.owner = new Client({ connectionString: requireEnv('NEON_TEST_OWNER_DATABASE_URL') });
  harness.dataApiUrl = requireEnv('NEON_TEST_DATA_API_URL');
  harness.tokens = {
    adminA: requireEnv('NEON_TEST_ADMIN_A_TOKEN'),
    nonadmin: requireEnv('NEON_TEST_NONADMIN_TOKEN'),
    anon: requireEnv('NEON_TEST_ANON_TOKEN'),
  };
  harness.userIds = { adminA: requireEnv('NEON_TEST_ADMIN_A_USER_ID') };
  await harness.owner.connect();
});

afterAll(async () => {
  await harness.owner.end();
});

describe('publication wrapper grants (both phases)', () => {
  it('grants admin wrappers to authenticated only', async () => {
    for (const signature of ADMIN_WRAPPERS) {
      expect(await functionPrivilege(signature, 'authenticated')).toBe(true);
      expect(await functionPrivilege(signature, 'anonymous')).toBe(false);
      expect(await functionPrivilege(signature, 'public')).toBe(false);
    }
  });

  it('grants agent wrappers to anonymous only', async () => {
    for (const signature of AGENT_WRAPPERS) {
      expect(await functionPrivilege(signature, 'anonymous')).toBe(true);
      expect(await functionPrivilege(signature, 'authenticated')).toBe(false);
      expect(await functionPrivilege(signature, 'public')).toBe(false);
    }
  });

  it('keeps the publication private helpers unexposed to every API role', async () => {
    for (const signature of PRIVATE_HELPERS) {
      for (const role of ['anonymous', 'authenticated', 'public']) {
        expect(await functionPrivilege(signature, role)).toBe(false);
      }
    }
  });
});

describe('legacy direct-write coexistence (pre-cutover)', () => {
  it.runIf(!cutoverApplied)('keeps the literal legacy write policies and grants in place', async () => {
    const policies = await harness.owner.query(
      `select policyname from pg_policies
       where schemaname = 'public' and tablename = 'published_content'`,
    );
    const names = policies.rows.map((row) => row['policyname'] as string).sort();
    expect(names).toEqual([
      'Administrators can create published content',
      'Administrators can update published content',
      'Anyone can read current published content',
    ]);
    for (const role of ['anonymous', 'authenticated']) {
      const granted = await harness.owner.query(
        `select has_table_privilege($1, 'public.published_content', 'SELECT') as can_read,
                has_table_privilege($1, 'public.published_content', 'INSERT') as can_insert,
                has_table_privilege($1, 'public.published_content', 'UPDATE') as can_update`,
        [role],
      );
      // Legacy base: SELECT for both API roles; direct writes for authenticated only.
      expect(granted.rows[0]).toEqual({
        can_read: true,
        can_insert: role === 'authenticated',
        can_update: role === 'authenticated',
      });
    }
  });

  it.runIf(!cutoverApplied)('keeps public reads and admin-only history reads alive', async () => {
    const read = await fetch(`${harness.dataApiUrl}/published_content?select=revision&id=eq.current`, {
      headers: { authorization: `Bearer ${harness.tokens.anon}` },
    });
    expect(read.status).toBe(200);
    const historyAnon = await fetch(`${harness.dataApiUrl}/published_content_history?select=revision`, {
      headers: { authorization: `Bearer ${harness.tokens.anon}` },
    });
    expect(historyAnon.status).toBeGreaterThanOrEqual(400);
    const historyAdmin = await fetch(`${harness.dataApiUrl}/published_content_history?select=revision`, {
      headers: { authorization: `Bearer ${harness.tokens.adminA}` },
    });
    expect(historyAdmin.status).toBe(200);
  });
});

describe('cutover artifact (static, both phases)', () => {
  it('stages the literal doc-15 cutover statements outside the migration directory', async () => {
    const revoke = cutoverFile('20260910004000_content_draft_revoke_direct_publish.sql');
    expect(revoke).toContain(
      'revoke insert, update, delete on table public.published_content from authenticated, anonymous, public;',
    );
    expect(revoke).toContain(
      'drop policy if exists "Administrators can create published content" on public.published_content;',
    );
    expect(revoke).toContain(
      'drop policy if exists "Administrators can update published content" on public.published_content;',
    );
    // The read policy is explicitly kept by the cutover.
    expect(revoke).not.toContain('Anyone can read current published content" on public.published_content;');
    const emergency = cutoverFile('disable_editorial_writes.sql');
    expect(emergency).toContain(
      'revoke execute on function public.prepare_content_draft_publish(uuid, bigint, bigint, text, text)',
    );
    expect(emergency).toContain('revoke execute on function public.publish_content_draft(uuid, text)');
    expect(emergency).toContain(
      'revoke execute on function public.agent_prepare_publish(uuid, text, uuid, bigint, bigint, text, text)',
    );
    expect(emergency).toContain('revoke execute on function public.agent_publish_draft(uuid, text, uuid, text)');
    expect(emergency).toContain('revoke execute on function public.agent_apply_operations(uuid, text, bigint, jsonb)');
    expect(emergency).toContain('revoke execute on function public.apply_content_draft_operations(bigint, jsonb)');
    expect(emergency).toContain('revoke execute on function public.create_content_agent_connection(uuid, text, text)');
  });
});

describe('post-cutover grants and guarded publication', () => {
  it.runIf(cutoverApplied)('revokes direct writes and drops the legacy write policies', async () => {
    const policies = await harness.owner.query(
      `select policyname from pg_policies
       where schemaname = 'public' and tablename = 'published_content'`,
    );
    const names = policies.rows.map((row) => row['policyname'] as string);
    expect(names).toContain('Anyone can read current published content');
    expect(names).not.toContain('Administrators can create published content');
    expect(names).not.toContain('Administrators can update published content');
    // SELECT survived the cutover for the API roles (never granted to public);
    // every write privilege is revoked for anonymous, authenticated and public.
    for (const role of ['anonymous', 'authenticated', 'public']) {
      const granted = await harness.owner.query(
        `select has_table_privilege($1, 'public.published_content', 'SELECT') as can_read,
                has_table_privilege($1, 'public.published_content', 'INSERT') as can_insert,
                has_table_privilege($1, 'public.published_content', 'UPDATE') as can_update,
                has_table_privilege($1, 'public.published_content', 'DELETE') as can_delete`,
        [role],
      );
      expect(granted.rows[0]).toEqual({
        can_read: role !== 'public',
        can_insert: false,
        can_update: false,
        can_delete: false,
      });
    }
  });

  it.runIf(cutoverApplied)('denies direct Data API writes while guarded publication still works', async () => {
    const direct = await fetch(`${harness.dataApiUrl}/published_content`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${harness.tokens.adminA}`,
        prefer: 'return=representation',
      },
      body: JSON.stringify({ id: 'current', schema_version: '1.0.0', revision: 9999, payload: {} }),
    });
    expect(direct.status).toBeGreaterThanOrEqual(400);
    const anonRead = await fetch(`${harness.dataApiUrl}/published_content?select=revision&id=eq.current`, {
      headers: { authorization: `Bearer ${harness.tokens.anon}` },
    });
    expect(anonRead.status).toBe(200);

    // Guarded two-phase publication remains functional after cutover.
    const head = (
      (await callRpc(harness.tokens.adminA, 'get_content_draft_head', {})).body as {
        ok: boolean;
        data?: DraftHead;
      }
    ).data as DraftHead;
    const token = randomBytes(32).toString('base64url');
    const hash = createHash('sha256').update(Buffer.from(token, 'base64url')).digest('hex');
    const prepared = await callRpc(harness.tokens.adminA, 'prepare_content_draft_publish', {
      p_preparation_id: randomUUID(),
      p_generation: head.generation,
      p_expected_revision: head.baseRevision,
      p_digest: head.digest,
      p_token_hash: hash,
    });
    const prepBody = prepared.body as WireResult;
    expect(prepBody.ok).toBe(true);
    const published = await callRpc(harness.tokens.adminA, 'publish_content_draft', {
      p_preparation_id: (prepBody.data as { preparationId: string }).preparationId,
      p_publish_token: token,
    });
    const pubBody = published.body as WireResult;
    expect(pubBody.ok).toBe(true);
    expect((pubBody.data as { revision: number }).revision).toBe(head.baseRevision + 1);
    const nonadmin = await callRpc(harness.tokens.nonadmin, 'prepare_content_draft_publish', {
      p_preparation_id: randomUUID(),
      p_generation: head.generation,
      p_expected_revision: head.baseRevision,
      p_digest: head.digest,
      p_token_hash: hash,
    });
    expect((nonadmin.body as WireResult).error?.code).toBe('unauthorized');
  });
});
