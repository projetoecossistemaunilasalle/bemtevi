import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  countPhysicalLines,
  classifyFileKind,
  findForbiddenImports,
  checkSizeBudgets,
  checkPackagePins,
  scanSecrets,
  collectSecretScanFiles,
  runArchitectureCheck,
  ENORMOUS_FILE_THRESHOLD,
  collectSourceFiles,
  loadBaseline,
} from '../check-architecture.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const temps: string[] = [];

function makeTempRoot(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'bemtevi-arch-'));
  temps.push(dir);
  return dir;
}

function writeValidRootPkg(root: string, overrides: Record<string, unknown> = {}) {
  writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({
      packageManager: 'pnpm@10.14.0',
      devDependencies: {
        esbuild: '0.25.12',
        neon: '4.14.6',
        pg: '8.16.3',
        '@types/pg': '8.15.5',
      },
      ...overrides,
    }),
  );
}

function writeValidMcpPkg(root: string, overrides: Record<string, unknown> = {}) {
  mkdirSync(path.join(root, 'packages/content-mcp'), { recursive: true });
  writeFileSync(
    path.join(root, 'packages/content-mcp/package.json'),
    JSON.stringify({
      name: '@bemtevi/content-mcp',
      version: '1.0.0',
      dependencies: {
        '@modelcontextprotocol/server': '2.0.0',
        '@neondatabase/neon-js': '0.6.2-beta',
      },
      devDependencies: { '@bemtevi/content-core': 'workspace:*' },
      ...overrides,
    }),
  );
}

afterEach(() => {
  while (temps.length) {
    const dir = temps.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe('countPhysicalLines', () => {
  it('treats CRLF and LF identically and ignores one terminal newline', () => {
    expect(countPhysicalLines('')).toBe(0);
    expect(countPhysicalLines('\n')).toBe(0);
    expect(countPhysicalLines('a')).toBe(1);
    expect(countPhysicalLines('a\n')).toBe(1);
    expect(countPhysicalLines('a\nb')).toBe(2);
    expect(countPhysicalLines('a\r\nb\r\n')).toBe(2);
    expect(countPhysicalLines('a\n\nb')).toBe(3);
  });
});

describe('classifyFileKind', () => {
  it('maps production, component, test and tooling files', () => {
    expect(classifyFileKind('src/app/foo.ts')).toBe('ts');
    expect(classifyFileKind('src/app/Foo.tsx')).toBe('tsx');
    expect(classifyFileKind('src/app/__tests__/foo.test.ts')).toBe('test');
    expect(classifyFileKind('src/app/foo.test.tsx')).toBe('test');
    expect(classifyFileKind('scripts/check-architecture.mjs')).toBe('mjs');
    expect(classifyFileKind('src/app/foo.css')).toBeNull();
  });
});

describe('findForbiddenImports', () => {
  it('flags core importing app, react, node and MCP packages', () => {
    const v = findForbiddenImports('packages/content-core/src/index.ts', [
      'react',
      'node:fs',
      'src/domain/content/types',
      '@modelcontextprotocol/server',
      '@bemtevi/content-mcp',
    ]);
    expect(v.map((x) => x.rule)).toContain('core-forbidden-import');
  });

  it('flags MCP importing repo source, child_process and fs', () => {
    const v = findForbiddenImports('packages/content-mcp/src/server/index.ts', [
      '../../src/dev-dashboard/drafts',
      'child_process',
      'scripts/content-agent/server',
      'fs',
      'node:fs',
    ]);
    expect(v.length).toBeGreaterThanOrEqual(5);
  });

  it('flags frontend importing MCP internals and agent-bridge', () => {
    const v = findForbiddenImports('src/dev-dashboard/DashboardRoute.tsx', [
      '@bemtevi/content-mcp/src/tools/apply',
      'scripts/agent-bridge/server',
    ]);
    expect(v.map((x) => x.rule)).toEqual(['frontend-forbidden-import', 'frontend-forbidden-import']);
  });

  it('rejects computed imports in core/MCP production source', () => {
    const v = findForbiddenImports('packages/content-core/src/index.ts', [], true);
    expect(v[0]?.rule).toBe('computed-import-rejected');
  });

  it('flags generated corpus imports from core', () => {
    const v = findForbiddenImports('packages/content-core/src/index.ts', [
      '../../src/content/generated/published-content.snapshot.json',
    ]);
    expect(v[0]?.rule).toBe('core-forbidden-import');
  });
});

describe('checkSizeBudgets', () => {
  it('fails a new oversized file', () => {
    const root = makeTempRoot();
    const rel = 'src/new-oversized.ts';
    const abs = path.join(root, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, `${'x\n'.repeat(301)}`);
    const errors = checkSizeBudgets(root, {}, [rel]);
    expect(errors.some((e) => e.includes('OVER_HARD_LIMIT') && e.includes(rel))).toBe(true);
  });

  it('fails baseline growth and allows shrink', () => {
    const root = makeTempRoot();
    const rel = 'src/app/content/publishedContent.ts';
    const abs = path.join(root, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    const baseline = { [rel]: 10 };
    writeFileSync(abs, `${'x\n'.repeat(11)}`);
    expect(checkSizeBudgets(root, baseline, [rel])[0]).toContain('BASELINE_GROWTH');
    writeFileSync(abs, `${'x\n'.repeat(9)}`);
    expect(checkSizeBudgets(root, baseline, [rel])).toEqual([]);
  });
});

describe('checkPackagePins', () => {
  it('fails package pin drift and runtime workspace deps', () => {
    const root = makeTempRoot();
    writeValidMcpPkg(root, {
      version: '1.0.1',
      dependencies: {
        '@modelcontextprotocol/server': 'latest',
        '@bemtevi/content-core': 'workspace:*',
      },
      devDependencies: {},
    });
    writeValidRootPkg(root, { packageManager: 'pnpm@9.0.0' });
    const errors = checkPackagePins(root);
    expect(errors.some((e) => e.includes('content-mcp version'))).toBe(true);
    expect(errors.some((e) => e.includes('@modelcontextprotocol/server'))).toBe(true);
    expect(errors.some((e) => e.includes('RUNTIME_WORKSPACE'))).toBe(true);
    expect(errors.some((e) => e.includes('packageManager'))).toBe(true);
  });

  it('accepts the frozen V2 pins', () => {
    expect(checkPackagePins(repoRoot)).toEqual([]);
  });
});

describe('scanSecrets', () => {
  it('fails non-placeholder agent tokens and ignores tagged fakes', () => {
    const root = makeTempRoot();
    mkdirSync(path.join(root, 'src'), { recursive: true });
    const key = ['BEMTEVI', 'AGENT', 'TOKEN'].join('_');
    writeFileSync(path.join(root, 'src/leak.ts'), `const t = "${key}=abcdefghijklmnop1234";\n`);
    writeFileSync(path.join(root, 'src/fake.ts'), `const t = "${key}=test-fake-token-aaaaaaaaaaaa";\n`);
    const errors = scanSecrets(root, ['src/leak.ts', 'src/fake.ts']);
    expect(errors.some((e) => e.includes('src/leak.ts'))).toBe(true);
    expect(errors.some((e) => e.includes('src/fake.ts'))).toBe(false);
  });

  it('includes json config fixtures in the production secret scan set', () => {
    const root = makeTempRoot();
    mkdirSync(path.join(root, 'packages/content-mcp'), { recursive: true });
    writeFileSync(path.join(root, 'packages/content-mcp/bemtevi-mcp.json'), '{}');
    const files = collectSecretScanFiles(root);
    expect(files.some((f) => f.replace(/\\/g, '/').includes('bemtevi-mcp.json'))).toBe(true);
  });
});

describe('runArchitectureCheck', () => {
  it('ignores generated outputs and dist trees', () => {
    const root = makeTempRoot();
    mkdirSync(path.join(root, 'src/content/generated'), { recursive: true });
    mkdirSync(path.join(root, 'scripts'), { recursive: true });
    mkdirSync(path.join(root, 'dist'), { recursive: true });
    writeFileSync(path.join(root, 'src/content/generated/generated-corpus.ts'), `${'x\n'.repeat(400)}`);
    writeFileSync(path.join(root, 'dist/bundle.js'), `${'x\n'.repeat(400)}`);
    writeFileSync(path.join(root, 'scripts/architecture-baseline.json'), '{}');
    writeValidRootPkg(root);
    writeValidMcpPkg(root);
    const result = runArchitectureCheck(root);
    expect(result.files.some((f) => f.includes('generated-corpus'))).toBe(false);
    expect(result.ok).toBe(true);
  });
});

describe('enormous file prevention', () => {
  it('rejects files exceeding ENORMOUS_FILE_THRESHOLD (500 lines) even when listed in baseline', () => {
    const root = makeTempRoot();
    const rel = 'src/enormous.ts';
    const abs = path.join(root, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, `${'x\n'.repeat(501)}`);
    const errors = checkSizeBudgets(root, { [rel]: 1000 }, [rel]);
    expect(errors.some((e) => e.includes('ENORMOUS_FILE') && e.includes(rel))).toBe(true);
  });

  it('rejects baseline entries exceeding the ENORMOUS_FILE_THRESHOLD', () => {
    const root = makeTempRoot();
    const rel = 'src/some-file.ts';
    const abs = path.join(root, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, `${'x\n'.repeat(300)}`);
    const errors = checkSizeBudgets(root, { [rel]: 600 }, [rel]);
    expect(errors.some((e) => e.includes('ENORMOUS_BASELINE') && e.includes(rel))).toBe(true);
  });

  it('explicitly guarantees that no enormous file (> 500 physical lines) exists anywhere in the repository', () => {
    const files = collectSourceFiles(repoRoot);
    const oversized: Array<{ file: string; lines: number }> = [];
    for (const file of files) {
      const content = readFileSync(path.join(repoRoot, file), 'utf8');
      const lines = countPhysicalLines(content);
      if (lines > ENORMOUS_FILE_THRESHOLD) {
        oversized.push({ file, lines });
      }
    }
    expect(oversized).toEqual([]);
  });

  it('explicitly guarantees that no baseline entry in architecture-baseline.json exceeds the enormous threshold', () => {
    const baseline = loadBaseline(path.join(repoRoot, 'scripts/architecture-baseline.json'));
    const invalidEntries = Object.entries(baseline).filter(([, limit]) => Number(limit) > ENORMOUS_FILE_THRESHOLD);
    expect(invalidEntries).toEqual([]);
  });

  it('explicitly verifies that the entire repository passes the architecture gate with zero errors', () => {
    const result = runArchitectureCheck(repoRoot);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });
});
