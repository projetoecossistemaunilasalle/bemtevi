import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distIndex = path.join(pkgRoot, 'dist', 'index.js');

/**
 * Transport tests (MCP-01): the built entrypoint boots, stdout stays
 * protocol-only (no diagnostics), invalid configuration fails before network,
 * and no credential is leaked in errors.
 */

function validEnv(): NodeJS.ProcessEnv {
  return {
    BEMTEVI_AUTH_URL: 'https://auth.example.com',
    BEMTEVI_DATA_API_URL: 'https://data.example.com',
    BEMTEVI_CONNECTION_ID: '00000000-0000-4000-8000-0000000000c1',
    BEMTEVI_AGENT_TOKEN: 'A'.repeat(43),
    PATH: process.env.PATH ?? '',
  };
}

describe('built entrypoint transport', () => {
  it('dist/index.js exists after build:mcp', () => {
    expect(existsSync(distIndex)).toBe(true);
  });

  it('boots and fails closed on missing configuration before any network call', () => {
    const result = spawnSync(process.execPath, [distIndex], {
      env: { PATH: process.env.PATH ?? '' },
      timeout: 15_000,
      encoding: 'utf8',
    });
    expect(result.status).not.toBe(0);
    // Diagnostic is on stderr only; stdout carries no diagnostics.
    expect(result.stderr).toContain('configuration failed');
    expect(result.stdout).not.toContain('configuration failed');
  });

  it('exposes no credential material in failure diagnostics', () => {
    const token = 'A'.repeat(43);
    const result = spawnSync(process.execPath, [distIndex], {
      env: {
        BEMTEVI_AUTH_URL: 'http://auth.example.com', // invalid: not HTTPS
        BEMTEVI_DATA_API_URL: 'https://data.example.com',
        BEMTEVI_CONNECTION_ID: 'not-a-uuid',
        BEMTEVI_AGENT_TOKEN: token,
        PATH: process.env.PATH ?? '',
      },
      timeout: 15_000,
      encoding: 'utf8',
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).not.toContain(token);
    expect(result.stdout).not.toContain(token);
  });

  it('with valid config, starts and stays quiet on stdout (immediate EOF)', () => {
    const result = spawnSync(process.execPath, [distIndex], {
      env: validEnv(),
      timeout: 15_000,
      encoding: 'utf8',
      input: '',
    });
    // Process may be killed by timeout/EOF handling, but must not emit
    // diagnostics to stdout in any case.
    expect(result.stdout).not.toMatch(/configuration|error|failed/i);
    expect(result.stderr).not.toContain('A'.repeat(43));
  });

  it('has no sourcemap embedding repository source', () => {
    const built = readFileSync(distIndex, 'utf8');
    expect(built).not.toContain('sourcesContent');
    expect(built.startsWith('#!/usr/bin/env node')).toBe(true);
  });
});
