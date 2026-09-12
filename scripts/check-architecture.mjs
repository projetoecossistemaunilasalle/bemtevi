#!/usr/bin/env node
/** Architecture gate: size budgets, baseline growth, forbidden imports, pins, secrets. */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isWindows = process.platform === 'win32' && !process.env.WSL_DISTRO_NAME && !process.env.WSL_INTEROP;
const modulesDir = isWindows
  ? 'node_modules.win'
  : existsSync(path.join(root, 'node_modules.wsl'))
    ? 'node_modules.wsl'
    : 'node_modules';
const ts = require(path.join(root, modulesDir, 'typescript', 'lib', 'typescript.js'));
const BUDGETS = { ts: 300, tsx: 320, test: 500, mjs: 320 };
export const ENORMOUS_FILE_THRESHOLD = 1000;
const SCAN_ROOTS = ['src', 'scripts', 'packages', 'neon/tests'];
// prettier-ignore
const IGNORE_DIRS = new Set(['node_modules', 'node_modules.win', 'node_modules.wsl', '.worktrees', 'dist', 'coverage', '.git']);
// prettier-ignore
const CORE_FORBIDDEN = 'src|packages/content-mcp|react|react-dom|@neondatabase|@modelcontextprotocol|@bemtevi/content-mcp|node'.split('|');
// prettier-ignore
const MCP_FORBIDDEN = 'src|../src|../../src|scripts/content-agent|../scripts/content-agent|../../scripts/content-agent|scripts/agent-bridge|../scripts/agent-bridge|../../scripts/agent-bridge|src/dev-dashboard|child_process|node:child_process|fs|node:fs|git|node:git'.split('|');
// prettier-ignore
const FRONTEND_FORBIDDEN = '@bemtevi/content-mcp|packages/content-mcp|../packages/content-mcp|scripts/content-agent|../scripts/content-agent|scripts/agent-bridge|../scripts/agent-bridge'.split('|');
const SECRET_VALUE = /["']([A-Za-z0-9_-]{16,})["']/;
const PLACEHOLDER = /(placeholder|example|your[_-]?token|test[_-]?token|fake[_-]?token|changeme|xxxx)/i;
const ROOT_DEV_PINS = { esbuild: '0.25.12', neon: '4.14.6', pg: '8.16.3', '@types/pg': '8.15.5' };

export function countPhysicalLines(source) {
  if (source === '') return 0;
  const n = source.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const t = n.endsWith('\n') ? n.slice(0, -1) : n;
  return t === '' ? 0 : t.split('\n').length;
}

export function classifyFileKind(relPath) {
  const base = path.basename(relPath);
  if (/\.test\.(ts|tsx|mts|cts)$/i.test(base) || relPath.replace(/\\/g, '/').includes('/__tests__/')) return 'test';
  if (/\.mjs$/i.test(base)) return 'mjs';
  if (/\.tsx$/i.test(base)) return 'tsx';
  if (/\.(ts|mts|cts)$/i.test(base)) return 'ts';
  return null;
}

function isIgnoredPath(relPath) {
  const posix = relPath.replace(/\\/g, '/');
  const parts = posix.split('/');
  const base = parts[parts.length - 1] ?? '';
  if (parts.some((p) => IGNORE_DIRS.has(p))) return true;
  if (/^generated-/.test(base) || /\.d\.ts$/i.test(base)) return true;
  if (posix.startsWith('src/content/generated/') || parts.includes('migrations')) return true;
  if (/pnpm-lock\.yaml$|package-lock\.json$|yarn\.lock$/i.test(base)) return true;
  return /\.(md|mdx|txt|json|png|jpe?g|webp|gif|svg|mp3|mp4|webmanifest)$/i.test(base);
}

function isSecretCandidate(relPath) {
  return /\.(ts|tsx|mjs|js|json|yml|yaml|env|example)$/i.test(relPath) || relPath.includes('config');
}

function walk(abs, rootDir, found, predicate) {
  const st = statSync(abs, { throwIfNoEntry: false });
  if (!st) return;
  if (st.isDirectory()) {
    for (const entry of readdirSync(abs)) walk(path.join(abs, entry), rootDir, found, predicate);
    return;
  }
  const rel = path.relative(rootDir, abs);
  if (predicate(rel)) found.push(rel);
}

function collectWith(rootDir, predicate) {
  const found = [];
  for (const scan of SCAN_ROOTS) {
    const abs = path.join(rootDir, scan);
    if (existsSync(abs)) walk(abs, rootDir, found, predicate);
  }
  return found.sort();
}

export function collectSourceFiles(rootDir) {
  return collectWith(rootDir, (rel) => !isIgnoredPath(rel) && classifyFileKind(rel) !== null);
}

/** Config fixtures are ignored for size/import budgets but must still be secret-scanned. */
export function collectSecretScanFiles(rootDir) {
  return collectWith(rootDir, (rel) => {
    if (
      rel
        .replace(/\\/g, '/')
        .split('/')
        .some((p) => IGNORE_DIRS.has(p))
    )
      return false;
    if (/pnpm-lock\.yaml$|package-lock\.json$|yarn\.lock$/i.test(rel)) return false;
    return isSecretCandidate(rel);
  });
}

function extractImports(source, fileName) {
  const scriptKind = fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.ES2022, true, scriptKind);
  const specs = [];
  let hasComputed = false;
  const visit = (node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specs.push(node.moduleSpecifier.text);
    } else if (ts.isCallExpression(node)) {
      const arg = node.arguments[0];
      const expr = node.expression;
      const isImport = expr.kind === ts.SyntaxKind.ImportKeyword;
      const name = ts.isIdentifier(expr) ? expr.text : ts.isPropertyAccessExpression(expr) ? expr.getText() : '';
      const isRequireLike = isImport || name === 'require' || name.endsWith('require');
      if (isRequireLike && arg && !ts.isStringLiteral(arg) && !ts.isNoSubstitutionTemplateLiteral(arg))
        hasComputed = true;
      else if (arg && ts.isStringLiteral(arg) && isRequireLike) specs.push(arg.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return { specs, hasComputed };
}

function matchesPrefix(spec, prefix) {
  const p = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
  return spec === p || spec.startsWith(`${p}/`) || spec.startsWith(`${p}\\`);
}

function matchesAny(spec, list) {
  return list.some((prefix) => matchesPrefix(spec, prefix) || (!prefix.includes('/') && spec.startsWith(`${prefix}:`)));
}

function isGeneratedCorpus(spec) {
  return [
    'src/content/generated/',
    '../src/content/generated/',
    '../../src/content/generated/',
    '../../../src/content/generated/',
  ].some((p) => matchesPrefix(spec, p));
}

export function findForbiddenImports(relPath, specifiers, hasComputed = false) {
  const posix = relPath.replace(/\\/g, '/');
  const isCore = posix.startsWith('packages/content-core/');
  const isMcp = posix.startsWith('packages/content-mcp/');
  const isFrontend = posix.startsWith('src/') && !posix.startsWith('src/content/generated/');
  const isRuntime = !/\.test\.|\/__tests__\//.test(posix) && !posix.endsWith('.mjs');
  const violations = [];
  if ((isCore || isMcp) && isRuntime && hasComputed) {
    violations.push({ file: relPath, specifier: '<computed>', rule: 'computed-import-rejected' });
  }
  for (const spec of specifiers) {
    if (isCore && isRuntime && (matchesAny(spec, CORE_FORBIDDEN) || isGeneratedCorpus(spec))) {
      violations.push({ file: relPath, specifier: spec, rule: 'core-forbidden-import' });
    }
    if (isMcp && isRuntime && (matchesAny(spec, MCP_FORBIDDEN) || isGeneratedCorpus(spec))) {
      violations.push({ file: relPath, specifier: spec, rule: 'mcp-forbidden-import' });
    }
    if (isFrontend && isRuntime && matchesAny(spec, FRONTEND_FORBIDDEN)) {
      violations.push({ file: relPath, specifier: spec, rule: 'frontend-forbidden-import' });
    }
  }
  return violations;
}

export function loadBaseline(baselinePath) {
  return JSON.parse(readFileSync(baselinePath, 'utf8'));
}

export function checkSizeBudgets(rootDir, baseline, files) {
  const errors = [];
  for (const rel of files) {
    const lines = countPhysicalLines(readFileSync(path.join(rootDir, rel), 'utf8'));
    const kind = classifyFileKind(rel);
    if (!kind) continue;
    if (lines > ENORMOUS_FILE_THRESHOLD) {
      errors.push(`ENORMOUS_FILE ${rel} lines=${lines} threshold=${ENORMOUS_FILE_THRESHOLD}`);
      continue;
    }
    const baselineLimit = baseline[rel.replace(/\\/g, '/')];
    if (baselineLimit !== undefined && baselineLimit > ENORMOUS_FILE_THRESHOLD) {
      errors.push(`ENORMOUS_BASELINE ${rel} baseline=${baselineLimit} threshold=${ENORMOUS_FILE_THRESHOLD}`);
      continue;
    }
    if (baselineLimit === undefined) {
      if (lines > BUDGETS[kind])
        errors.push(`OVER_HARD_LIMIT ${rel} lines=${lines} hard=${BUDGETS[kind]} kind=${kind}`);
    } else if (lines > baselineLimit) {
      errors.push(`BASELINE_GROWTH ${rel} lines=${lines} baseline=${baselineLimit}`);
    }
  }
  return errors;
}

export function checkImports(rootDir, files) {
  const errors = [];
  for (const rel of files) {
    const { specs, hasComputed } = extractImports(readFileSync(path.join(rootDir, rel), 'utf8'), rel);
    for (const v of findForbiddenImports(rel, specs, hasComputed)) {
      errors.push(`FORBIDDEN_IMPORT ${v.file} imports '${v.specifier}' (${v.rule})`);
    }
  }
  return errors;
}

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

/** Conditional: only when MCP-01 emits dist/meta.json. */
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

export function runArchitectureCheck(rootDir = root, options = {}) {
  const baselinePath = options.baselinePath ?? path.join(rootDir, 'scripts/architecture-baseline.json');
  const baseline = loadBaseline(baselinePath);
  const files = collectSourceFiles(rootDir);
  const errors = [
    ...checkSizeBudgets(rootDir, baseline, files),
    ...checkImports(rootDir, files),
    ...checkPackagePins(rootDir),
    ...scanSecrets(rootDir, collectSecretScanFiles(rootDir)),
    ...checkMcpMetafile(rootDir),
  ];
  return { files, errors, ok: errors.length === 0 };
}

const isDirectRun = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isDirectRun) {
  const result = runArchitectureCheck(root);
  if (!result.ok) {
    result.errors.forEach((err) => console.error(err));
    console.error(`Architecture check failed with ${result.errors.length} error(s).`);
    process.exit(1);
  }
  console.log(`Architecture check passed (${result.files.length} source files).`);
}
