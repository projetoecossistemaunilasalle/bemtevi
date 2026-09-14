import { afterAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distIndex = path.join(pkgRoot, 'dist', 'index.js');
const distMeta = path.join(pkgRoot, 'dist', 'meta.json');

/**
 * Standalone-package tests (MCP-04): the npm manifest/bin/node-version/version
 * pin contract and the packed tarball inventory (real `pnpm pack` into a
 * temporary directory; the tarball must ship only the built dist + README and
 * never repository sources or node_modules).
 */

interface PackedManifest {
  name: string;
  version: string;
  type?: string;
  bin: Record<string, string>;
  files?: string[];
  engines?: { node?: string };
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface PackedTarball {
  name: string;
  version: string;
  filename: string;
  files: Array<{ path: string }>;
}

describe('npm manifest contract', () => {
  const manifest = JSON.parse(readFileSync(path.join(pkgRoot, 'package.json'), 'utf8')) as PackedManifest;

  it('is the frozen standalone package @bemtevi/content-mcp@1.0.0', () => {
    expect(manifest.name).toBe('@bemtevi/content-mcp');
    expect(manifest.version).toBe('1.0.0');
    expect(manifest.type).toBe('module');
    expect(manifest.engines?.node).toBe('>=20');
  });

  it('exposes the bin entry bemtevi-content-mcp -> dist/index.js', () => {
    expect(manifest.bin).toEqual({ 'bemtevi-content-mcp': 'dist/index.js' });
  });

  it('ships only dist and README via the files allowlist', () => {
    expect(manifest.files).toEqual(['dist', 'README.md']);
  });

  it('pins the two public runtime dependencies exactly', () => {
    expect(manifest.dependencies).toEqual({
      '@modelcontextprotocol/server': '2.0.0',
      '@neondatabase/neon-js': '0.6.2-beta',
    });
  });

  it('keeps runtime dependencies free of workspace/range/latest specifiers', () => {
    for (const range of Object.values(manifest.dependencies ?? {})) {
      expect(range).not.toContain('workspace:');
      expect(['latest', '*']).not.toContain(range);
      expect(range.startsWith('^') || range.startsWith('~') || range.startsWith('>=')).toBe(false);
    }
  });

  it('bundles @bemtevi/content-core as a workspace devDependency, never a runtime dependency', () => {
    expect(manifest.dependencies?.['@bemtevi/content-core']).toBeUndefined();
    expect(manifest.devDependencies?.['@bemtevi/content-core']).toBe('workspace:*');
  });
});

describe('build artifacts', () => {
  it('has built dist/index.js and dist/meta.json (pnpm run build:mcp)', () => {
    expect(existsSync(distIndex)).toBe(true);
    expect(existsSync(distMeta)).toBe(true);
  });

  it('starts dist/index.js with the executable shebang', () => {
    expect(readFileSync(distIndex, 'utf8').split('\n')[0]).toBe('#!/usr/bin/env node');
  });
});

describe('tarball inventory (real pnpm pack into a temporary directory)', () => {
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'bemtevi-mcp-standalone-'));
  const packed = (() => {
    const args = ['pack', '--json', '--pack-destination', tempRoot];
    // pnpm.cmd requires a shell on Windows; plain executable resolution on POSIX.
    const raw = spawnSync('pnpm', args, {
      cwd: pkgRoot,
      encoding: 'utf8',
      timeout: 120_000,
      windowsHide: true,
      shell: process.platform === 'win32',
    });
    if (raw.error || raw.status !== 0) {
      throw new Error(`pnpm pack failed (status ${raw.status}): ${String(raw.stderr ?? raw.error).slice(-400)}`);
    }
    const start = raw.stdout.indexOf('{');
    return JSON.parse(raw.stdout.slice(start)) as PackedTarball;
  })();

  afterAll(() => {
    rmSync(tempRoot, { recursive: true, force: true });
  });

  it('packs the frozen package identity', () => {
    expect(packed.name).toBe('@bemtevi/content-mcp');
    expect(packed.version).toBe('1.0.0');
    expect(path.basename(packed.filename)).toBe('bemtevi-content-mcp-1.0.0.tgz');
  });

  it('ships exactly the built dist, README.md, and package.json', () => {
    const paths = packed.files.map((file) => file.path).sort();
    expect(paths).toEqual(['README.md', 'dist/index.js', 'dist/meta.json', 'package.json']);
  });

  it('writes the tarball file into the requested destination', () => {
    expect(existsSync(path.isAbsolute(packed.filename) ? packed.filename : path.join(tempRoot, packed.filename))).toBe(
      true,
    );
  });

  it('never contains repository source files (src/**)', () => {
    for (const file of packed.files) {
      expect(file.path.startsWith('src/') || file.path.includes('/src/')).toBe(false);
    }
  });

  it('never contains node_modules content', () => {
    for (const file of packed.files) {
      expect(file.path.includes('node_modules')).toBe(false);
    }
  });
});
