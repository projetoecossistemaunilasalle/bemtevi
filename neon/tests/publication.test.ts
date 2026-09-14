import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Client } from 'pg';
import type { DraftHead } from '@bemtevi/content-core';
import type { TApplyContentDraftOperations, TPrepareContentDraftPublish, TPublishContentDraft } from './rpc-types';

/** DB-03 live suite: atomic guarded publication (dossier 15). Executed by the
 * DB-04 harness; missing NEON_TEST_* variables fail closed (no skip). */

interface WireResult {
  ok: boolean;
  data?: unknown;
  error?: { code: string; currentHead?: DraftHead; currentRevision?: number };
}

const harness = {
  owner: new Client({ connectionString: 'pending' }),
  dataApiUrl: 'pending',
  tokens: { adminA: '', adminB: '', nonadmin: '', anon: '' },
  userIds: { adminA: '', adminB: '', nonadmin: '' },
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (typeof value !== 'string' || value.length === 0)
    throw new Error(`missing required environment variable: ${name}`);
  return value;
}

function newPublishToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  const hash = createHash('sha256').update(Buffer.from(token, 'base64url')).digest('hex');
  return { token, hash };
}

async function callRpc(token: string, fn: string, args: Record<string, unknown>): Promise<WireResult> {
  const response = await fetch(`${harness.dataApiUrl}/rpc/${fn}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(args),
  });
  const text = await response.text();
  if (response.status === 401 || response.status === 403 || response.status === 404)
    return { ok: false, error: { code: 'unauthorized' } } as WireResult;
  if (response.status !== 200) return { ok: false } as WireResult;
  return text.length > 0 ? JSON.parse(text) : { ok: false };
}

let BASE_PAYLOAD: unknown;

async function resetContent(): Promise<void> {
  await harness.owner.query(`delete from public.content_publish_preparations`);
  await harness.owner.query(
    `delete from public.content_edit_exports;
     delete from public.published_content;
     delete from public.published_content_history;
     delete from public.content_agent_connections;
     delete from public.content_drafts;`,
  );
  await harness.owner.query(
    `insert into public.published_content (id, schema_version, revision, payload, published_by)
     values ('current', '1.0.0', 42, $1::jsonb, $2)`,
    [JSON.stringify(BASE_PAYLOAD), harness.userIds.adminA],
  );
  await callRpc(harness.tokens.adminA, 'get_content_draft', {});
}

async function loadHead(token = harness.tokens.adminA): Promise<DraftHead> {
  return (await callRpc(token, 'get_content_draft_head', {})).data as DraftHead;
}

async function changeDraft(token = harness.tokens.adminA): Promise<DraftHead> {
  const head = await loadHead(token);
  const body = await callRpc(token, 'apply_content_draft_operations', {
    p_expected_generation: head.generation,
    p_operations: [
      { op: 'update', scope: 'educationGroups', id: 'grupo-um', patch: { title: randomUUID() }, unset: [] },
    ],
  });
  if (!body.ok || !body.data) {
    throw new Error(`fixture mutation failed: ${JSON.stringify(body.error)}`);
  }
  return (body.data as TApplyContentDraftOperations).head;
}
function prepArgs(head: DraftHead, tokenHash: string): Record<string, unknown> {
  return {
    p_generation: head.generation,
    p_expected_revision: head.baseRevision,
    p_digest: head.digest,
    p_token_hash: tokenHash,
  };
}

async function prepare(
  token: string,
  fn: string,
  head: DraftHead,
  tokenHash: string,
  extra: Record<string, unknown> = {},
): Promise<WireResult> {
  return callRpc(token, fn, {
    p_preparation_id: extra.p_preparation_id ?? randomUUID(),
    ...prepArgs(head, tokenHash),
    ...extra,
  });
}
function prepId(prep: WireResult): string {
  return (prep.data as TPrepareContentDraftPublish).preparationId;
}
function publish(token: string, id: string, publishToken: string): Promise<WireResult> {
  return callRpc(token, 'publish_content_draft', { p_preparation_id: id, p_publish_token: publishToken });
}

function agentPublish(conn: { id: string; token: string }, id: string, publishToken: string): Promise<WireResult> {
  return callRpc(harness.tokens.anon, 'agent_publish_draft', {
    p_connection_id: conn.id,
    p_token: conn.token,
    p_preparation_id: id,
    p_publish_token: publishToken,
  });
}

async function createConnection(principal: 'adminA' | 'adminB'): Promise<{ id: string; token: string }> {
  const token = randomBytes(32).toString('base64url');
  const hash = createHash('sha256').update(Buffer.from(token, 'base64url')).digest('hex');
  const body = await callRpc(harness.tokens[principal], 'create_content_agent_connection', {
    p_connection_id: randomUUID(),
    p_token_hash: hash,
    p_label: 'DB-03 publication',
  });
  if (!body.ok) throw new Error('fixture connection creation failed');
  return { id: (body.data as { id: string }).id, token };
}

function ageOutPreparation(id: string, minutes: number): Promise<unknown> {
  return harness.owner.query(
    `update public.content_publish_preparations
     set created_at = created_at - ($2 || ' minutes')::interval,
         expires_at = expires_at - ($2 || ' minutes')::interval
     where id = $1`,
    [id, String(minutes)],
  );
}

async function prepOutcome(id: string): Promise<Record<string, unknown>> {
  const rows = await harness.owner.query(
    `select outcome, result, completed_at is not null as done
     from public.content_publish_preparations where id = $1`,
    [id],
  );
  return rows.rows[0];
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

describe('authorization precedes any data-bearing error', () => {
  it('rejects anonymous, non-admin and admin-on-gateway misuse', async () => {
    await resetContent();
    const head = await loadHead();
    const { hash } = newPublishToken();
    const anon = await callRpc(harness.tokens.anon, 'prepare_content_draft_publish', {
      p_preparation_id: randomUUID(),
      ...prepArgs(head, hash),
    });
    expect(anon.error?.code).toBe('unauthorized');
    const nonadmin = await callRpc(harness.tokens.nonadmin, 'publish_content_draft', {
      p_preparation_id: randomUUID(),
      p_publish_token: randomBytes(32).toString('base64url'),
    });
    expect(nonadmin.error?.code).toBe('unauthorized');
    const adminGateway = await callRpc(harness.tokens.adminA, 'agent_prepare_publish', {
      p_connection_id: randomUUID(),
      p_token: randomBytes(32).toString('base64url'),
      p_preparation_id: randomUUID(),
      ...prepArgs(head, hash),
    });
    expect(adminGateway.error?.code).toBe('unauthorized');
  });
});

describe('preparation', () => {
  it('binds generation/revision/digest/token hash without exposing the token', async () => {
    await resetContent();
    const head = await loadHead();
    const { hash } = newPublishToken();
    const body = await prepare(harness.tokens.adminA, 'prepare_content_draft_publish', head, hash);
    expect(body.ok).toBe(true);
    const prep = body.data as TPrepareContentDraftPublish;
    expect(prep).toMatchObject({
      draftId: 'current',
      generation: head.generation,
      expectedRevision: 42,
      digest: head.digest,
    });
    expect(Object.keys(prep)).not.toContain('tokenHash');
    expect(Object.keys(prep)).not.toContain('token');
  });

  it('fails stale generation, digest mismatch, revision conflict and bad hash input', async () => {
    await resetContent();
    const head = await loadHead();
    const { hash } = newPublishToken();
    const stale = await prepare(harness.tokens.adminA, 'prepare_content_draft_publish', head, hash, {
      p_generation: head.generation + 3,
    });
    expect(stale.error?.code).toBe('stale_generation');
    expect(stale.error?.currentHead?.generation).toBe(head.generation);
    const digest = await prepare(harness.tokens.adminA, 'prepare_content_draft_publish', head, hash, {
      p_digest: 'a'.repeat(64),
    });
    expect(digest.error?.code).toBe('preparation_invalid');
    const revision = await prepare(harness.tokens.adminA, 'prepare_content_draft_publish', head, hash, {
      p_expected_revision: 41,
    });
    expect(revision.error?.code).toBe('revision_conflict');
    expect(revision.error?.currentRevision).toBe(42);
    const badHash = await prepare(harness.tokens.adminA, 'prepare_content_draft_publish', head, 'nothex');
    expect(badHash.error?.code).toBe('invalid_input');
    const rows = await harness.owner.query('select count(*)::int as count from public.content_publish_preparations');
    expect(rows.rows[0]?.['count']).toBe(0);
  });

  it('replays identical pending preparations; rejects mismatched or expired replay', async () => {
    await resetContent();
    const head = await loadHead();
    const { hash } = newPublishToken();
    const id = randomUUID();
    const args = {
      p_preparation_id: id,
      p_generation: head.generation,
      p_expected_revision: head.baseRevision,
      p_digest: head.digest,
      p_token_hash: hash,
    };
    const first = await callRpc(harness.tokens.adminA, 'prepare_content_draft_publish', args);
    const second = await callRpc(harness.tokens.adminA, 'prepare_content_draft_publish', args);
    expect(second.data).toEqual(first.data);
    const otherAdmin = await callRpc(harness.tokens.adminB, 'prepare_content_draft_publish', args);
    expect(otherAdmin.error?.code).toBe('preparation_invalid');
    await ageOutPreparation(id, 11);
    const expired = await callRpc(harness.tokens.adminA, 'prepare_content_draft_publish', args);
    expect(expired.error?.code).toBe('preparation_expired');
    expect(await prepOutcome(id)).toMatchObject({ outcome: 'pending', done: false });
  });
});

describe('publication', () => {
  it('publishes atomically: one revision increment, one history row, draft alignment', async () => {
    await resetContent();
    const head = await loadHead();
    const { token, hash } = newPublishToken();
    const prep = await prepare(harness.tokens.adminA, 'prepare_content_draft_publish', head, hash);
    const result = (await publish(harness.tokens.adminA, prepId(prep), token)).data as TPublishContentDraft;
    expect(result).toMatchObject({
      revision: 43,
      draftGeneration: head.generation + 1,
      digest: head.digest,
    });
    const live = await harness.owner.query(
      `select revision::int as revision, published_by, published_via_connection_id
       from public.published_content where id = 'current'`,
    );
    expect(live.rows[0]).toEqual({
      revision: 43,
      published_by: harness.userIds.adminA,
      published_via_connection_id: null,
    });
    const after = await loadHead();
    expect(after).toMatchObject({ baseRevision: 43, generation: head.generation + 1, digest: head.digest });
    expect(after.lastActor).toMatchObject({ kind: 'admin', connectionId: null });
    const history = await harness.owner.query(
      'select count(*)::int as count from public.published_content_history where revision = 42',
    );
    expect(history.rows[0]?.['count']).toBe(1);
  });

  it('lets two concurrent publishes of one preparation yield one increment and one history row', async () => {
    await resetContent();
    const head = await loadHead();
    const { token, hash } = newPublishToken();
    const prep = await prepare(harness.tokens.adminA, 'prepare_content_draft_publish', head, hash);
    // Replay requires the same immutable principal binding (doc 15): same admin.
    const [first, second] = await Promise.all([
      publish(harness.tokens.adminA, prepId(prep), token),
      publish(harness.tokens.adminA, prepId(prep), token),
    ]);
    expect(first.ok && second.ok).toBe(true);
    expect(second.data).toEqual(first.data);
    expect((first.data as TPublishContentDraft).revision).toBe(43);
    const live = await harness.owner.query('select revision from public.published_content where id = $1', ['current']);
    expect(Number(live.rows[0]?.['revision'])).toBe(43);
    const history = await harness.owner.query('select count(*)::int as count from public.published_content_history');
    expect(history.rows[0]?.['count']).toBe(1);
  });

  it('replays the original result after draft changes and preparation expiry', async () => {
    await resetContent();
    const head = await loadHead();
    const { token, hash } = newPublishToken();
    const id = prepId(await prepare(harness.tokens.adminA, 'prepare_content_draft_publish', head, hash));
    const first = await publish(harness.tokens.adminA, id, token);
    expect(first.ok).toBe(true);
    await changeDraft(harness.tokens.adminB);
    await ageOutPreparation(id, 30);
    const replay = await publish(harness.tokens.adminA, id, token);
    expect(replay.ok).toBe(true);
    expect(replay.data).toEqual(first.data);
    const live = await harness.owner.query('select revision from public.published_content where id = $1', ['current']);
    expect(Number(live.rows[0]?.['revision'])).toBe(43);
  });

  it('fails replay after capability revocation, capability expiry or wrong token', async () => {
    await resetContent();
    const conn = await createConnection('adminA');
    const { token, hash } = newPublishToken();
    const prep = await prepare(harness.tokens.anon, 'agent_prepare_publish', await loadHead(), hash, {
      p_connection_id: conn.id,
      p_token: conn.token,
    });
    expect((await agentPublish(conn, prepId(prep), token)).ok).toBe(true);
    await callRpc(harness.tokens.adminB, 'revoke_content_agent_connection', { p_connection_id: conn.id });
    const revoked = await agentPublish(conn, prepId(prep), token);
    expect(revoked.error?.code).toBe('invalid_capability');

    // Expired connection: capability lifecycle also blocks the replay.
    const conn2 = await createConnection('adminB');
    const { token: token2, hash: hash2 } = newPublishToken();
    const prep2 = await prepare(harness.tokens.anon, 'agent_prepare_publish', await loadHead(), hash2, {
      p_connection_id: conn2.id,
      p_token: conn2.token,
    });
    expect((await agentPublish(conn2, prepId(prep2), token2)).ok).toBe(true);
    await harness.owner.query(
      `update public.content_agent_connections
       set created_at = created_at - interval '2 years',
           expires_at = expires_at - interval '2 years'
       where id = $1`,
      [conn2.id],
    );
    const expiredReplay = await agentPublish(conn2, prepId(prep2), token2);
    expect(expiredReplay.error?.code).toBe('invalid_capability');

    const { token: token3, hash: hash3 } = newPublishToken();
    const prep3 = await prepare(harness.tokens.adminA, 'prepare_content_draft_publish', await loadHead(), hash3);
    const wrong = await publish(harness.tokens.adminA, prepId(prep3), randomBytes(32).toString('base64url'));
    expect(wrong.error?.code).toBe('preparation_invalid');
    const unknown = await publish(harness.tokens.adminA, randomUUID(), token3);
    expect(unknown.error?.code).toBe('preparation_invalid');
    expect(await prepOutcome(prepId(prep3))).toMatchObject({ outcome: 'pending', result: null });
  });

  it('marks stale on draft drift and expired on pending expiry without rebinding', async () => {
    await resetContent();
    const head = await loadHead();
    const { token, hash } = newPublishToken();
    const id = prepId(await prepare(harness.tokens.adminA, 'prepare_content_draft_publish', head, hash));
    await changeDraft(harness.tokens.adminB);
    const stale = await publish(harness.tokens.adminA, id, token);
    expect(stale.error?.code).toBe('preparation_stale');
    expect(await prepOutcome(id)).toMatchObject({ outcome: 'stale', result: null });
    const rebound = await publish(harness.tokens.adminA, id, token);
    expect(rebound.error?.code).toBe('preparation_invalid');

    const head2 = await changeDraft(harness.tokens.adminA);
    const { token: token2, hash: hash2 } = newPublishToken();
    const id2 = prepId(await prepare(harness.tokens.adminA, 'prepare_content_draft_publish', head2, hash2));
    await ageOutPreparation(id2, 11);
    const expired = await publish(harness.tokens.adminA, id2, token2);
    expect(expired.error?.code).toBe('preparation_expired');
    expect(await prepOutcome(id2)).toMatchObject({ outcome: 'expired', done: true });
  });

  it('fails closed on live/base revision mismatch and preserves the draft', async () => {
    await resetContent();
    const head = await loadHead();
    const { token, hash } = newPublishToken();
    const id = prepId(await prepare(harness.tokens.adminA, 'prepare_content_draft_publish', head, hash));
    await harness.owner.query(
      `update public.published_content set revision = revision + 1, published_by = $1
       where id = 'current'`,
      [harness.userIds.adminB],
    );
    const conflict = await publish(harness.tokens.adminA, id, token);
    expect(conflict.error?.code).toBe('revision_conflict');
    expect(conflict.error?.currentRevision).toBe(43);
    const after = await loadHead();
    expect(after).toMatchObject({ baseRevision: 42, generation: head.generation, digest: head.digest });
    const live = await harness.owner.query('select revision, payload from public.published_content where id = $1', [
      'current',
    ]);
    expect(Number(live.rows[0]?.['revision'])).toBe(43);
    expect(live.rows[0]?.['payload']).toEqual(BASE_PAYLOAD);
    expect(await prepOutcome(id)).toMatchObject({ outcome: 'stale' });
  });

  it('attributes admin principal and delegating connection in live, history and draft', async () => {
    await resetContent();
    const conn = await createConnection('adminB');
    const { token, hash } = newPublishToken();
    const prep = await prepare(harness.tokens.anon, 'agent_prepare_publish', await loadHead(), hash, {
      p_connection_id: conn.id,
      p_token: conn.token,
    });
    expect((await agentPublish(conn, prepId(prep), token)).ok).toBe(true);
    const live = await harness.owner.query(
      `select published_by, published_via_connection_id
       from public.published_content where id = 'current'`,
    );
    expect(live.rows[0]).toEqual({
      published_by: harness.userIds.adminB,
      published_via_connection_id: conn.id,
    });
    const after = await loadHead();
    expect(after.lastActor).toEqual({
      kind: 'agent',
      principalUserId: harness.userIds.adminB,
      connectionId: conn.id,
    });
    await changeDraft(harness.tokens.adminA);
    const { token: token2, hash: hash2 } = newPublishToken();
    const prep2 = await prepare(harness.tokens.adminA, 'prepare_content_draft_publish', await loadHead(), hash2);
    const second = await publish(harness.tokens.adminA, prepId(prep2), token2);
    expect(second.ok).toBe(true);
    const history = await harness.owner.query(
      `select published_by, published_via_connection_id
       from public.published_content_history where revision = 43`,
    );
    expect(history.rows[0]).toEqual({
      published_by: harness.userIds.adminB,
      published_via_connection_id: conn.id,
    });
  });

  it('rolls back history, live, draft and outcome together on a SQL failure', async () => {
    await resetContent();
    const head = await loadHead();
    const { token, hash } = newPublishToken();
    const id = prepId(await prepare(harness.tokens.adminA, 'prepare_content_draft_publish', head, hash));
    // Extra BEFORE UPDATE trigger raising: the whole transaction rolls back.
    await harness.owner.query(
      `create or replace function public.__db03_block_publish() returns trigger
       language plpgsql as $fn$ begin raise exception 'blocked'; end $fn$`,
    );
    await harness.owner.query(
      `create trigger aaa_db03_block_publish
       before update on public.published_content
       for each row execute function public.__db03_block_publish()`,
    );
    let blocked: WireResult;
    try {
      blocked = await publish(harness.tokens.adminA, id, token);
    } finally {
      await harness.owner.query(
        `drop trigger if exists aaa_db03_block_publish on public.published_content;
       drop function if exists public.__db03_block_publish()`,
      );
    }
    expect(blocked.ok).toBe(false);
    const live = await harness.owner.query('select revision, payload from public.published_content where id = $1', [
      'current',
    ]);
    expect(Number(live.rows[0]?.['revision'])).toBe(42);
    expect(live.rows[0]?.['payload']).toEqual(BASE_PAYLOAD);
    const after = await loadHead();
    expect(after).toMatchObject({ baseRevision: 42, generation: head.generation });
    const history = await harness.owner.query('select count(*)::int as count from public.published_content_history');
    expect(history.rows[0]?.['count']).toBe(0);
    expect(await prepOutcome(id)).toMatchObject({ outcome: 'pending', result: null });
    const retry = await publish(harness.tokens.adminA, id, token);
    expect(retry.ok).toBe(true);
    expect((retry.data as TPublishContentDraft).revision).toBe(43);
  });
});
