/**
 * Architecture rule: the Prettier line-suppression pragma is banned in production source.
 *
 * History: the pragma was used to pack code onto fewer physical lines and evade the
 * size budgets that the architecture gate enforces. The gate counts physical lines,
 * so a suppression pragma is a budget-bypass tool, not a formatting tool.
 *
 * Enforcement:
 * - Any production file (ts/tsx/mjs; tests excluded) containing the pragma that is
 *   NOT in `PRAGMA_ALLOWLIST` fails with `PRETTIER_IGNORE_BANNED`.
 * - An allowlisted file fails with `PRETTIER_IGNORE_GREW` if its count exceeds the
 *   frozen limit below.
 * - Only this detector's own regex is allowlisted; production source has no
 *   grandfathered suppression pragmas.
 *
 * This module is itself allowlisted (limit 1) because its detection regex contains
 * the token exactly once — that is the rule's own machinery, not a suppression.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const PRAGMA_PATTERN = /prettier-ignore/g;

export const PRAGMA_ALLOWLIST = new Set(['scripts/architecture-pragma-ban.mjs']);

/** The detector's regex is the only permitted occurrence. */
export const PRAGMA_LIMITS = {
  'scripts/architecture-pragma-ban.mjs': 1,
};

export function countPrettierIgnores(source) {
  const matches = source.match(PRAGMA_PATTERN);
  return matches ? matches.length : 0;
}

export function isTestFile(posixPath) {
  return posixPath.endsWith('.test.ts') || posixPath.endsWith('.test.tsx') || posixPath.includes('/__tests__/');
}

export function checkPragmaBan(rootDir, files) {
  const errors = [];
  for (const rel of files) {
    const posix = rel.replace(/\\/g, '/');
    if (isTestFile(posix)) continue;
    const count = countPrettierIgnores(readFileSync(path.join(rootDir, rel), 'utf8'));
    if (count === 0) continue;
    if (!PRAGMA_ALLOWLIST.has(posix)) {
      errors.push(`PRETTIER_IGNORE_BANNED ${rel} occurrences=${count} (pragma is banned in production source)`);
    } else if (count > PRAGMA_LIMITS[posix]) {
      errors.push(
        `PRETTIER_IGNORE_GREW ${rel} occurrences=${count} allowlisted=${PRAGMA_LIMITS[posix]} (counts may only shrink until zero)`,
      );
    }
  }
  return errors;
}
