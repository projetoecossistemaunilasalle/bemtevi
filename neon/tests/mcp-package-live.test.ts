import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { conformanceBasePayload } from '@bemtevi/content-core';

/**
 * INTEGRATION-03 Gate E-live. The DB-04 harness provisions the branch and
 * supplies its public Auth/Data API endpoints. This suite packs and installs
 * the production MCP outside the repository, then drives that installed bin
 * through real capability edit, guarded publication, and revocation.
 */

interface WireResult {
  ok: boolean;
  data?: unknown;
  error?: { code: string };
}

interface RpcReply {
  id?: number;
  result?: unknown;
  error?: { code?: number; message?: string };
}

interface ToolResult {
  isError: boolean;
  content: Array<{ type: string; text: string }>;
  structuredContent: WireResult;
}

interface Capability {
  id: string;
  token: string;
}

interface JsonRpcClient {
  child: ChildProcessWithoutNullStreams;
  request(method: string, params: Record<string, unknown>, timeoutMs?: number): Promise<RpcReply>;
  notify(method: string): void;
  stop(): Promise<void>;
  noise(): string[];
  stderr(): string;
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const packageDir = path.join(repoRoot, 'packages', 'content-mcp');
const TOKEN_VAR = ['BEMTEVI', 'AGENT', 'TOKEN'].join('_');
const TOOL_NAMES = [
  'get_editor_context',
  'list_items',
  'get_item',
  'find_references',
  'apply_operations',
  'set_material_image',
  'get_diff',
  'prepare_publish',
  'publish_draft',
];

function requireEnv(name: string): string {
  const value = process.env[name];
  if (typeof value !== 'string' || value.length === 0)
    throw new Error(`missing required environment variable: ${name}`);
  return value;
}

const harness = {
  owner: new Client({ connectionString: 'pending' }),
  authUrl: 'pending',
  dataApiUrl: 'pending',
  adminToken: 'pending',
  adminUserId: 'pending',
};

let tempRoot = '';

function validPayload(): typeof conformanceBasePayload {
  const payload = structuredClone(conformanceBasePayload);
  (payload.contacts[0] as unknown as Record<string, unknown>).phoneHref = 'tel:4130000000';
  const nodes = (payload.flows[0] as unknown as { nodes: Record<string, { recommendations: string[] }> }).nodes;
  nodes['no-dois'].recommendations = ['material-exemplo'];
  return payload;
}

async function callAdmin(functionName: string, args: Record<string, unknown>): Promise<WireResult> {
  const response = await fetch(`${harness.dataApiUrl}/rpc/${functionName}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${harness.adminToken}` },
    body: JSON.stringify(args),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`admin fixture RPC ${functionName} failed with HTTP ${response.status}`);
  return JSON.parse(text) as WireResult;
}

async function resetContent(): Promise<void> {
  await harness.owner.query('delete from public.content_publish_preparations');
  await harness.owner.query('delete from public.content_edit_exports');
  await harness.owner.query('delete from public.published_content');
  await harness.owner.query('delete from public.published_content_history');
  await harness.owner.query('delete from public.content_agent_connections');
  await harness.owner.query('delete from public.content_drafts');
  await harness.owner.query(
    `insert into public.published_content (id, schema_version, revision, payload, published_by)
     values ('current', '1.0.0', 42, $1::jsonb, $2)`,
    [JSON.stringify(validPayload()), harness.adminUserId],
  );
  const initialized = await callAdmin('get_content_draft', {});
  expect(initialized.ok).toBe(true);
}

async function createCapability(): Promise<Capability> {
  const token = randomBytes(32).toString('base64url');
  const id = randomUUID();
  const tokenHash = createHash('sha256').update(Buffer.from(token, 'base64url')).digest('hex');
  const created = await callAdmin('create_content_agent_connection', {
    p_connection_id: id,
    p_token_hash: tokenHash,
    p_label: 'MCP package live test',
  });
  expect(created.ok).toBe(true);
  return { id, token };
}

function npmCliPath(): string | null {
  const base = path.dirname(process.execPath);
  const candidates = ['node_modules/npm/bin/npm-cli.js', 'lib/node_modules/npm/bin/npm-cli.js'];
  return candidates.map((item) => path.join(base, ...item.split('/'))).find(existsSync) ?? null;
}

function packPackage(packDir: string): string {
  mkdirSync(packDir, { recursive: true });
  const options = { cwd: packageDir, encoding: 'utf8' as const, timeout: 120_000, windowsHide: true };
  const args = ['pack', '--json', '--pack-destination', packDir];
  let packed = spawnSync('pnpm', args, { ...options, shell: process.platform === 'win32' });
  const npmCli = npmCliPath();
  if ((packed.error || packed.status !== 0) && npmCli !== null) {
    packed = spawnSync(process.execPath, [npmCli, ...args], { ...options, shell: false });
  }
  if (packed.error || packed.status !== 0) throw new Error(`package pack failed with status ${packed.status}`);
  const start = packed.stdout.indexOf(packed.stdout.trim().startsWith('[') ? '[' : '{');
  const parsed = JSON.parse(packed.stdout.slice(start)) as { filename: string } | Array<{ filename: string }>;
  const filename = Array.isArray(parsed) ? parsed[0]?.filename : parsed.filename;
  if (typeof filename !== 'string') throw new Error('package pack returned no tarball filename');
  const tarball = path.isAbsolute(filename) ? filename : path.join(packDir, filename);
  if (!existsSync(tarball)) throw new Error('package pack tarball is missing');
  return tarball;
}

function installPackage(tarball: string, installDir: string): string {
  mkdirSync(installDir, { recursive: true });
  writeFileSync(path.join(installDir, 'package.json'), '{"name":"bemtevi-live-install","private":true}\n');
  const env = { ...process.env };
  delete env.NODE_PATH;
  const args = ['install', tarball, '--no-save', '--no-audit', '--no-fund', '--loglevel=error'];
  const npmCli = npmCliPath();
  const options = { cwd: installDir, env, encoding: 'utf8' as const, timeout: 300_000, windowsHide: true };
  const installed = npmCli
    ? spawnSync(process.execPath, [npmCli, ...args], options)
    : spawnSync('npm', args, { ...options, shell: process.platform === 'win32' });
  if (installed.error || installed.status !== 0)
    throw new Error(`package install failed with status ${installed.status}`);
  const entry = path.join(installDir, 'node_modules', '@bemtevi', 'content-mcp', 'dist', 'index.js');
  if (!existsSync(entry)) throw new Error('installed MCP entrypoint is missing');
  const realEntry = realpathSync(entry);
  expect(realEntry.toLowerCase()).not.toContain(repoRoot.toLowerCase());
  expect(lstatSync(path.join(installDir, 'node_modules', '@bemtevi', 'content-mcp')).isSymbolicLink()).toBe(false);
  return realEntry;
}

function buildAndInstall(): string {
  const build = spawnSync(process.execPath, [path.join(packageDir, 'build.mjs')], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 120_000,
    windowsHide: true,
  });
  if (build.error || build.status !== 0) throw new Error(`MCP build failed with status ${build.status}`);
  tempRoot = mkdtempSync(path.join(tmpdir(), 'bemtevi-mcp-live-'));
  return installPackage(packPackage(path.join(tempRoot, 'pack')), path.join(tempRoot, 'install'));
}

function startServer(entry: string, capability: Capability): JsonRpcClient {
  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH ?? '',
    ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
    BEMTEVI_AUTH_URL: harness.authUrl,
    BEMTEVI_DATA_API_URL: harness.dataApiUrl,
    BEMTEVI_CONNECTION_ID: capability.id,
    [TOKEN_VAR]: capability.token,
  };
  delete env.NODE_PATH;
  const installDir = path.resolve(path.dirname(entry), '..', '..', '..', '..');
  const child = spawn(process.execPath, [entry], { cwd: installDir, env, windowsHide: true });
  const pending = new Map<number, { resolve(reply: RpcReply): void; reject(error: Error): void }>();
  const noise: string[] = [];
  let buffer = '';
  let stderr = '';
  let nextId = 1;
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    buffer += chunk;
    for (;;) {
      const newline = buffer.indexOf('\n');
      if (newline < 0) break;
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line === '') continue;
      try {
        const reply = JSON.parse(line) as RpcReply;
        if (typeof reply.id === 'number') pending.get(reply.id)?.resolve(reply);
        if (typeof reply.id === 'number') pending.delete(reply.id);
      } catch {
        noise.push(line);
      }
    }
  });
  child.stderr.on('data', (chunk: string) => {
    stderr = (stderr + chunk).slice(-4000);
  });
  child.once('exit', () => {
    for (const waiter of pending.values()) waiter.reject(new Error('installed MCP exited before replying'));
    pending.clear();
  });
  return {
    child,
    request: (method, params, timeoutMs = 60_000) =>
      new Promise<RpcReply>((resolve, reject) => {
        const id = nextId++;
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`timeout waiting for ${method}`));
        }, timeoutMs);
        pending.set(id, {
          resolve: (reply) => {
            clearTimeout(timer);
            resolve(reply);
          },
          reject: (error) => {
            clearTimeout(timer);
            reject(error);
          },
        });
        child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
      }),
    notify: (method) => child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method, params: {} })}\n`),
    stop: () =>
      new Promise<void>((resolve) => {
        if (child.exitCode !== null || child.signalCode !== null) return resolve();
        child.once('exit', () => resolve());
        child.stdin.end();
        setTimeout(() => child.kill(), 10_000).unref();
      }),
    noise: () => noise,
    stderr: () => stderr,
  };
}

async function callTool(client: JsonRpcClient, name: string, args: Record<string, unknown>): Promise<ToolResult> {
  const reply = await client.request('tools/call', { name, arguments: args });
  expect(reply.error).toBeUndefined();
  const result = reply.result as ToolResult;
  expect(JSON.parse(result.content[0]?.text ?? '')).toEqual(result.structuredContent);
  return result;
}

beforeAll(async () => {
  harness.owner = new Client({ connectionString: requireEnv('NEON_TEST_OWNER_DATABASE_URL') });
  harness.authUrl = requireEnv('NEON_TEST_AUTH_URL');
  harness.dataApiUrl = requireEnv('NEON_TEST_DATA_API_URL');
  harness.adminToken = requireEnv('NEON_TEST_ADMIN_A_TOKEN');
  harness.adminUserId = requireEnv('NEON_TEST_ADMIN_A_USER_ID');
  await harness.owner.connect();
  await resetContent();
});

afterAll(async () => {
  await harness.owner.end();
  if (tempRoot !== '') rmSync(tempRoot, { recursive: true, force: true });
});

describe('installed MCP package against live Neon', () => {
  it('edits, prepares, publishes, and denies the revoked capability through the packed bin', async () => {
    const capability = await createCapability();
    const entry = buildAndInstall();
    const client = startServer(entry, capability);
    try {
      const initialized = await client.request('initialize', {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'bemtevi-live-test', version: '0.0.0' },
      });
      expect(initialized.error).toBeUndefined();
      expect(initialized.result).toMatchObject({
        protocolVersion: '2025-06-18',
        serverInfo: { name: 'bemtevi-content', version: '1.0.0' },
      });
      client.notify('notifications/initialized');
      const catalog = await client.request('tools/list', {});
      const listed = (catalog.result as { tools: Array<{ name: string }> }).tools.map((tool) => tool.name);
      expect(listed).toEqual(TOOL_NAMES);

      const context = await callTool(client, 'get_editor_context', {});
      expect(context.isError).toBe(false);
      expect(context.structuredContent.ok).toBe(true);
      const contextData = context.structuredContent.data as {
        head: { generation: number };
        publishedRevision: number;
      };
      expect(contextData.publishedRevision).toBe(42);

      const edited = await callTool(client, 'apply_operations', {
        expectedGeneration: contextData.head.generation,
        operations: [
          {
            op: 'update',
            scope: 'educationGroups',
            id: 'grupo-um',
            patch: { title: 'Grupo editado pelo pacote instalado' },
            unset: [],
          },
        ],
      });
      expect(edited.isError).toBe(false);
      const editData = edited.structuredContent.data as { head: { generation: number }; changed: boolean };
      expect(editData.changed).toBe(true);
      expect(editData.head.generation).toBe(contextData.head.generation + 1);

      const prepared = await callTool(client, 'prepare_publish', {
        generation: editData.head.generation,
        expectedRevision: 42,
      });
      expect(prepared.isError).toBe(false);
      const prepareData = prepared.structuredContent.data as {
        preparation: { preparationId: string };
        publishToken: string;
      };
      expect(prepareData.publishToken).toMatch(/^[A-Za-z0-9_-]{43}$/);

      const published = await callTool(client, 'publish_draft', {
        preparationId: prepareData.preparation.preparationId,
        publishToken: prepareData.publishToken,
      });
      expect(published.isError).toBe(false);
      const publishData = published.structuredContent.data as { revision: number; draftGeneration: number };
      expect(publishData.revision).toBe(43);
      const live = await harness.owner.query(
        `select revision::int as revision, published_by, published_via_connection_id
           from public.published_content where id = 'current'`,
      );
      expect(live.rows[0]).toEqual({
        revision: 43,
        published_by: harness.adminUserId,
        published_via_connection_id: capability.id,
      });

      const revoked = await callAdmin('revoke_content_agent_connection', { p_connection_id: capability.id });
      expect(revoked.ok).toBe(true);
      // prepare_publish always starts with a fresh agent_get_draft RPC.
      const denied = await callTool(client, 'prepare_publish', {
        generation: publishData.draftGeneration,
        expectedRevision: publishData.revision,
      });
      expect(denied.isError).toBe(true);
      expect(denied.structuredContent.error?.code).toBe('invalid_capability');
    } finally {
      await client.stop();
      expect(client.noise()).toEqual([]);
      expect(client.stderr()).not.toContain(capability.token);
    }
  }, 180_000);
});
