/**
 * Architecture gate — file discovery module.
 *
 * Owns everything about *which* files the gate scans and how their lines are
 * counted: physical-line counting, file-kind classification, directory walk,
 * source-file collection and the secret-scan candidate set. No rule logic.
 */
import { readdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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

const SCAN_ROOTS = ['src', 'scripts', 'packages', 'neon/tests'];
const IGNORE_DIRS = new Set([
  'node_modules',
  'node_modules.win',
  'node_modules.wsl',
  '.worktrees',
  'dist',
  'coverage',
  '.git',
]);

/** Resolved TypeScript compiler API from the platform-correct modules directory. */
export function getTypescript() {
  return ts;
}

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

export function isTestFile(posixPath) {
  return posixPath.endsWith('.test.ts') || posixPath.endsWith('.test.tsx') || posixPath.includes('/__tests__/');
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
