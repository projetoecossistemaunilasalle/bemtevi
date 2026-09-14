import { describe, expect, it } from 'vitest';
import {
  createConnectionRepository,
  mapConnectionTransportError,
  parseAgentConnection,
  type ConnectionRpcCallResult,
  type ConnectionRpcTransport,
} from '../connectionRepository';

const VALID_CONNECTION: Record<string, unknown> = {
  id: '00000000-0000-4000-8000-0000000000c1',
  draftId: 'current',
  principalUserId: '00000000-0000-4000-8000-0000000000a1',
  label: 'ChatGPT da coordenação',
  createdAt: '2026-01-01T00:00:00Z',
  expiresAt: '2027-01-01T00:00:00Z',
  revokedAt: null,
  lastUsedAt: null,
};

class FakeTransport implements ConnectionRpcTransport {
  public calls: Array<{ method: string; args: Record<string, unknown> }> = [];
  public response: ConnectionRpcCallResult = { data: { ok: true, data: VALID_CONNECTION }, error: null };
  public throwOnCall = false;

  async rpc(method: string, args: Record<string, unknown>): Promise<ConnectionRpcCallResult> {
    if (this.throwOnCall) throw new Error('network down');
    this.calls.push({ method, args });
    return this.response;
  }
}

const TOKEN_HASH = 'a'.repeat(64);

describe('connectionRepository RPC mapping', () => {
  it('create maps create_content_agent_connection with exact snake_case parameters', async () => {
    const transport = new FakeTransport();
    const repository = createConnectionRepository(transport);
    const result = await repository.create(
      '00000000-0000-4000-8000-0000000000c1',
      TOKEN_HASH,
      'ChatGPT da coordenação',
    );

    expect(transport.calls).toEqual([
      {
        method: 'create_content_agent_connection',
        args: {
          p_connection_id: '00000000-0000-4000-8000-0000000000c1',
          p_token_hash: TOKEN_HASH,
          p_label: 'ChatGPT da coordenação',
        },
      },
    ]);
    expect(result.ok).toBe(true);
  });

  it('create never carries the raw token — only the hex hash argument', async () => {
    const transport = new FakeTransport();
    const repository = createConnectionRepository(transport);
    await repository.create('00000000-0000-4000-8000-0000000000c1', TOKEN_HASH, 'ChatGPT da coordenação');

    const args = transport.calls[0]!.args;
    expect(Object.keys(args).sort()).toEqual(['p_connection_id', 'p_label', 'p_token_hash']);
    expect(args['p_token_hash']).toBe(TOKEN_HASH);
    // Only the hex hash value crossed the wire; no raw credential argument exists.
    expect(String(args['p_token_hash'])).toMatch(/^[0-9a-f]{64}$/);
  });

  it('create rejects a non-hash token hash locally with invalid_input (no RPC)', async () => {
    const transport = new FakeTransport();
    const repository = createConnectionRepository(transport);
    const result = await repository.create('00000000-0000-4000-8000-0000000000c1', 'not-a-hash', 'label');

    expect(transport.calls).toEqual([]);
    if (result.ok === true) throw new Error('expected failure');
    expect(result.error.code).toBe('invalid_input');
  });

  it('list maps list_content_agent_connections with no arguments', async () => {
    const transport = new FakeTransport();
    transport.response = { data: { ok: true, data: [VALID_CONNECTION] }, error: null };
    const repository = createConnectionRepository(transport);
    const result = await repository.list();

    expect(transport.calls).toEqual([{ method: 'list_content_agent_connections', args: {} }]);
    if (result.ok === false) throw new Error('expected success');
    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.id).toBe('00000000-0000-4000-8000-0000000000c1');
  });

  it('revoke maps revoke_content_agent_connection with the connection id parameter', async () => {
    const transport = new FakeTransport();
    const revoked = { ...VALID_CONNECTION, revokedAt: '2026-06-01T00:00:00Z' };
    transport.response = { data: { ok: true, data: revoked }, error: null };
    const repository = createConnectionRepository(transport);
    const result = await repository.revoke('00000000-0000-4000-8000-0000000000c1');

    expect(transport.calls).toEqual([
      { method: 'revoke_content_agent_connection', args: { p_connection_id: '00000000-0000-4000-8000-0000000000c1' } },
    ]);
    if (result.ok === false) throw new Error('expected success');
    expect(result.data.revokedAt).toBe('2026-06-01T00:00:00Z');
  });

  it('create replays the same UUID with the same hash (ambiguous retry is idempotent)', async () => {
    const transport = new FakeTransport();
    const repository = createConnectionRepository(transport);
    const id = '00000000-0000-4000-8000-0000000000c2';
    await repository.create(id, TOKEN_HASH, 'mesma');
    await repository.create(id, TOKEN_HASH, 'mesma');

    expect(transport.calls[0]!.args).toEqual(transport.calls[1]!.args);
  });

  it('passes domain error envelopes through with the exact code', async () => {
    const transport = new FakeTransport();
    transport.response = { data: { ok: false, error: { code: 'invalid_input' } }, error: null };
    const repository = createConnectionRepository(transport);
    const result = await repository.create('00000000-0000-4000-8000-0000000000c1', TOKEN_HASH, 'x');

    if (result.ok === true) throw new Error('expected failure');
    expect(result.error.code).toBe('invalid_input');
  });

  it('maps transport 401/403/42501/PGRST301 to unauthorized, everything else to unavailable', () => {
    expect(mapConnectionTransportError({ code: '42501' }).code).toBe('unauthorized');
    expect(mapConnectionTransportError({ code: 'PGRST301' }).code).toBe('unauthorized');
    expect(mapConnectionTransportError({ status: 401 }).code).toBe('unauthorized');
    expect(mapConnectionTransportError({ status: 403 }).code).toBe('unauthorized');
    expect(mapConnectionTransportError({ code: 'PGRST102' }).code).toBe('unavailable');
    expect(mapConnectionTransportError(new Error('boom')).code).toBe('unavailable');
  });

  it('maps an error field on the transport result to the transport mapping', async () => {
    const transport = new FakeTransport();
    transport.response = { data: null, error: { status: 403 } };
    const repository = createConnectionRepository(transport);
    const result = await repository.list();

    if (result.ok === true) throw new Error('expected failure');
    expect(result.error.code).toBe('unauthorized');
  });

  it('returns unavailable when the transport throws', async () => {
    const transport = new FakeTransport();
    transport.throwOnCall = true;
    const repository = createConnectionRepository(transport);
    const result = await repository.list();

    if (result.ok === true) throw new Error('expected failure');
    expect(result.error.code).toBe('unavailable');
  });

  it('returns unavailable for malformed envelopes and dropped hash columns', async () => {
    const transport = new FakeTransport();
    transport.response = { data: { ok: true, data: { nonsense: true } }, error: null };
    const repository = createConnectionRepository(transport);
    const malformed = await repository.list();
    if (malformed.ok === true) throw new Error('expected failure');
    expect(malformed.error.code).toBe('unavailable');

    // A hash column smuggled into the response is dropped: parse fails closed.
    const secretLeak = { ...VALID_CONNECTION, tokenHash: 'deadbeef' };
    expect(
      parseAgentConnection(secretLeak) === null || parseAgentConnection(secretLeak)!.id === VALID_CONNECTION.id,
    ).toBe(true);
    const parsed = parseAgentConnection(secretLeak);
    expect(parsed !== null && !('tokenHash' in parsed)).toBe(true);
  });

  it('decodes revoked and last-used metadata states', () => {
    const revoked = parseAgentConnection({
      ...VALID_CONNECTION,
      revokedAt: '2026-06-01T00:00:00Z',
      lastUsedAt: '2026-05-01T00:00:00Z',
    });
    expect(
      revoked !== null && revoked.revokedAt === '2026-06-01T00:00:00Z' && revoked.lastUsedAt === '2026-05-01T00:00:00Z',
    ).toBe(true);
    expect(parseAgentConnection({ ...VALID_CONNECTION, draftId: 'other' })).toBeNull();
    expect(parseAgentConnection({ ...VALID_CONNECTION, id: 'not-uuid' })).toBeNull();
    expect(parseAgentConnection({ ...VALID_CONNECTION, label: '' })).toBeNull();
    expect(parseAgentConnection({ ...VALID_CONNECTION, label: 'x'.repeat(81) })).toBeNull();
    expect(parseAgentConnection([VALID_CONNECTION])).toBeNull();
  });
});
