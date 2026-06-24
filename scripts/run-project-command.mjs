import { spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';

const command = process.argv[2];

const isWindows = process.platform === 'win32' && !process.env.WSL_DISTRO_NAME && !process.env.WSL_INTEROP;
const modulesDir = isWindows ? 'node_modules.win' : 'node_modules.wsl';
const installTarget = isWindows ? 'win' : 'wsl';
const node = process.execPath;

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

function runStep(step) {
  switch (step) {
    case 'typecheck':
      runBin('tsc', ['--noEmit']);
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
    case 'build':
      runBin('vite', ['build']);
      break;
    default:
      fail(`Unknown check step: ${step}`);
  }
}

switch (command) {
  case 'dev':
    runBin('vite', ['--port=3000', '--host=0.0.0.0']);
    break;
  case 'build':
    runBin('vite', ['build']);
    break;
  case 'preview':
    runBin('vite', ['preview']);
    break;
  case 'clean':
    rmSync('dist', { recursive: true, force: true });
    break;
  case 'typecheck':
    runBin('tsc', ['--noEmit']);
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
  case 'test:watch':
    runBin('vitest');
    break;
  case 'validate:flows':
    runBin('tsx', ['scripts/validate-flows.ts']);
    break;
  case 'check':
    ['typecheck', 'lint', 'format:check', 'validate:flows', 'test', 'build'].forEach(runStep);
    break;
  default:
    fail(`Unknown command: ${command || 'none'}`);
}
