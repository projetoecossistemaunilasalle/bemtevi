import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const command = process.argv[2];
const passthroughArgs = process.argv.slice(3);
const node = process.execPath;

export function resolveModulesDir(env = process.env, platform = process.platform, exists = existsSync) {
  const win = platform === 'win32' && !env.WSL_DISTRO_NAME && !env.WSL_INTEROP;
  if (win) return 'node_modules.win';
  // Align with install:wsl (node_modules.wsl) before falling back to a default install.
  if (exists('node_modules.wsl')) return 'node_modules.wsl';
  return 'node_modules';
}

export function resolveInstallTarget(modulesDir) {
  if (modulesDir === 'node_modules.win') return 'win';
  if (modulesDir === 'node_modules.wsl') return 'wsl';
  return 'default';
}

export function buildVitestRunArgs(trailingArgs = []) {
  return ['run', ...trailingArgs];
}

export function hasMcpPackageTests(exists = existsSync) {
  return exists('packages/content-mcp/vitest.config.ts');
}

export function hasMcpBuildScript(exists = existsSync) {
  return exists('packages/content-mcp/build.mjs');
}

function countTestFiles(dir) {
  let count = 0;
  const walk = (abs) => {
    const st = statSync(abs, { throwIfNoEntry: false });
    if (!st) return;
    if (st.isDirectory()) {
      for (const entry of readdirSync(abs)) walk(`${abs}/${entry}`);
      return;
    }
    if (/\.test\.(ts|tsx|mts|cts|mjs|js)$/.test(abs)) count += 1;
  };
  walk(dir);
  return count;
}

export function mcpSuiteReady(exists = existsSync) {
  return hasMcpPackageTests(exists) && countTestFiles('packages/content-mcp') > 0;
}

const modulesDir = resolveModulesDir(process.env, process.platform, existsSync);
const installTarget = resolveInstallTarget(modulesDir);

const bins = {
  vite: `${modulesDir}/vite/bin/vite.js`,
  tsc: `${modulesDir}/typescript/bin/tsc`,
  eslint: `${modulesDir}/eslint/bin/eslint.js`,
  prettier: `${modulesDir}/prettier/bin/prettier.cjs`,
  tsx: `${modulesDir}/tsx/dist/cli.mjs`,
  vitest: `${modulesDir}/vitest/vitest.mjs`,
};

function fail(message) {
  console.error(message);
  process.exit(1);
}

function runBin(name, args = []) {
  const bin = bins[name];

  if (!bin || !existsSync(bin)) {
    fail(`Missing ${modulesDir} install. Run "pnpm run install:${installTarget}" first.`);
  }

  const result = spawnSync(node, [bin, ...args], {
    stdio: 'inherit',
    shell: false,
  });

  if (result.error) {
    fail(result.error.message);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runNodeFile(relativePath, args = []) {
  if (!existsSync(relativePath)) {
    fail(`Missing script: ${relativePath}`);
  }

  const result = spawnSync(node, [relativePath, ...args], {
    stdio: 'inherit',
    shell: false,
  });

  if (result.error) {
    fail(result.error.message);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runMcpTests(args = []) {
  if (!hasMcpPackageTests()) {
    fail('test:mcp requires packages/content-mcp/vitest.config.ts (landed with MCP-01).');
  }
  runBin('vitest', ['run', '--config', 'packages/content-mcp/vitest.config.ts', ...args]);
}

function runStep(step) {
  switch (step) {
    case 'typecheck':
      runBin('tsc', ['--noEmit']);
      if (existsSync('packages/content-core/tsconfig.json')) {
        runBin('tsc', ['-p', 'packages/content-core/tsconfig.json']);
      }
      if (existsSync('packages/content-mcp/src/index.ts')) {
        runBin('tsc', ['-p', 'packages/content-mcp/tsconfig.json']);
      }
      break;
    case 'lint':
      runBin('eslint', ['.']);
      break;
    case 'format:check':
      runBin('prettier', ['--check', '.']);
      break;
    case 'validate:flows':
      runBin('tsx', ['scripts/validate-flows.ts']);
      break;
    case 'test':
      runBin('vitest', ['run']);
      break;
    case 'test:mcp':
      runMcpTests();
      break;
    case 'check:architecture':
      runNodeFile('scripts/check-architecture.mjs');
      break;
    case 'build':
      runBin('vite', ['build']);
      break;
    case 'build:mcp':
      if (!hasMcpBuildScript()) {
        fail('build:mcp is not available until MCP-01 lands (packages/content-mcp/build.mjs).');
      }
      runNodeFile('packages/content-mcp/build.mjs');
      break;
    case 'check:db':
      if (!existsSync('neon/tests/run.ts')) {
        fail(
          'check:db requires the Neon live harness (neon/tests/run.ts) from DB-04 and credentials. Missing harness is an external gate, not a skip.',
        );
      }
      runBin('tsx', ['neon/tests/run.ts']);
      break;
    case 'check:mcp-package':
      if (!existsSync('packages/content-mcp/scripts/tarball-smoke.mjs')) {
        fail(
          'check:mcp-package requires packages/content-mcp/scripts/tarball-smoke.mjs from MCP-04. Missing package smoke is an external gate, not a skip.',
        );
      }
      runNodeFile('packages/content-mcp/scripts/tarball-smoke.mjs');
      break;
    case 'content-agent:mcp':
      runBin('tsx', ['scripts/content-agent/server.ts']);
      break;
    case 'content-agent:sync':
      runBin('tsx', ['scripts/content-agent/syncServer.ts']);
      break;
    case 'content-agent:login':
      runBin('tsx', ['scripts/content-agent/authCli.ts', 'login']);
      break;
    case 'content-agent:logout':
      runBin('tsx', ['scripts/content-agent/authCli.ts', 'logout']);
      break;
    default:
      fail(`Unknown check step: ${step}`);
  }
}

function runCli(cmd, args = []) {
  switch (cmd) {
    case 'dev':
      runBin('vite', ['--port=3000', '--host=0.0.0.0']);
      break;
    case 'build':
      runBin('vite', ['build']);
      break;
    case 'build:mcp':
      runStep('build:mcp');
      break;
    case 'preview':
      runBin('vite', ['preview']);
      break;
    case 'clean':
      rmSync('dist', { recursive: true, force: true });
      break;
    case 'typecheck':
      runStep('typecheck');
      break;
    case 'lint':
      runBin('eslint', ['.']);
      break;
    case 'format':
      runBin('prettier', ['--write', '.']);
      break;
    case 'format:check':
      runBin('prettier', ['--check', '.']);
      break;
    case 'test':
      runBin('vitest', ['run']);
      break;
    case 'test:unit':
      runBin('vitest', buildVitestRunArgs(args));
      break;
    case 'test:watch':
      runBin('vitest');
      break;
    case 'test:mcp':
      runMcpTests(args);
      break;
    case 'validate:flows':
      runBin('tsx', ['scripts/validate-flows.ts']);
      break;
    case 'content:pull':
      runBin('tsx', ['scripts/content-pull.ts']);
      break;
    case 'content-agent:mcp':
      runBin('tsx', ['scripts/content-agent/server.ts']);
      break;
    case 'content-agent:sync':
      runBin('tsx', ['scripts/content-agent/syncServer.ts']);
      break;
    case 'content-agent:login':
      runBin('tsx', ['scripts/content-agent/authCli.ts', 'login']);
      break;
    case 'content-agent:logout':
      runBin('tsx', ['scripts/content-agent/authCli.ts', 'logout']);
      break;
    case 'check:architecture':
      runStep('check:architecture');
      break;
    case 'check:db':
      runStep('check:db');
      break;
    case 'check:mcp-package':
      runStep('check:mcp-package');
      break;
    case 'check': {
      const steps = ['typecheck', 'lint', 'format:check', 'validate:flows', 'test', 'check:architecture', 'build'];
      if (mcpSuiteReady()) {
        steps.push('test:mcp');
      }
      if (hasMcpBuildScript()) {
        steps.push('build:mcp');
      }
      steps.forEach(runStep);
      break;
    }
    default:
      fail(`Unknown command: ${cmd || 'none'}`);
  }
}

const isDirectRun = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isDirectRun) {
  runCli(command, passthroughArgs);
}
