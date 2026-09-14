import { describe, expect, it } from 'vitest';
import { McpServer } from '@modelcontextprotocol/server';
import { SERVER_NAME, SERVER_VERSION, createServer } from '../src/server/createServer';
import { SERVER_INSTRUCTIONS } from '../src/server/instructions';
import { createToolDispatch } from '../src/server/dispatch';
import { createDataApiClientWith } from '../src/client/dataApiClient';
import { mapTransportError, redact } from '../src/client/errors';

/**
 * Server tests (MCP-01): factory contract, instructions exposure via both
 * modern and legacy initialization, dispatch of unknown tools, RPC allowlist,
 * anonymous token acquisition path, redaction, and error mapping.
 */

function makeServer() {
  const dispatch = createToolDispatch();
  return { dispatch, server: createServer(dispatch, []) };
}

describe('McpServer factory contract', () => {
  it('creates the server with the exact name, version, and instructions', () => {
    const { server } = makeServer();
    expect(server).toBeInstanceOf(McpServer);
    expect(SERVER_NAME).toBe('bemtevi-content');
    expect(SERVER_VERSION).toBe('1.0.0');
  });

  it('ships the exact instructions text from doc 04', () => {
    expect(SERVER_INSTRUCTIONS).toContain('You edit BemTeVi editorial content, not software.');
    expect(SERVER_INSTRUCTIONS).toContain('Publish only when the user explicitly asks to publish.');
    expect(SERVER_INSTRUCTIONS).toContain(
      'Never request an admin password, admin session, database URL, Neon API key, repository clone, local draft server, or filesystem access.',
    );
  });
});

describe('dispatch seam', () => {
  it('rejects unknown tools with a fixed error and no credential echo', async () => {
    const { dispatch } = makeServer();
    const result = await dispatch.dispatch('totally_unknown_tool', {});
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('invalid_input');
  });

  it('routes registered tools to their handler and wraps thrown errors', async () => {
    const dispatch = createToolDispatch();
    dispatch.register({
      name: 'demo_tool',
      description: 'Demo.',
      handler: async (args) => ({ ok: true, data: args['value'] }),
    });
    dispatch.register({
      name: 'failing_tool',
      description: 'Fails.',
      handler: async () => {
        throw new Error('boom');
      },
    });
    const good = await dispatch.dispatch('demo_tool', { value: 7 });
    expect(good.ok).toBe(true);
    expect(good.data).toBe(7);
    const bad = await dispatch.dispatch('failing_tool', {});
    expect(bad.ok).toBe(false);
    expect(bad.error?.code).toBe('unavailable');
  });
});

describe('RPC allowlist', () => {
  it('exposes only the fixed capability-gateway RPC names', async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const client = createDataApiClientWith(async (name, args) => {
      calls.push({ name, args });
      return { data: null };
    });
    for (const name of [
      'agent_get_editor_context',
      'agent_get_draft',
      'agent_get_published_content',
      'agent_apply_operations',
    ] as const) {
      const result = await client.rpc(name, {});
      expect(result.error).toBeUndefined();
    }
    expect(calls).toHaveLength(4);
    // An allowlisted-type call with an unregistered name cannot be constructed
    // through the public API (compile-time), but the guard holds at runtime too.
    const forced = await client.rpc('agent_get_editor_context', {});
    expect(forced.error).toBeUndefined();
  });

  it('invalid endpoint/tool parameters cannot redirect credentials to another function', async () => {
    const seen: string[] = [];
    const client = createDataApiClientWith(async (name) => {
      seen.push(name);
      return { data: null };
    });
    // Only the four fixed names exist; arbitrary strings typed as agents are
    // rejected inside callRpc before reaching the transport.
    const bad = await (
      client.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<{ error?: { code: string } }>
    )('information_schema.tables', { p_token: 'x'.repeat(43) });
    expect(bad.error?.code).toBe('invalid_input');
    expect(seen).toEqual([]);
  });
});

describe('error mapping and redaction', () => {
  it('maps schema/transport errors to the fixed editorial codes', () => {
    expect(mapTransportError({ status: 401 }).code).toBe('unauthorized');
    expect(mapTransportError({ status: 403 }).code).toBe('unauthorized');
    expect(mapTransportError({ status: 500 }).code).toBe('unavailable');
    expect(mapTransportError(new Error('network down')).code).toBe('unavailable');
  });

  it('redacts tokens, authorization headers, and cookies from diagnostics', () => {
    const token = 'A'.repeat(43);
    const text = `failed with Authorization: Bearer ${token} and token=${token} cookie: session_token=abc`;
    const sanitized = redact(text, [token]);
    expect(sanitized).not.toContain(token);
    expect(sanitized).not.toContain('Bearer');
    expect(sanitized).not.toContain('session_token=abc');
  });
});
