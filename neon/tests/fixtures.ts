import { Client } from 'pg';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { conformanceBasePayload } from '@bemtevi/content-core';

/**
 * DB-04 branch fixtures: apply the sorted additive migrations on the disposable
 * branch, seed the minimal publication plus admin memberships for the two
 * verified admins, and warm the Data API connection pool. All setup runs through
 * the temporary owner connection and only ever touches the disposable branch.
 */

export interface OwnerFixture {
  adminUserIds: { adminA: string; adminB: string; nonadmin: string };
}

/**
 * Provision step 1 guard: the fixture parent must not already contain the
 * editorial tables, so the additive migrations stay deterministic.
 */
export async function assertParentFixtureClean(
  query: (sql: string) => Promise<{ rows: Array<Record<string, unknown>> }>,
): Promise<void> {
  const result = await query(`select to_regclass('public.published_content') as reg`);
  if (result.rows[0]?.['reg'] !== null && result.rows[0]?.['reg'] !== undefined) {
    throw new Error('parent branch already contains public.published_content; refusing to build the fixture on it');
  }
}

export async function connectOwner(ownerDatabaseUrl: string): Promise<Client> {
  const client = new Client({ connectionString: ownerDatabaseUrl });
  await client.connect();
  return client;
}

export async function applyMigrations(owner: Client, migrationsDir: string): Promise<void> {
  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();
  for (const file of files) {
    try {
      await owner.query(readFileSync(path.join(migrationsDir, file), 'utf8'));
    } catch (error) {
      throw new Error(`migration ${file} failed on the disposable branch: ${(error as Error).message}`, {
        cause: error,
      });
    }
  }
}

const FIXTURE_EMAILS = {
  adminA: 'NEON_TEST_ADMIN_A_EMAIL',
  adminB: 'NEON_TEST_ADMIN_B_EMAIL',
  nonadmin: 'NEON_TEST_NONADMIN_EMAIL',
} as const;

export async function waitForAuthUsers(owner: Client, emails: string[]): Promise<void> {
  const deadline = Date.now() + 60_000;
  for (;;) {
    const result = await owner.query<{ email: string }>(
      `select lower(email) as email from neon_auth."user" where lower(email) = any($1)`,
      [emails],
    );
    const seen = new Set(result.rows.map((row) => row.email));
    if (emails.every((email) => seen.has(email.toLowerCase()))) return;
    if (Date.now() > deadline) {
      const missing = emails.filter((email) => !seen.has(email.toLowerCase())).length;
      throw new Error(`Neon Auth user sync did not propagate all fixture users (${missing} missing)`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
}

export async function seedOwnerFixture(
  owner: Client,
  emails: Record<keyof typeof FIXTURE_EMAILS, string>,
): Promise<OwnerFixture> {
  const userIds: Record<string, string> = {};
  for (const [key, envName] of Object.entries(FIXTURE_EMAILS)) {
    const email = emails[key as keyof typeof FIXTURE_EMAILS];
    const result = await owner.query<{ id: string }>(`select id from neon_auth."user" where lower(email) = lower($1)`, [
      email,
    ]);
    const id = result.rows[0]?.id;
    if (typeof id !== 'string') throw new Error(`fixture auth user for ${envName} is missing on the branch`);
    userIds[key] = id;
  }
  await owner.query(
    `insert into public.admin_users (user_id) values ($1), ($2)
     on conflict (user_id) do nothing`,
    [userIds.adminA, userIds.adminB],
  );
  await owner.query('delete from public.admin_users where user_id = $1', [userIds.nonadmin]);
  await owner.query(
    `insert into public.published_content (id, schema_version, revision, payload, published_by)
     values ('current', '1.0.0', 42, $1::jsonb, $2)
     on conflict (id) do nothing`,
    [JSON.stringify(conformanceBasePayload), userIds.adminA],
  );
  return {
    adminUserIds: { adminA: userIds.adminA, adminB: userIds.adminB, nonadmin: userIds.nonadmin },
  };
}

export async function applyCutoverArtifact(owner: Client, cutoverDir: string, fileName: string): Promise<void> {
  await owner.query(readFileSync(path.join(cutoverDir, fileName), 'utf8'));
}

/**
 * The Neon Data API's first request on a fresh pooled backend can resolve
 * auth.user_id() before the request-scoped JWT claims are visible, which the
 * live suites would observe as a spurious `unauthorized`. Warm every pooled
 * backend by bursting authorized RPC calls until a full burst comes back clean.
 */
export async function warmupDataApi(dataApiUrl: string, adminToken: string): Promise<void> {
  const call = async (): Promise<string> => {
    const response = await fetch(`${dataApiUrl}/rpc/get_content_draft_head`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` },
      body: '{}',
    });
    if (response.status !== 200) return `http_${response.status}`;
    const body = (await response.json()) as { ok?: boolean; error?: { code?: string } };
    // Both a live head and `draft_unavailable` prove the admin session claim resolved.
    if (body.ok === true || body.error?.code === 'draft_unavailable') return 'ok';
    return body.error?.code ?? 'unknown';
  };
  // Sequential phase: warm the primary pooled backend until claims resolve reliably.
  let consecutive = 0;
  for (let attempt = 0; attempt < 60 && consecutive < 10; attempt += 1) {
    consecutive = (await call()) === 'ok' ? consecutive + 1 : 0;
  }
  if (consecutive < 10) throw new Error('Data API pool warmup did not stabilize on the primary backend');
  // Concurrent phase: force the remaining pooled backends open and warm them too.
  for (let round = 1; round <= 5; round += 1) {
    const outcomes = await Promise.all(Array.from({ length: 16 }, call));
    const cold = outcomes.filter((outcome) => outcome !== 'ok').length;
    if (cold === 0 && round >= 2) return;
  }
  throw new Error('Data API pool warmup did not reach a stable authenticated state; refusing to run the live suites');
}
