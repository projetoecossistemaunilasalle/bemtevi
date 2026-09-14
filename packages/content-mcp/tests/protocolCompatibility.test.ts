import { describe, expect, it } from 'vitest';
import {
  InMemoryTransport,
  LATEST_PROTOCOL_VERSION,
  SUPPORTED_PROTOCOL_VERSIONS,
  type JSONRPCMessage,
  type McpServer,
} from '@modelcontextprotocol/server';
import { createDataApiClientWith } from '../src/client/dataApiClient';
import { createToolDispatch } from '../src/server/dispatch';
import { createServer } from '../src/server/createServer';
import { SERVER_INSTRUCTIONS } from '../src/server/instructions';
import { CONTENT_TOOL_NAMES, contentToolSpecs, registerContentTools } from '../src/tools/definitions';

/**
 * Protocol compatibility tests (MCP-04): the real `createServer(dispatch,
 * contentToolSpecs())` server speaks over the SDK's own in-memory transport
 * pair, with SDK-default modern/legacy handling. The modern initialize uses
 * the SDK's advertised LATEST_PROTOCOL_VERSION (2.0.0 advertises 2025-11-25;
 * nothing is invented here) and the legacy handshake uses the doc-04 revision
 * 2025-06-18. The representative tool call proves the cache-miss-before-network
 * property (`rebase_required` with the transport spy untouched).
 */

interface JsonRpcReply {
  jsonrpc: '2.0';
  id?: number | string | null;
  result?: unknown;
  error?: { code: number; message: string };
}

interface ToolSummary {
  name: string;
  title?: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  annotations?: Record<string, unknown>;
}

interface InitializeData {
  protocolVersion: string;
  serverInfo: { name: string; version: string };
  instructions?: string;
}

const CONNECTION_ID = '00000000-0000-4000-8000-0000000000c1';
const AGENT_TOKEN = 'A'.repeat(43); // valid 43-char shape; no credential literal (secret scanner)
const LEGACY_VERSION = '2025-06-18';

function makeServer(): { server: McpServer; rpcCalls: string[] } {
  const rpcCalls: string[] = [];
  const client = createDataApiClientWith(async (name) => {
    rpcCalls.push(name);
    throw new Error(`protocol test must not reach the network (${name})`);
  });
  const dispatch = createToolDispatch();
  registerContentTools({ client, connectionId: CONNECTION_ID, agentToken: AGENT_TOKEN }, dispatch);
  return { server: createServer(dispatch, contentToolSpecs()), rpcCalls };
}

/** Minimal in-memory JSON-RPC client speaking through the linked transport pair. */
async function connectClient(server: McpServer) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const pending = new Map<number, (reply: JsonRpcReply) => void>();
  clientTransport.onmessage = (message) => {
    const reply = message as JsonRpcReply;
    const id = typeof reply.id === 'number' ? reply.id : Number(reply.id);
    const resolve = pending.get(id);
    if (resolve) {
      pending.delete(id);
      resolve(reply);
    }
  };
  await server.connect(serverTransport);
  await clientTransport.start();
  let nextId = 1;
  const request = (method: string, params: unknown) =>
    new Promise<JsonRpcReply>((resolve) => {
      const id = nextId++;
      pending.set(id, resolve);
      void clientTransport.send({ jsonrpc: '2.0', id, method, params } as JSONRPCMessage);
    });
  const notify = (method: string): void => {
    void clientTransport.send({ jsonrpc: '2.0', method, params: {} } as JSONRPCMessage);
  };
  const close = async (): Promise<void> => {
    await clientTransport.close();
  };
  return { request, notify, close };
}

interface Connected {
  request: (method: string, params: unknown) => Promise<JsonRpcReply>;
  notify: (method: string) => void;
  close: () => Promise<void>;
}

async function initialize(client: Connected, protocolVersion: string): Promise<InitializeData> {
  const reply = await client.request('initialize', {
    protocolVersion,
    capabilities: {},
    clientInfo: { name: 'bemtevi-compat-test', version: '0.0.0' },
  });
  expect(reply.error).toBeUndefined();
  return reply.result as InitializeData;
}

async function listTools(client: Connected): Promise<ToolSummary[]> {
  const reply = await client.request('tools/list', {});
  expect(reply.error).toBeUndefined();
  return (reply.result as { tools: ToolSummary[] }).tools;
}

describe('modern initialization (SDK-default handling)', () => {
  it('answers the SDK-advertised latest version with a supported version, server identity, and instructions', async () => {
    const { server } = makeServer();
    const client = await connectClient(server);
    try {
      const data = await initialize(client, LATEST_PROTOCOL_VERSION);
      expect(SUPPORTED_PROTOCOL_VERSIONS).toContain(data.protocolVersion);
      expect(data.protocolVersion).toBe(LATEST_PROTOCOL_VERSION);
      expect(data.serverInfo).toEqual({ name: 'bemtevi-content', version: '1.0.0' });
      expect(data.instructions).toBe(SERVER_INSTRUCTIONS);
    } finally {
      await client.close();
    }
  });

  it('serves the exact nine-tool catalog with titles, descriptions, schemas, and annotations', async () => {
    const { server } = makeServer();
    const client = await connectClient(server);
    try {
      await initialize(client, LATEST_PROTOCOL_VERSION);
      client.notify('notifications/initialized');
      const tools = await listTools(client);
      expect(tools.map((tool) => tool.name)).toEqual([...CONTENT_TOOL_NAMES]);
      for (const tool of tools) {
        expect(typeof tool.title).toBe('string');
        expect(tool.title?.length ?? 0).toBeGreaterThan(0);
        expect(typeof tool.description).toBe('string');
        expect(tool.description?.length ?? 0).toBeGreaterThan(0);
        expect(tool.inputSchema?.type).toBe('object');
        expect(tool.annotations?.openWorldHint).toBe(false);
      }
      expect(tools.find((tool) => tool.name === 'list_items')?.annotations).toEqual({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      });
      expect(tools.find((tool) => tool.name === 'apply_operations')?.annotations).toEqual({
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      });
      expect(tools.find((tool) => tool.name === 'prepare_publish')?.annotations).toEqual({
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      });
      expect(tools.find((tool) => tool.name === 'publish_draft')?.annotations).toEqual({
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      });
    } finally {
      await client.close();
    }
  });
});

describe('legacy 2025-06-18 initialization (never disabled)', () => {
  it('completes the legacy handshake and lists the same catalog', async () => {
    const { server } = makeServer();
    const client = await connectClient(server);
    try {
      const data = await initialize(client, LEGACY_VERSION);
      expect(data.protocolVersion).toBe(LEGACY_VERSION);
      expect(data.serverInfo).toEqual({ name: 'bemtevi-content', version: '1.0.0' });
      expect(data.instructions).toBe(SERVER_INSTRUCTIONS);
      const tools = await listTools(client);
      expect(tools.map((tool) => tool.name)).toEqual([...CONTENT_TOOL_NAMES]);
    } finally {
      await client.close();
    }
  });
});

describe('representative tool call through the real transport', () => {
  it('round-trips the rebase_required envelope without any network call', async () => {
    const { server, rpcCalls } = makeServer();
    const client = await connectClient(server);
    try {
      await initialize(client, LATEST_PROTOCOL_VERSION);
      client.notify('notifications/initialized');
      const reply = await client.request('tools/call', {
        name: 'list_items',
        arguments: { generation: 1, scope: 'flows' },
      });
      expect(reply.error).toBeUndefined();
      const result = reply.result as {
        isError: boolean;
        content: Array<{ type: string; text: string }>;
        structuredContent: { ok: boolean; error?: { code: string } };
      };
      expect(result.isError).toBe(true);
      expect(result.structuredContent.ok).toBe(false);
      expect(result.structuredContent.error?.code).toBe('rebase_required');
      expect(JSON.parse(result.content[0]?.text ?? '')).toEqual(result.structuredContent);
      expect(rpcCalls).toEqual([]);
    } finally {
      await client.close();
    }
  });

  it('rejects an unknown tool with a clean JSON-RPC error', async () => {
    const { server } = makeServer();
    const client = await connectClient(server);
    try {
      await initialize(client, LATEST_PROTOCOL_VERSION);
      client.notify('notifications/initialized');
      const reply = await client.request('tools/call', { name: 'definitely_not_a_tool', arguments: {} });
      expect(reply.error?.code).toBe(-32602);
      expect(reply.error?.message).toContain('definitely_not_a_tool');
    } finally {
      await client.close();
    }
  });
});
