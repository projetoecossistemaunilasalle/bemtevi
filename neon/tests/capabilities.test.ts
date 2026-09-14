import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import type { AgentConnection, ContentDraft, DraftHead } from '@bemtevi/content-core';
import type { TAgentApplyOperations, TListContentAgentConnections } from './rpc-types';

/** DB-02 live Neon suite: delegated agent connections (dossier 15). Executed by
 * the DB-04 harness; missing NEON_TEST_* variables fail closed (no skip). */

interface WireResult {
  ok: boolean;
  data?: unknown;
  error?: { code: string };
}

interface Harness {
  owner: Client;
  dataApiUrl: string;
  tokens: { adminA: string; adminB: string; nonadmin: string; anon: string };
  userIds: { adminA: string; adminB: string; nonadmin: string };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (typeof value !== 'string' || value.length === 0)
    throw new Error(`missing required environment variable: ${name}`);
  return value;
}

const harness: Harness = {
  owner: new Client({ connectionString: 'pending' }),
  dataApiUrl: 'pending',
  tokens: { adminA: 'pending', adminB: 'pending', nonadmin: 'pending', anon: 'pending' },
  userIds: { adminA: 'pending', adminB: 'pending', nonadmin: 'pending' },
};

interface Capability {
  id: string;
  token: string;
  tokenHash: string;
}

function newCapability(): Capability {
  const token = randomBytes(32).toString('base64url');
  expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  const tokenHash = createHash('sha256').update(Buffer.from(token, 'base64url')).digest('hex');
  return { id: randomUUID(), token, tokenHash };
}

function cap(capability: Capability): { p_connection_id: string; p_token: string } {
  return { p_connection_id: capability.id, p_token: capability.token };
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

async function createConnection(adminToken: string, label: string): Promise<Capability> {
  const capability = newCapability();
  const created = await callRpc(adminToken, 'create_content_agent_connection', {
    p_connection_id: capability.id,
    p_token_hash: capability.tokenHash,
    p_label: label,
  });
  expect((created.body as WireResult).ok).toBe(true);
  return capability;
}

let BASE_PAYLOAD: unknown;

async function resetContent(options: { withPublication: boolean; revision?: number }): Promise<void> {
  await harness.owner.query(`delete from public.content_publish_preparations;
    delete from public.content_edit_exports;
    delete from public.published_content;
    delete from public.published_content_history;
    delete from public.content_agent_connections;
    delete from public.content_drafts;`);
  if (options.withPublication) {
    await harness.owner.query(
      `insert into public.published_content (id, schema_version, revision, payload, published_by)
       values ('current', '1.0.0', $1, $2::jsonb, $3)`,
      [options.revision ?? 42, JSON.stringify(BASE_PAYLOAD), harness.userIds.adminA],
    );
    await callRpc(harness.tokens.adminA, 'get_content_draft', {});
  }
}

/** Owner-side connection insert for lifecycle cases the RPC cannot produce. */
async function insertConnection(
  capability: Capability,
  principal: string,
  createdOffset = '0 seconds',
  revoked = false,
): Promise<void> {
  await harness.owner.query(
    `insert into public.content_agent_connections
       (id, draft_id, principal_user_id, label, token_hash, created_at, expires_at, revoked_at)
     select $1, 'current', $2, 'owner-seeded', $3,
             v.ts, v.ts + interval '1 year',
             case when $5 then clock_timestamp() else null end
     from (select clock_timestamp() - $4::interval as ts) v`,
    [capability.id, principal, Buffer.from(capability.tokenHash, 'hex'), createdOffset, revoked],
  );
}

async function connectionRow(id: string): Promise<Record<string, unknown> | undefined> {
  return (await harness.owner.query('select * from public.content_agent_connections where id = $1', [id])).rows[0];
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
    `insert into public.admin_users (user_id) values ($1), ($2) on conflict (user_id) do nothing`,
    [harness.userIds.adminA, harness.userIds.adminB],
  );
  await harness.owner.query('delete from public.admin_users where user_id = $1', [harness.userIds.nonadmin]);
});

afterAll(async () => {
  await harness.owner.end();
});

describe('exact schema and grant inspection (owner role)', () => {
  it('keeps protected tables locked from direct API access (no policies, no grants)', async () => {
    for (const table of ['content_agent_connections', 'content_edit_exports']) {
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
      for (const token of [harness.tokens.anon, harness.tokens.nonadmin, harness.tokens.adminA]) {
        const read = await fetch(`${harness.dataApiUrl}/${table}`, {
          headers: { authorization: `Bearer ${token}` },
        });
        expect(read.status).toBeGreaterThanOrEqual(400);
      }
    }
  });

  it('grants admin wrappers to authenticated only and gateway wrappers to anonymous only', async () => {
    // Each entry: signature, role expected to hold EXECUTE.
    const expectedGrants: Array<[string, 'authenticated' | 'anonymous']> = [
      ['create_content_agent_connection(uuid, text, text)', 'authenticated'],
      ['list_content_agent_connections()', 'authenticated'],
      ['revoke_content_agent_connection(uuid)', 'authenticated'],
      ['agent_get_editor_context(uuid, text)', 'anonymous'],
      ['agent_get_draft(uuid, text)', 'anonymous'],
      ['agent_get_published_content(uuid, text)', 'anonymous'],
      ['agent_apply_operations(uuid, text, bigint, jsonb)', 'anonymous'],
    ];
    for (const [signature, grantedRole] of expectedGrants) {
      const granted = await harness.owner.query(
        `select has_function_privilege('authenticated', ('public.' || $1)::regprocedure, 'EXECUTE') as auth_can_call,
                has_function_privilege('anonymous', ('public.' || $1)::regprocedure, 'EXECUTE') as anon_can_call,
                has_function_privilege('public', ('public.' || $1)::regprocedure, 'EXECUTE') as public_can_call`,
        [signature],
      );
      expect(granted.rows[0]).toEqual({
        auth_can_call: grantedRole === 'authenticated',
        anon_can_call: grantedRole === 'anonymous',
        public_can_call: false,
      });
    }
    const privateLeak = await harness.owner.query(
      `select count(*)::int as count from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'content_private'
         and has_function_privilege('anonymous', p.oid, 'EXECUTE')`,
    );
    expect(privateLeak.rows[0]?.['count']).toBe(0);
  });

  it('stores exactly a 32-byte token hash and a one-calendar-year expiry', async () => {
    const columns = await harness.owner.query(
      `select column_name, data_type from information_schema.columns
       where table_schema = 'public' and table_name = 'content_agent_connections'
       order by column_name`,
    );
    expect(columns.rows.map((row) => row['column_name']).join(',')).toBe(
      'created_at,draft_id,expires_at,id,label,last_used_at,principal_user_id,revoked_at,token_hash',
    );
    expect(columns.rows.find((row) => row['column_name'] === 'token_hash')?.['data_type']).toBe('bytea');
    await resetContent({ withPublication: true });
    const capability = await createConnection(harness.tokens.adminA, 'Verificação de expiração');
    const row = await harness.owner.query(
      `select expires_at = created_at + interval '1 year' as exact_year,
              octet_length(token_hash) as hash_bytes
       from public.content_agent_connections where id = $1`,
      [capability.id],
    );
    expect(row.rows[0]?.['exact_year']).toBe(true);
    expect(Number(row.rows[0]?.['hash_bytes'])).toBe(32);
    expect((await connectionRow(capability.id))?.['token_hash']).toBeInstanceOf(Buffer);
  });
});

describe('connection management', () => {
  const createArgs = (capability: Capability, label: string) => ({
    p_connection_id: capability.id,
    p_token_hash: capability.tokenHash,
    p_label: label,
  });
  const createVia = (token: string, capability: Capability, label: string) =>
    callRpc(token, 'create_content_agent_connection', createArgs(capability, label));

  it('rejects anonymous and non-admin creators and binds creation to self', async () => {
    await resetContent({ withPublication: true });
    const capability = newCapability();
    for (const token of [harness.tokens.anon, harness.tokens.nonadmin]) {
      const denied = await callRpc(token, 'create_content_agent_connection', createArgs(capability, 'Negado'));
      expect((denied.body as WireResult).error?.code).toBe('unauthorized');
    }
    expect(await connectionRow(capability.id)).toBeUndefined();
    const created = await createVia(harness.tokens.adminA, capability, 'Conexão do admin A');
    expect((created.body as WireResult).ok).toBe(true);
    const data = (created.body as WireResult).data as AgentConnection;
    expect(data.principalUserId).toBe(harness.userIds.adminA);
    expect(data.draftId).toBe('current');
    expect(JSON.stringify(created.body)).not.toContain(capability.token);
    expect(JSON.stringify(created.body)).not.toContain(capability.tokenHash);
  });

  it('replays identical creation idempotently and rejects any field mismatch', async () => {
    await resetContent({ withPublication: true });
    const capability = newCapability();
    const first = await createVia(harness.tokens.adminA, capability, 'Conexão única');
    expect((first.body as WireResult).ok).toBe(true);
    const replay = await createVia(harness.tokens.adminA, capability, 'Conexão única');
    expect((replay.body as WireResult).ok).toBe(true);
    expect((replay.body as WireResult).data).toEqual((first.body as WireResult).data);
    for (const mutated of [
      createArgs(capability, 'Outro rótulo'),
      { ...createArgs(capability, 'Conexão única'), p_token_hash: newCapability().tokenHash },
    ]) {
      const rejected = await callRpc(harness.tokens.adminA, 'create_content_agent_connection', mutated);
      expect((rejected.body as WireResult).error?.code).toBe('invalid_input');
    }
    // Another admin replaying the same UUID is also a mismatch.
    const otherAdmin = await createVia(harness.tokens.adminB, capability, 'Conexão única');
    expect((otherAdmin.body as WireResult).error?.code).toBe('invalid_input');
    const rows = await harness.owner.query(
      'select count(*)::int as count from public.content_agent_connections where id = $1',
      [capability.id],
    );
    expect(rows.rows[0]?.['count']).toBe(1);
  });

  it('requires an existing draft and rejects invalid hash/label inputs', async () => {
    await resetContent({ withPublication: false });
    const capability = newCapability();
    const missingDraft = await createVia(harness.tokens.adminA, capability, 'Sem rascunho');
    expect((missingDraft.body as WireResult).error?.code).toBe('draft_unavailable');
    await resetContent({ withPublication: true });
    for (const bad of [
      createArgs(capability, '   '),
      { ...createArgs(capability, 'Hash inválido'), p_token_hash: 'ZZZZ' },
      { ...createArgs(capability, 'Maiúsculas'), p_token_hash: capability.tokenHash.toUpperCase() },
      { ...createArgs(capability, 'Sem rótulo'), p_label: null },
    ]) {
      const rejected = await callRpc(harness.tokens.adminA, 'create_content_agent_connection', bad);
      expect((rejected.body as WireResult).error?.code).toBe('invalid_input');
    }
  });

  it('lists every connection for every admin without secrets', async () => {
    await resetContent({ withPublication: true });
    const a = await createConnection(harness.tokens.adminA, 'De A');
    const b = await createConnection(harness.tokens.adminB, 'De B');
    const list = await callRpc(harness.tokens.adminA, 'list_content_agent_connections', {});
    expect((list.body as WireResult).ok).toBe(true);
    const connections = (list.body as WireResult).data as TListContentAgentConnections;
    expect(connections.map((connection) => connection.id)).toEqual([b.id, a.id]);
    for (const connection of connections) {
      expect(Object.keys(connection).sort().join(',')).toBe(
        'createdAt,draftId,expiresAt,id,label,lastUsedAt,principalUserId,revokedAt',
      );
    }
    expect(JSON.stringify(list.body)).not.toContain(a.tokenHash);
  });

  it('revokes any connection as any admin, retains the row and preserves the timestamp on replay', async () => {
    await resetContent({ withPublication: true });
    const capability = await createConnection(harness.tokens.adminA, 'A revogar');
    // Any admin (B) may revoke A's connection.
    const revoked = await callRpc(harness.tokens.adminB, 'revoke_content_agent_connection', {
      p_connection_id: capability.id,
    });
    expect((revoked.body as WireResult).ok).toBe(true);
    const revokedAt = ((revoked.body as WireResult).data as AgentConnection).revokedAt;
    expect(revokedAt).not.toBeNull();
    const replay = await callRpc(harness.tokens.adminB, 'revoke_content_agent_connection', {
      p_connection_id: capability.id,
    });
    expect(((replay.body as WireResult).data as AgentConnection).revokedAt).toBe(revokedAt);
    expect(await connectionRow(capability.id)).toBeDefined();
    const missing = await callRpc(harness.tokens.adminA, 'revoke_content_agent_connection', {
      p_connection_id: newCapability().id,
    });
    expect((missing.body as WireResult).error?.code).toBe('invalid_input');
    const denied = await callRpc(harness.tokens.nonadmin, 'revoke_content_agent_connection', {
      p_connection_id: capability.id,
    });
    expect((denied.body as WireResult).error?.code).toBe('unauthorized');

    // Every capability call after revocation fails while the audited row stays.
    const after = await callRpc(harness.tokens.anon, 'agent_get_draft', cap(capability));
    expect((after.body as WireResult).error?.code).toBe('invalid_capability');
    expect(await connectionRow(capability.id)).toBeDefined();
  });
});

describe('capability verification', () => {
  it('lets a valid capability read the draft, published content and context, and edit via CAS', async () => {
    await resetContent({ withPublication: true });
    const capability = await createConnection(harness.tokens.adminA, 'Conexão de teste');
    const draft = await callRpc(harness.tokens.anon, 'agent_get_draft', cap(capability));
    expect((draft.body as WireResult).ok).toBe(true);
    const draftData = (draft.body as WireResult).data as ContentDraft;
    expect(draftData.generation).toBe(1);
    expect(draftData.canonicalPayload.length).toBeGreaterThan(0);

    const published = await callRpc(harness.tokens.anon, 'agent_get_published_content', cap(capability));
    expect((published.body as WireResult).ok).toBe(true);
    expect(((published.body as WireResult).data as { revision: number }).revision).toBe(42);

    const context = await callRpc(harness.tokens.anon, 'agent_get_editor_context', cap(capability));
    expect((context.body as WireResult).ok).toBe(true);
    const contextData = (context.body as WireResult).data as {
      head: DraftHead;
      publishedRevision: number;
      principalUserId: string;
      connectionId: string;
      expiresAt: string;
    };
    expect(contextData.publishedRevision).toBe(42);
    expect(contextData.principalUserId).toBe(harness.userIds.adminA);
    expect(contextData.connectionId).toBe(capability.id);

    const applied = await callRpc(harness.tokens.anon, 'agent_apply_operations', {
      ...cap(capability),
      p_expected_generation: draftData.generation,
      p_operations: [
        { op: 'update', scope: 'educationGroups', id: 'grupo-um', patch: { title: 'Via agente' }, unset: [] },
      ],
    });
    expect((applied.body as WireResult).ok).toBe(true);
    const mutation = (applied.body as WireResult).data as TAgentApplyOperations;
    expect(mutation.changed).toBe(true);
    expect(mutation.head.generation).toBe(draftData.generation + 1);
    expect(mutation.head.lastActor.kind).toBe('agent');
    expect(mutation.head.lastActor.connectionId).toBe(capability.id);
    expect(mutation.head.lastActor.principalUserId).toBe(harness.userIds.adminA);
    expect((await connectionRow(capability.id))?.['last_used_at']).not.toBeNull();
  });

  it('returns the same invalid_capability for every invalid secret/lifecycle/principal case', async () => {
    await resetContent({ withPublication: true });
    const valid = await createConnection(harness.tokens.adminA, 'Válida');
    const expired = newCapability();
    await insertConnection(expired, harness.userIds.adminA, '1 year');
    const revoked = newCapability();
    await insertConnection(revoked, harness.userIds.adminA, '0 seconds', true);
    const removedPrincipal = newCapability();
    await insertConnection(removedPrincipal, harness.userIds.nonadmin);

    const cases: Array<{ p_connection_id: string; p_token: string }> = [
      { ...cap(valid), p_token: 'curto' },
      { ...cap(valid), p_token: 'A'.repeat(43) },
      { ...cap(valid), p_token: newCapability().token },
      cap(newCapability()),
      cap(expired),
      cap(revoked),
      cap(removedPrincipal),
    ];
    for (const args of cases) {
      const read = await callRpc(harness.tokens.anon, 'agent_get_draft', args);
      expect((read.body as WireResult).error?.code).toBe('invalid_capability');
      const edit = await callRpc(harness.tokens.anon, 'agent_apply_operations', {
        ...args,
        p_expected_generation: 1,
        p_operations: [{ op: 'update', scope: 'educationGroups', id: 'grupo-um', patch: { title: 'X' }, unset: [] }],
      });
      expect((edit.body as WireResult).error?.code).toBe('invalid_capability');
    }
    const rows = await harness.owner.query(
      'select count(*)::int as count from public.content_agent_connections where last_used_at is not null',
    );
    expect(rows.rows[0]?.['count']).toBe(0);
  });

  it('prevents one connection from impersonating another or using admin-only RPCs', async () => {
    await resetContent({ withPublication: true });
    const connectionA = await createConnection(harness.tokens.adminA, 'De A');
    const connectionB = await createConnection(harness.tokens.adminB, 'De B');
    const cross = await callRpc(harness.tokens.anon, 'agent_get_draft', {
      p_connection_id: connectionA.id,
      p_token: connectionB.token,
    });
    expect((cross.body as WireResult).error?.code).toBe('invalid_capability');

    const createAttempt = await callRpc(harness.tokens.anon, 'create_content_agent_connection', {
      ...cap(connectionA),
      p_token_hash: newCapability().tokenHash,
      p_label: 'Pelo agente',
    });
    expect(createAttempt.status).toBeGreaterThanOrEqual(400);
    for (const [name, args] of [
      ['revoke_content_agent_connection', { p_connection_id: connectionA.id }],
      ['list_content_agent_connections', cap(connectionA)],
      [
        'create_content_edit_export',
        { ...cap(connectionA), p_export_id: newCapability().id, p_expected_generation: 1, p_selection: null },
      ],
      ['get_content_edit_export', { p_export_id: newCapability().id }],
    ] as const) {
      const attempt = await callRpc(harness.tokens.anon, name, args);
      expect(attempt.status).toBeGreaterThanOrEqual(400);
    }
    // An admin session cannot ride the anonymous gateway either.
    const adminRiding = await callRpc(harness.tokens.adminB, 'agent_get_draft', cap(connectionA));
    expect(adminRiding.status).toBeGreaterThanOrEqual(400);
    const rows = await harness.owner.query('select count(*)::int as count from public.content_agent_connections');
    expect(rows.rows[0]?.['count']).toBe(2);
  });

  it('stamps last_used_at at most once per 15 minutes and never on invalid authentication', async () => {
    await resetContent({ withPublication: true });
    const capability = await createConnection(harness.tokens.adminA, 'Uso');
    const readDraft = () => callRpc(harness.tokens.anon, 'agent_get_draft', cap(capability));
    const setLastUsed = (offset: string) =>
      harness.owner.query(
        `update public.content_agent_connections
         set last_used_at = clock_timestamp() - $2::interval where id = $1`,
        [capability.id, offset],
      );
    await readDraft();
    const first = (await connectionRow(capability.id))?.['last_used_at'];
    expect(first).not.toBeNull();
    await readDraft();
    // Immediate second call stays inside the 15-minute window.
    expect((await connectionRow(capability.id))?.['last_used_at']).toEqual(first);
    await setLastUsed('16 minutes');
    await readDraft();
    expect((await connectionRow(capability.id))?.['last_used_at']).not.toEqual(first);
    // Invalid authentication never updates the stamp.
    await setLastUsed('16 minutes');
    const stale = await callRpc(harness.tokens.anon, 'agent_get_draft', {
      ...cap(capability),
      p_token: newCapability().token,
    });
    expect((stale.body as WireResult).error?.code).toBe('invalid_capability');
  });
});
