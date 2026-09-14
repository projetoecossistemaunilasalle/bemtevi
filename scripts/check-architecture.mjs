#!/usr/bin/env node
/**
 * Architecture gate — orchestrator.
 *
 * Composes the focused rule modules (file discovery, import boundaries, size
 * budgets, pins/secrets/metafile, pragma ban) into the single gate invoked by
 * `pnpm run check:architecture`. Each rule lives in its own module; this file
 * owns only composition and the CLI entry point. Public exports are preserved
 * for the test suite (`scripts/__tests__/check-architecture.test.ts`).
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { collectSourceFiles, collectSecretScanFiles } from './architecture-file-scanner.mjs';
import { checkImports } from './architecture-import-boundaries.mjs';
import { loadBaseline, checkSizeBudgets } from './architecture-size-budgets.mjs';
import { checkPackagePins, scanSecrets, checkMcpMetafile } from './architecture-pins-secrets.mjs';
import { checkPragmaBan } from './architecture-pragma-ban.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export {
  countPhysicalLines,
  classifyFileKind,
  collectSourceFiles,
  collectSecretScanFiles,
} from './architecture-file-scanner.mjs';
export { findForbiddenImports, checkImports } from './architecture-import-boundaries.mjs';
export { loadBaseline, checkSizeBudgets, ENORMOUS_FILE_THRESHOLD } from './architecture-size-budgets.mjs';
export { checkPackagePins, scanSecrets, checkMcpMetafile } from './architecture-pins-secrets.mjs';
export { checkPragmaBan, countPrettierIgnores, PRAGMA_ALLOWLIST, PRAGMA_LIMITS } from './architecture-pragma-ban.mjs';

export function runArchitectureCheck(rootDir = root, options = {}) {
  const baselinePath = options.baselinePath ?? path.join(rootDir, 'scripts/architecture-baseline.json');
  const baseline = loadBaseline(baselinePath);
  const files = collectSourceFiles(rootDir);
  const errors = [
    ...checkSizeBudgets(rootDir, baseline, files),
    ...checkImports(rootDir, files),
    ...checkPragmaBan(rootDir, files),
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
