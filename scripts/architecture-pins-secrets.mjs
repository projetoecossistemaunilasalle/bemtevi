/**
 * Architecture gate — package pins, secrets and MCP metafile module.
 *
 * Owns the frozen manifest pins (MCP package, root packageManager, dev pins),
 * the credential-leak scanner for agent tokens, and the bundled-artifact
 * metafile runtime check.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const SECRET_VALUE = /["']([A-Za-z0-9_-]{16,})["']/;
const PLACEHOLDER = /(placeholder|example|your[_-]?token|test[_-]?token|fake[_-]?token|changeme|xxxx)/i;
const ROOT_DEV_PINS = { esbuild: '0.25.12', neon: '4.14.6', pg: '8.16.3', '@types/pg': '8.15.5' };

function isLooseRange(range) {
  const s = String(range);
  return s.includes('workspace:') || s === 'latest' || s === '*' || /^(>=|\^|~)/.test(s);
}

export function checkPackagePins(rootDir) {
  const errors = [];
  const mcpPkgPath = path.join(rootDir, 'packages/content-mcp/package.json');
  if (existsSync(mcpPkgPath)) {
    const pkg = JSON.parse(readFileSync(mcpPkgPath, 'utf8'));
    if (pkg.name !== '@bemtevi/content-mcp') errors.push(`PIN_DRIFT content-mcp name=${pkg.name}`);
    if (pkg.version !== '1.0.0') errors.push(`PIN_DRIFT content-mcp version=${pkg.version}`);
    const srv = pkg.dependencies?.['@modelcontextprotocol/server'];
    if (srv !== '2.0.0') errors.push(`PIN_DRIFT @modelcontextprotocol/server=${srv}`);
    const neon = pkg.dependencies?.['@neondatabase/neon-js'];
    if (neon !== '0.6.2-beta') errors.push(`PIN_DRIFT @neondatabase/neon-js=${neon}`);
    for (const [name, range] of Object.entries(pkg.dependencies ?? {})) {
      if (isLooseRange(range))
        errors.push(`RUNTIME_WORKSPACE_OR_RANGE_DEP packages/content-mcp dependencies.${name}=${range}`);
    }
    if (pkg.devDependencies?.['@bemtevi/content-core'] !== 'workspace:*') {
      errors.push('PIN_DRIFT content-core should be bundled workspace:* devDependency');
    }
  }
  const rootPkg = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  if (rootPkg.packageManager !== 'pnpm@10.14.0') errors.push(`PIN_DRIFT packageManager=${rootPkg.packageManager}`);
  for (const [name, expected] of Object.entries(ROOT_DEV_PINS)) {
    if (rootPkg.devDependencies?.[name] !== expected) {
      errors.push(`PIN_DRIFT devDependency ${name}=${rootPkg.devDependencies?.[name]} expected=${expected}`);
    }
  }
  return errors;
}

export function scanSecrets(rootDir, files) {
  const errors = [];
  for (const rel of files) {
    const abs = path.join(rootDir, rel);
    if (!existsSync(abs)) continue;
    for (const line of readFileSync(abs, 'utf8').split(/\r?\n/)) {
      if (!/BEMTEVI_AGENT_TOKEN/.test(line)) continue;
      const value = (line.match(SECRET_VALUE) ?? line.match(/BEMTEVI_AGENT_TOKEN=([A-Za-z0-9_-]{16,})/))?.[1];
      if (value && !PLACEHOLDER.test(value) && !/^\$\{?[A-Z0-9_]+\}?$/.test(value)) {
        errors.push(`SECRET_LEAK ${rel} contains a non-placeholder BEMTEVI_AGENT_TOKEN value`);
        break;
      }
    }
  }
  return errors;
}

/** Conditional: only when the MCP build emits dist/meta.json. */
export function checkMcpMetafile(rootDir) {
  const metaPath = path.join(rootDir, 'packages/content-mcp/dist/meta.json');
  if (!existsSync(metaPath)) return [];
  let meta;
  try {
    meta = JSON.parse(readFileSync(metaPath, 'utf8'));
  } catch {
    return ['MCP_METAFILE_UNREADABLE packages/content-mcp/dist/meta.json'];
  }
  const allowedRuntime = new Set(['@modelcontextprotocol/server', '@neondatabase/neon-js']);
  const errors = [];
  for (const key of Object.keys(meta.inputs ?? {})) {
    const posix = key.replace(/\\/g, '/');
    if (posix.includes('/packages/content-core/') || posix.includes('/packages/content-mcp/')) continue;
    if (posix.includes('/src/') && !posix.includes('/packages/')) {
      errors.push(`MCP_METAFILE_REPO_SOURCE ${key}`);
      continue;
    }
    const match = posix.match(/node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?((?:@[^/]+\/)?[^/]+)/);
    const pkgName = match?.[1];
    if (
      pkgName &&
      !allowedRuntime.has(pkgName) &&
      !pkgName.startsWith('@bemtevi/content-core') &&
      !pkgName.startsWith('@types/')
    ) {
      errors.push(`MCP_METAFILE_UNDECLARED_RUNTIME ${pkgName}`);
    }
  }
  return errors;
}
