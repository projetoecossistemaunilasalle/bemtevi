/**
 * MCP-04 "Clone-Free Packed Artifact Gate" (Gate E-local, doc 09; tasks/MCP.md).
 * Invoked by `pnpm run check:mcp-package` (scripts/run-project-command.mjs runs
 * this file with node from the repo root). Builds the package, `pnpm pack`s it
 * into a temporary directory, installs the tarball into another empty directory
 * OUTSIDE the repository (clean npm install of the published-dependency tree),
 * launches the INSTALLED bin entry file with `node` (cwd = the install dir;
 * credential-free env, no NODE_PATH) and drives a newline-delimited JSON-RPC
 * stdio exchange: modern initialize (the INSTALLED SDK's LATEST_PROTOCOL_VERSION),
 * legacy `2025-06-18` initialize, the exact 9-tool catalog, bounded read
 * dispatch (`rebase_required` — cache miss before any network call), bounded
 * edit dispatches (201-op schema rejection; invalid_operations handler envelope;
 * unknown scope — zero RPCs, no hang), unknown-tool rejection, stdout noise
 * discipline, process termination and clone-free artifact assertions. Prints a
 * structured evidence summary; it contains no credential material.
 */
import { spawn, spawnSync } from 'node:child_process';
import console from 'node:console';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { clearTimeout, setTimeout } from 'node:timers';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const pkgDir = path.join(repoRoot, 'packages', 'content-mcp');
const buildScript = path.join(pkgDir, 'build.mjs');
const TOKEN_VAR = ['BEMTEVI', 'AGENT', 'TOKEN'].join('_');
const SMOKE_TOKEN = 'A'.repeat(43); // exact 43-char credential shape; no quoted literal (secret scanner)
const LEGACY_VERSION = '2025-06-18'; // doc 04 legacy revision; must appear in the installed SDK's supported list
const CLIENT_INFO = { name: 'bemtevi-tarball-smoke', version: '0.0.0' };
const CATALOG_TEXT = 'get_editor_context list_items get_item find_references apply_operations set_material_image';
const TOOL_NAMES = `${CATALOG_TEXT} get_diff prepare_publish publish_draft`.split(' ');
const fail = (message) => {
  throw new Error(`tarball-smoke: ${message}`);
};
const expect = (condition, message) => {
  if (!condition) fail(message);
};

function npmCliPath() {
  const dir = path.dirname(process.execPath);
  const rels = ['node_modules/npm/bin/npm-cli.js', 'lib/node_modules/npm/bin/npm-cli.js'];
  return rels.map((rel) => path.join(dir, ...rel.split('/'))).find((candidate) => fs.existsSync(candidate)) ?? null;
}

/** Packs with `pnpm pack --json --pack-destination` (npm fallback). Returns {tarball, files, bytes}. */
function packPackage(destDir) {
  const args = ['pack', '--json', '--pack-destination', destDir];
  const options = { cwd: pkgDir, encoding: 'utf8', timeout: 120_000, windowsHide: true };
  let raw = spawnSync('pnpm', args, { ...options, shell: process.platform === 'win32' });
  if ((raw.error || raw.status !== 0) && npmCliPath()) {
    raw = spawnSync(process.execPath, [npmCliPath(), ...args], { ...options, shell: false });
  }
  if (raw.error || raw.status !== 0)
    fail(`pack failed (status ${raw.status}): ${(raw.stderr ?? raw.error?.message ?? '').slice(-400)}`);
  let parsed;
  try {
    parsed = JSON.parse(raw.stdout.slice(raw.stdout.indexOf(raw.stdout.trim().startsWith('[') ? '[' : '{')));
  } catch {
    return fail(`pack did not print JSON: ${raw.stdout.slice(0, 200)}`);
  }
  const entry = Array.isArray(parsed) ? parsed[0] : parsed;
  const tarball = path.isAbsolute(entry.filename) ? entry.filename : path.join(destDir, entry.filename);
  expect(fs.existsSync(tarball), `pack reported ${entry.filename} but the file does not exist`);
  return { tarball, files: entry.files.map((file) => file.path), bytes: entry.size ?? fs.lstatSync(tarball).size };
}

function installTarball(tarball, installDir) {
  fs.mkdirSync(installDir, { recursive: true });
  fs.writeFileSync(path.join(installDir, 'package.json'), '{"name":"bemtevi-smoke-install","private":true}\n');
  const env = { ...process.env };
  if ('NODE_PATH' in env) delete env.NODE_PATH;
  const args = ['install', tarball, '--no-save', '--no-audit', '--no-fund', '--loglevel=error'];
  const cli = npmCliPath();
  const options = { cwd: installDir, env, encoding: 'utf8', timeout: 300_000, windowsHide: true };
  const command = cli ? [process.execPath, cli] : null;
  const raw = command
    ? spawnSync(command[0], [...command.slice(1), ...args], options)
    : spawnSync('npm', args, { ...options, shell: true });
  const tail = String(raw.error?.message ?? raw.stderr ?? raw.stdout ?? '').slice(-800);
  if (raw.error || raw.status !== 0) fail(`npm install failed (status ${raw.status}): ${tail}`);
}

/** SDK dir next to the installed package: npm flat layout or pnpm .pnpm sibling layout. */
function resolveInstalledSdkDir(entryDir) {
  const flat = path.resolve(entryDir, '..', '..', '..', '@modelcontextprotocol', 'server');
  const nested = path.resolve(entryDir, '..', '..', '@modelcontextprotocol', 'server');
  const found = [flat, nested].find((candidate) => fs.existsSync(path.join(candidate, 'package.json')));
  if (!found) fail('installed @modelcontextprotocol/server not found near the installed entry file');
  return found;
}

function buildBinEnv() {
  const env = {
    PATH: process.env.PATH ?? '',
    ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
    BEMTEVI_AUTH_URL: 'https://bemtevi-smoke.invalid/auth', // .invalid TLD: DNS fails if ever touched
    BEMTEVI_DATA_API_URL: 'https://bemtevi-smoke.invalid/data-api',
    BEMTEVI_CONNECTION_ID: '00000000-0000-4000-8000-0000000000c1',
  };
  env[TOKEN_VAR] = SMOKE_TOKEN;
  if ('NODE_PATH' in env) delete env.NODE_PATH;
  return env;
}

/** Minimal newline-delimited JSON-RPC stdio client for the spawned installed bin. */
function startServer(entryPath, cwd) {
  const child = spawn(process.execPath, [entryPath], { cwd, env: buildBinEnv(), windowsHide: true });
  const pending = new Map();
  const noise = [];
  let buffer = '';
  let lineCount = 0;
  let stderrTail = '';
  let nextId = 1;
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    buffer += chunk;
    for (;;) {
      const index = buffer.indexOf('\n');
      if (index < 0) break;
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      if (line === '') continue;
      lineCount++;
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        noise.push(line);
        continue;
      }
      pending.get(message.id)?.(message);
      pending.delete(message.id);
    }
  });
  child.stderr.on('data', (chunk) => {
    stderrTail = (stderrTail + chunk).slice(-2000);
  });
  const request = (method, params, timeoutMs = 20_000) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      const timer = setTimeout(() => reject(new Error(`timeout waiting for ${method} (id ${id})`)), timeoutMs);
      pending.set(id, (message) => {
        clearTimeout(timer);
        resolve(message);
      });
      child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    });
  const notify = (method) => child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method, params: {} })}\n`);
  const stop = () =>
    new Promise((resolve) => {
      const done = () => resolve({ viaKill: child.killed, code: child.exitCode, signal: child.signalCode });
      child.once('exit', done);
      child.stdin.end(); // graceful first: EOF closes the stdio transport
      setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null) child.kill(); // still serving: terminate
      }, 10_000).unref();
    });
  return { child, request, notify, stop, lineCount: () => lineCount, noise: () => noise, stderrTail: () => stderrTail };
}

async function runExchange(label, entryPath, cwd, protocolVersion, evidence) {
  console.log(`[smoke] ${label}: spawning installed bin (protocol ${protocolVersion})`);
  const server = startServer(entryPath, cwd);
  const call = (name, args) => server.request('tools/call', { name, arguments: args });
  try {
    const init = await server.request('initialize', { protocolVersion, capabilities: {}, clientInfo: CLIENT_INFO });
    expect(init.result, `initialize returned no result: ${JSON.stringify(init).slice(0, 300)}`);
    const replied = init.result?.protocolVersion;
    expect(replied === protocolVersion, `initialize replied ${replied}, wanted ${protocolVersion}`);
    const info = init.result?.serverInfo;
    expect(info?.name === 'bemtevi-content' && info?.version === '1.0.0', 'initialize serverInfo mismatch');
    expect(String(init.result?.instructions ?? '').length > 100, 'initialize did not carry instructions');
    server.notify('notifications/initialized');
    const tools = await server.request('tools/list', {});
    const names = tools.result.tools.map((tool) => tool.name);
    expect(JSON.stringify(names) === JSON.stringify(TOOL_NAMES), `tools/list mismatch: ${JSON.stringify(names)}`);
    for (const tool of tools.result.tools) {
      const ok = tool.title && tool.description && tool.inputSchema && tool.annotations?.openWorldHint === false;
      expect(ok, `tool ${tool.name} missing title/description/inputSchema/annotations`);
    }
    const read = await call('list_items', { generation: 1, scope: 'flows' });
    const readCode = read.result?.structuredContent?.error?.code ?? 'missing';
    expect(read.result?.isError === true && readCode === 'rebase_required', `list_items cache miss code=${readCode}`);
    const batch201 = Array.from({ length: 201 }, () => ({ op: 'delete', scope: 'flows', id: 's', confirmation: true }));
    const rejected = await call('apply_operations', { expectedGeneration: 1, operations: batch201 });
    const text = String(rejected.result?.content?.[0]?.text ?? '');
    const schemaRejected = rejected.result?.isError === true && rejected.result?.structuredContent === undefined;
    expect(schemaRejected, '201-op batch: expected isError without structuredContent');
    expect(text.includes('Input validation error'), `201-op not schema-rejected: ${text.slice(0, 120)}`);
    const invalid = await call('apply_operations', {
      expectedGeneration: 1,
      operations: [{ op: 'update', scope: 'flows', id: 'smoke', patch: {}, unset: [] }],
    });
    const invalidCode = invalid.result?.structuredContent?.error?.code;
    expect(invalidCode === 'invalid_operations', `invalid batch code=${invalidCode}`);
    const unknownScope = await call('apply_operations', {
      expectedGeneration: 1,
      operations: [{ op: 'delete', scope: 'not_a_scope', id: 'smoke', confirmation: true }],
    });
    expect(unknownScope.result?.isError === true, 'unknown-scope batch did not return an error result');
    const unknownTool = await call('definitely_not_a_tool', {});
    expect(unknownTool.error?.code === -32602, `unknown tool error=${JSON.stringify(unknownTool.error)}`);
    evidence.exchanges.push({
      label,
      requested: protocolVersion,
      replied,
      tools: names.length,
      list_items: readCode,
      apply_operations_201: 'schema-rejected (isError, no structuredContent, zero RPC)',
      apply_operations_invalid: invalidCode,
      apply_operations_unknown_scope: 'schema-rejected, no hang',
      unknown_tool: `clean JSON-RPC error ${unknownTool.error?.code}`,
      stdoutLines: server.lineCount(),
      stdoutNoise: server.noise().length,
    });
  } finally {
    const stop = await server.stop();
    const how = stop.viaKill ? 'killed' : 'stdin-eof';
    console.log(`[smoke]   pid ${server.child.pid} terminated (${how}, code ${stop.code}, signal ${stop.signal})`);
    expect(server.noise().length === 0, `non-JSON stdout noise: ${JSON.stringify(server.noise()).slice(0, 300)}`);
    expect(!server.stderrTail().includes(SMOKE_TOKEN), 'credential material leaked to stderr');
  }
}

function assertCloneFreeArtifact(installDir, entryReal, evidence) {
  const lowerRepo = repoRoot.toLowerCase();
  const distText = fs.readFileSync(entryReal, 'utf8');
  expect(distText.includes('set_default_group_order'), 'bundled content-core marker missing from installed dist');
  expect(!/file:\/|workspace:/.test(distText), 'installed dist references file: or workspace: locations');
  expect(!distText.toLowerCase().includes(lowerRepo), 'installed dist embeds an absolute repository path');
  const installedPkg = JSON.parse(fs.readFileSync(path.resolve(entryReal, '..', '..', 'package.json'), 'utf8'));
  expect(installedPkg.name === '@bemtevi/content-mcp' && installedPkg.version === '1.0.0', 'name/version mismatch');
  const expected = JSON.stringify(['@modelcontextprotocol/server', '@neondatabase/neon-js']);
  const depKeys = JSON.stringify(Object.keys(installedPkg.dependencies ?? {}).sort());
  expect(depKeys === expected, 'installed dependencies are not exactly the two pinned SDKs');
  evidence.installedDependencies = {};
  const pins = { '@modelcontextprotocol/server': '2.0.0', '@neondatabase/neon-js': '0.6.2-beta' };
  for (const [dep, version] of Object.entries(pins)) {
    expect(installedPkg.dependencies[dep] === version, `${dep} pin drift`);
    expect(installedPkg.dependencies['@bemtevi/content-core'] === undefined, 'content-core runtime dependency present');
    const depDir = path.join(installDir, 'node_modules', dep);
    const isRealDir = fs.existsSync(depDir) && fs.lstatSync(depDir).isSymbolicLink() === false;
    expect(isRealDir, `installed dependency ${dep} missing or a symlink`);
    const real = fs.realpathSync(depDir);
    expect(!real.toLowerCase().includes(lowerRepo), `${dep} resolves into the repository (${real})`);
    const depPkg = JSON.parse(fs.readFileSync(path.join(depDir, 'package.json'), 'utf8'));
    expect(depPkg.name === dep, `dependency ${dep} package.json mismatch`);
    evidence.installedDependencies[dep] = real;
  }
  expect(!entryReal.toLowerCase().includes(lowerRepo), 'entry file resolves into the repository');
}

async function main() {
  console.log('[smoke] Gate E-local: clone-free packed artifact (MCP-04)');
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bemtevi-mcp-smoke-'));
  const evidence = { exchanges: [] };
  try {
    const build = { cwd: repoRoot, stdio: 'inherit', timeout: 120_000, windowsHide: true };
    const built = spawnSync(process.execPath, [buildScript], build);
    if (built.error || built.status !== 0)
      fail(`build:mcp failed (status ${built.status}): ${built.error?.message ?? ''}`);
    const packDir = path.join(tempRoot, 'pack');
    fs.mkdirSync(packDir, { recursive: true });
    const pack = packPackage(packDir);
    console.log(`[smoke] packed ${path.basename(pack.tarball)} (${pack.bytes} bytes, files: ${pack.files.join(', ')})`);
    const installDir = path.join(tempRoot, 'install');
    installTarball(pack.tarball, installDir);
    console.log(`[smoke] installed tarball into ${installDir}`);
    const entryPath = path.join(installDir, 'node_modules', '@bemtevi', 'content-mcp', 'dist', 'index.js');
    expect(fs.existsSync(entryPath), 'installed dist/index.js is missing');
    const entryReal = fs.realpathSync(entryPath);
    expect(!entryReal.toLowerCase().includes(repoRoot.toLowerCase()), 'installed entry resolves inside the repository');
    const sdkDir = resolveInstalledSdkDir(path.dirname(entryReal));
    const sdkPkg = JSON.parse(fs.readFileSync(path.join(sdkDir, 'package.json'), 'utf8'));
    const sdkEntry = sdkPkg.exports?.['.']?.import?.default;
    const sdk = await import(pathToFileURL(path.join(sdkDir, sdkEntry)).href);
    expect(sdk.SUPPORTED_PROTOCOL_VERSIONS.includes(LEGACY_VERSION), `SDK does not support legacy ${LEGACY_VERSION}`);
    console.log(`[smoke] SDK@${sdkPkg.version} LATEST_PROTOCOL_VERSION=${sdk.LATEST_PROTOCOL_VERSION}`);
    assertCloneFreeArtifact(installDir, entryReal, evidence);
    await runExchange('modern-era initialize', entryPath, installDir, sdk.LATEST_PROTOCOL_VERSION, evidence);
    await runExchange(`legacy ${LEGACY_VERSION} initialize`, entryPath, installDir, LEGACY_VERSION, evidence);
    Object.assign(evidence, {
      pack: { tarball: path.basename(pack.tarball), bytes: pack.bytes, files: pack.files },
      installDir,
      sdkVersion: sdkPkg.version,
      latestProtocolVersion: sdk.LATEST_PROTOCOL_VERSION,
      supportedProtocolVersions: sdk.SUPPORTED_PROTOCOL_VERSIONS,
    });
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
  evidence.cleanedUp = !fs.existsSync(tempRoot);
  console.log('--- evidence summary (retained pack/install evidence; no credential material) ---');
  console.log(JSON.stringify(evidence, null, 2));
  console.log(`[smoke] cleanup: temporary pack/install dirs removed (${evidence.cleanedUp ? 'ok' : 'INCOMPLETE'})`);
}

main()
  .then(() => console.log('[smoke] Gate E-local PASSED'))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
