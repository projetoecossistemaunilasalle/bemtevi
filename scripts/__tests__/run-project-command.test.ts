import { describe, expect, it } from 'vitest';
import {
  buildVitestRunArgs,
  resolveInstallTarget,
  resolveModulesDir,
  mcpSuiteReady,
  hasMcpBuildScript,
} from '../run-project-command.mjs';

describe('resolveModulesDir', () => {
  it('uses node_modules.win on native Windows', () => {
    expect(resolveModulesDir({}, 'win32', () => false)).toBe('node_modules.win');
  });

  it('prefers node_modules.wsl when WSL install exists', () => {
    const exists = (p: string) => p === 'node_modules.wsl';
    expect(resolveModulesDir({ WSL_DISTRO_NAME: 'Ubuntu' }, 'linux', exists)).toBe('node_modules.wsl');
  });

  it('falls back to node_modules when no WSL dual-install is present', () => {
    expect(resolveModulesDir({}, 'linux', () => false)).toBe('node_modules');
  });

  it('treats win32 with WSL env as non-native Windows', () => {
    const exists = (p: string) => p === 'node_modules.wsl';
    expect(resolveModulesDir({ WSL_DISTRO_NAME: 'Ubuntu' }, 'win32', exists)).toBe('node_modules.wsl');
  });
});

describe('resolveInstallTarget', () => {
  it('maps modules dirs to install script targets', () => {
    expect(resolveInstallTarget('node_modules.win')).toBe('win');
    expect(resolveInstallTarget('node_modules.wsl')).toBe('wsl');
    expect(resolveInstallTarget('node_modules')).toBe('default');
  });
});

describe('bin path construction', () => {
  it('derives tool bins from the resolved modulesDir', () => {
    expect(`${resolveModulesDir({}, 'win32', () => false)}/vitest/vitest.mjs`).toBe(
      'node_modules.win/vitest/vitest.mjs',
    );
    expect(
      `${resolveModulesDir({ WSL_DISTRO_NAME: 'Ubuntu' }, 'linux', (p) => p === 'node_modules.wsl')}/typescript/bin/tsc`,
    ).toBe('node_modules.wsl/typescript/bin/tsc');
    expect(`${resolveModulesDir({}, 'linux', () => false)}/eslint/bin/eslint.js`).toBe(
      'node_modules/eslint/bin/eslint.js',
    );
  });
});

describe('buildVitestRunArgs', () => {
  it('forwards trailing filters after run', () => {
    expect(buildVitestRunArgs([])).toEqual(['run']);
    expect(buildVitestRunArgs(['scripts/__tests__/check-architecture.test.ts'])).toEqual([
      'run',
      'scripts/__tests__/check-architecture.test.ts',
    ]);
    expect(buildVitestRunArgs(['src/foo.test.ts', '--reporter=dot'])).toEqual([
      'run',
      'src/foo.test.ts',
      '--reporter=dot',
    ]);
  });
});

describe('MCP gate readiness', () => {
  it('does not claim MCP suite/build before MCP-01 artifacts exist', () => {
    expect(mcpSuiteReady(() => false)).toBe(false);
    expect(hasMcpBuildScript(() => false)).toBe(false);
  });
});
