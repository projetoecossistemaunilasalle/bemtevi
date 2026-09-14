import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Package manifest/pins/bin contract (doc 04, MCP-01). */
describe('content-mcp package contract', () => {
  const pkg = JSON.parse(readFileSync(path.join(pkgRoot, 'package.json'), 'utf8'));

  it('is the pinned ESM standalone package', () => {
    expect(pkg.name).toBe('@bemtevi/content-mcp');
    expect(pkg.version).toBe('1.0.0');
    expect(pkg.type).toBe('module');
    expect(pkg.engines.node).toBe('>=20');
  });

  it('declares exactly the two runtime dependencies, pinned', () => {
    expect(Object.keys(pkg.dependencies)).toEqual(
      expect.arrayContaining(['@modelcontextprotocol/server', '@neondatabase/neon-js']),
    );
    expect(pkg.dependencies['@modelcontextprotocol/server']).toBe('2.0.0');
    expect(pkg.dependencies['@neondatabase/neon-js']).toBe('0.6.2-beta');
    expect(Object.keys(pkg.dependencies)).toHaveLength(2);
  });

  it('bundles content-core as a workspace devDependency, not runtime', () => {
    expect(pkg.dependencies['@bemtevi/content-core']).toBeUndefined();
    expect(pkg.devDependencies['@bemtevi/content-core']).toBe('workspace:*');
  });

  it('ships only dist and README through the bin', () => {
    expect(pkg.bin).toEqual({ 'bemtevi-content-mcp': 'dist/index.js' });
    expect(pkg.files).toEqual(['dist', 'README.md']);
  });

  it('has a build script producing the bundled entrypoint', () => {
    expect(typeof pkg.scripts.build).toBe('string');
    expect(existsSync(path.join(pkgRoot, 'build.mjs'))).toBe(true);
  });
});
