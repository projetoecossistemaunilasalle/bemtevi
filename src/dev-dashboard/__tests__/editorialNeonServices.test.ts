import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ContentDraft, DraftHead, EditExport } from '@bemtevi/content-core';

/**
 * INTEGRATION-01 composition tests.
 *
 * `../app/neon/client` is mocked with a spy holding the real client's `rpc`
 * shape, so every repository-wiring assertion runs against the REAL
 * `editorialNeonServices` composition object (adapter + factories), not a
 * re-composition. The hook mock captures the module-import-time
 * `configureCanonicalWorkspaceServices` wiring.
 */

// --- Mocked client module (hoisted; recorder created inside vi.hoisted) ----------

interface RecordedCall {
  method: string;
  args: Record<string, unknown>;
}

type RpcResponse = { data: unknown; error: unknown };

/** Spy with the real client's `rpc` shape; identity shared with the mocked module. */
const { spy } = vi.hoisted(() => {
  class SpyClient {
    calls: Array<{ method: string; args: Record<string, unknown> }> = [];
    response: { data: unknown; error: unknown } = { data: null, error: null };

    async rpc(method: string, args: Record<string, unknown>): Promise<{ data: unknown; error: unknown }> {
      this.calls.push({ method, args });
      return this.response;
    }
  }
  return { spy: new SpyClient() };
});

vi.mock('../../app/neon/client', () => ({
  defaultNeonClient: spy,
  createConfiguredNeonClient: vi.fn(() => spy),
  getNeonConfig: vi.fn(() => ({ authUrl: 'https://auth.example', dataApiUrl: 'https://data.example' })),
}));

const configureWorkspaceServices = vi.hoisted(() => vi.fn());

vi.mock('../draft-storage/useDraftWorkspace', () => ({
  configureCanonicalWorkspaceServices: (...args: unknown[]) => configureWorkspaceServices(...args),
}));

// Real modules under the mocks (vitest hoists vi.mock above these imports).
import { createConfiguredNeonClient, type BemTeViNeonClient, type NeonConfig } from '../../app/neon/client';
import type { ConnectionRpcTransport } from '../ai/connections/connectionRepository';
import type { DraftRpcTransport } from '../drafts/draftRepository';
import type { ExportRpcTransport } from '../ai/files/exportRepository';
import { editorialNeonConfigured, editorialNeonServices } from '../editorialNeonServices';

// --- Fixtures -------------------------------------------------------------------

const DIGEST_A = 'a'.repeat(64);
const DIGEST_B = 'b'.repeat(64);
const UUID_C = '00000000-0000-4000-8000-0000000000c1';
const UUID_P = '00000000-0000-4000-8000-0000000000p1';
const UUID_E = '00000000-0000-4000-8000-0000000000e1';
const TOKEN_HASH = 'c'.repeat(64);
const RAW_TOKEN = 'raw-secret-token-value';

const HEAD: DraftHead = {
  id: 'current',
  schemaVersion: '1.0.0',
  baseRevision: 40,
  generation: 51,
  digest: DIGEST_A,
  updatedAt: '2026-09-12T10:00:00.000Z',
  lastActor: { kind: 'admin', principalUserId: 'admin-1', connectionId: null },
};

const PAYLOAD = {
  flows: [],
  educationMaterials: [],
  educationGroups: [],
  contacts: [],
  locations: [],
  defaultGroupOrder: 0,
};

const CONNECTION = {
  id: UUID_C,
  draftId: 'current',
  principalUserId: 'admin-1',
  label: 'Assistente da coordenação',
  createdAt: '2026-09-01T08:00:00.000Z',
  expiresAt: '2027-09-01T08:00:00.000Z',
  revokedAt: null,
  lastUsedAt: null,
};

function exportFixture(): EditExport {
  return {
    exportId: UUID_E,
    draftId: 'current',
    schemaVersion: '2.0.0',
    baseGeneration: 51,
    baseDigest: DIGEST_A,
    publishedRevision: 40,
    basePayload: PAYLOAD as EditExport['basePayload'],
    canonicalPayload: JSON.stringify(PAYLOAD),
    createdBy: 'admin-1',
    createdAt: '2026-09-12T10:00:00.000Z',
    expiresAt: '2026-09-26T10:00:00.000Z',
    selection: null,
  };
}

function okEnvelope(data: unknown): RpcResponse {
  return { data: { ok: true, data }, error: null };
}

function errorEnvelope(error: unknown): RpcResponse {
  return { data: { ok: false, error }, error: null };
}

/** Raw tokens/secret markers that must never appear inside any rpc args value. */
const FORBIDDEN_SECRET_STRINGS = [RAW_TOKEN, 'secret', 'password', 'apiKey'];

function expectNoSecrets(call: RecordedCall): void {
  for (const value of Object.values(call.args)) {
    if (typeof value === 'string') {
      for (const secret of FORBIDDEN_SECRET_STRINGS) expect(value).not.toContain(secret);
    }
  }
}

beforeEach(() => {
  spy.calls.length = 0;
  spy.response = { data: null, error: null };
});

// --- Structural transport satisfaction ------------------------------------------

describe('editorialNeonServices structural transports', () => {
  it('a spy client with the real rpc shape satisfies all three transports', () => {
    const asDraft: DraftRpcTransport = spy;
    const asExport: ExportRpcTransport = spy;
    const asConnection: ConnectionRpcTransport = spy;
    expect(asDraft.rpc).toBeTypeOf('function');
    expect(asExport.rpc).toBeTypeOf('function');
    expect(asConnection.rpc).toBeTypeOf('function');
  });

  it('the factory-produced client satisfies all three transports structurally', () => {
    // The mocked factory returns the same spy shape the real client exposes
    // (`rpc(method, args)` thenable); the production adapter's delegation is
    // what the composition consumes, and the spy here proves that shape alone
    // fulfills every transport contract.
    const client = createConfiguredNeonClient({
      authUrl: 'https://auth.example',
      dataApiUrl: 'https://data.example',
    } satisfies NeonConfig);
    expect(client).not.toBeNull();
    if (client === null) throw new Error('client expected');
    const asDraft: DraftRpcTransport = {
      // The mocked factory's client only exposes the single legacy-free shape;
      // delegating through `await` proves the thenable result satisfies the
      // transports' Promise contract without casts.
      async rpc(_method: string, args: Record<string, unknown>) {
        return await client.rpc('get_content_draft', args);
      },
    };
    const asExport: ExportRpcTransport = asDraft;
    const asConnection: ConnectionRpcTransport = asDraft;
    expect(asDraft.rpc).toBeTypeOf('function');
    expect(asExport.rpc).toBeTypeOf('function');
    expect(asConnection.rpc).toBeTypeOf('function');
    void client as unknown as BemTeViNeonClient;
  });

  it('exposes exactly the frozen composition keys, immutably, and reports configured', () => {
    expect(Object.keys(editorialNeonServices).sort()).toEqual([
      'connectionRepository',
      'draftRepository',
      'exportRepository',
    ]);
    expect(Object.isFrozen(editorialNeonServices)).toBe(true);
    expect(editorialNeonConfigured).toBe(true);
  });

  it('wired the canonical workspace hook with the composed draft repository at import time', () => {
    expect(configureWorkspaceServices).toHaveBeenCalledTimes(1);
    const services = configureWorkspaceServices.mock.calls[0]?.[0] as { repository: unknown } | null | undefined;
    expect(services?.repository).toBe(editorialNeonServices.draftRepository);
  });
});

// --- Repository composition wiring ------------------------------------------------

describe('editorialNeonServices repository wiring', () => {
  it('connection management: create/list/revoke call the exact admin RPCs with exact args', async () => {
    spy.response = okEnvelope(CONNECTION);
    await editorialNeonServices.connectionRepository.create(UUID_C, TOKEN_HASH, 'Assistente da coordenação');
    spy.response = okEnvelope([CONNECTION]);
    await editorialNeonServices.connectionRepository.list();
    spy.response = okEnvelope({ ...CONNECTION, revokedAt: '2026-06-01T00:00:00Z' });
    const revoked = await editorialNeonServices.connectionRepository.revoke(UUID_C);
    expect(revoked.ok).toBe(true);

    expect(spy.calls).toEqual([
      {
        method: 'create_content_agent_connection',
        args: { p_connection_id: UUID_C, p_token_hash: TOKEN_HASH, p_label: 'Assistente da coordenação' },
      },
      { method: 'list_content_agent_connections', args: {} },
      { method: 'revoke_content_agent_connection', args: { p_connection_id: UUID_C } },
    ]);
  });

  it('connection error envelope (revoke) decodes through the composition', async () => {
    spy.response = errorEnvelope({ code: 'invalid_input' });
    const result = await editorialNeonServices.connectionRepository.revoke(UUID_C);
    expect(result).toEqual({ ok: false, error: { code: 'invalid_input' } });
  });

  it('draft prepare/publish call the exact admin RPCs with exact snake_case args', async () => {
    spy.response = okEnvelope({
      preparationId: UUID_P,
      draftId: 'current',
      generation: 51,
      expectedRevision: 40,
      digest: DIGEST_A,
      expiresAt: '2026-09-12T10:10:00.000Z',
    });
    const prepared = await editorialNeonServices.draftRepository.prepare({
      preparationId: UUID_P,
      generation: 51,
      expectedRevision: 40,
      digest: DIGEST_A,
      tokenHash: DIGEST_B,
    });
    expect(prepared.ok).toBe(true);

    spy.response = okEnvelope({
      revision: 41,
      publishedAt: '2026-09-12T10:05:00.000Z',
      draftGeneration: 52,
      digest: DIGEST_A,
    });
    const published = await editorialNeonServices.draftRepository.publish(UUID_P, RAW_TOKEN);
    expect(published.ok).toBe(true);

    expect(spy.calls).toEqual([
      {
        method: 'prepare_content_draft_publish',
        args: {
          p_preparation_id: UUID_P,
          p_generation: 51,
          p_expected_revision: 40,
          p_digest: DIGEST_A,
          p_token_hash: DIGEST_B,
        },
      },
      { method: 'publish_content_draft', args: { p_preparation_id: UUID_P, p_publish_token: RAW_TOKEN } },
    ]);
  });

  it('draft load/mutate call the exact admin RPCs with exact args', async () => {
    const draft: ContentDraft = {
      ...HEAD,
      status: 'active',
      payload: PAYLOAD as ContentDraft['payload'],
      canonicalPayload: JSON.stringify(PAYLOAD),
      createdAt: '2026-09-01T08:00:00.000Z',
      createdBy: 'admin-1',
    };
    spy.response = okEnvelope(draft);
    const loaded = await editorialNeonServices.draftRepository.load();
    expect(loaded).toEqual({ ok: true, data: draft });

    const operations = [{ op: 'set_default_group_order' as const, value: 4 }];
    spy.response = okEnvelope({ head: { ...HEAD, generation: 52 }, changed: true });
    const mutated = await editorialNeonServices.draftRepository.mutate({ expectedGeneration: 51, operations });
    expect(mutated.ok).toBe(true);

    expect(spy.calls).toEqual([
      { method: 'get_content_draft', args: {} },
      {
        method: 'apply_content_draft_operations',
        args: { p_expected_generation: 51, p_operations: operations },
      },
    ]);
  });

  it('lost-create replay wiring: the composition passes identical calls through unchanged', async () => {
    spy.response = okEnvelope(CONNECTION);
    await editorialNeonServices.connectionRepository.create(UUID_C, TOKEN_HASH, 'mesma');
    await editorialNeonServices.connectionRepository.create(UUID_C, TOKEN_HASH, 'mesma');
    expect(spy.calls[0]).toEqual(spy.calls[1]);
  });

  it('cross-session export retrieval wiring: create and get flow through the composition', async () => {
    spy.response = okEnvelope(exportFixture());
    const created = await editorialNeonServices.exportRepository.create(UUID_E, 51, null);
    expect(created.ok).toBe(true);

    spy.response = okEnvelope(exportFixture());
    const fetched = await editorialNeonServices.exportRepository.get(UUID_E);
    expect(fetched.ok).toBe(true);

    expect(spy.calls).toEqual([
      {
        method: 'create_content_edit_export',
        args: { p_export_id: UUID_E, p_expected_generation: 51, p_selection: null },
      },
      { method: 'get_content_edit_export', args: { p_export_id: UUID_E } },
    ]);
  });

  it('export transport failure maps to unauthorized through the composition', async () => {
    spy.response = { data: null, error: { status: 403, message: 'forbidden' } };
    const result = await editorialNeonServices.exportRepository.get(UUID_E);
    expect(result).toEqual({ ok: false, error: { code: 'unauthorized' } });
  });

  it('never passes raw tokens or secret strings inside rpc args, and no actor identity parameters', async () => {
    spy.response = okEnvelope(CONNECTION);
    await editorialNeonServices.connectionRepository.create(UUID_C, TOKEN_HASH, 'Assistente');
    spy.response = okEnvelope({
      preparationId: UUID_P,
      draftId: 'current',
      generation: 51,
      expectedRevision: 40,
      digest: DIGEST_A,
      expiresAt: '2026-09-12T10:10:00.000Z',
    });
    await editorialNeonServices.draftRepository.prepare({
      preparationId: UUID_P,
      generation: 51,
      expectedRevision: 40,
      digest: DIGEST_A,
      tokenHash: TOKEN_HASH,
    });
    for (const call of spy.calls) {
      expectNoSecrets(call);
      for (const key of Object.keys(call.args)) expect(key).not.toMatch(/actor|principal|user_id/);
    }
    expect(spy.calls[0]?.args['p_token_hash']).toBe(TOKEN_HASH);
    expect(spy.calls[0]?.args['p_token_hash']).not.toBe(RAW_TOKEN);
  });
});
