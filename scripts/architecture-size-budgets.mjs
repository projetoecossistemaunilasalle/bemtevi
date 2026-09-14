/**
 * Architecture gate — size-budget module.
 *
 * Owns the physical-line budgets per file kind and the baseline-growth rule.
 * The global enormous-file threshold lives here so every size error has one
 * source of truth.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { countPhysicalLines, classifyFileKind } from './architecture-file-scanner.mjs';

const BUDGETS = { ts: 300, tsx: 320, test: 500, mjs: 320 };

export const ENORMOUS_FILE_THRESHOLD = 500;

export function loadBaseline(baselinePath) {
  return JSON.parse(readFileSync(baselinePath, 'utf8'));
}

export function checkSizeBudgets(rootDir, baseline, files) {
  const errors = [];
  for (const rel of files) {
    const lines = countPhysicalLines(readFileSync(path.join(rootDir, rel), 'utf8'));
    const kind = classifyFileKind(rel);
    if (!kind) continue;
    if (lines > ENORMOUS_FILE_THRESHOLD) {
      errors.push(`ENORMOUS_FILE ${rel} lines=${lines} threshold=${ENORMOUS_FILE_THRESHOLD}`);
      continue;
    }
    const baselineLimit = baseline[rel.replace(/\\/g, '/')];
    if (baselineLimit !== undefined && baselineLimit > ENORMOUS_FILE_THRESHOLD) {
      errors.push(`ENORMOUS_BASELINE ${rel} baseline=${baselineLimit} threshold=${ENORMOUS_FILE_THRESHOLD}`);
      continue;
    }
    if (baselineLimit === undefined) {
      if (lines > BUDGETS[kind])
        errors.push(`OVER_HARD_LIMIT ${rel} lines=${lines} hard=${BUDGETS[kind]} kind=${kind}`);
    } else if (lines > baselineLimit) {
      errors.push(`BASELINE_GROWTH ${rel} lines=${lines} baseline=${baselineLimit}`);
    }
  }
  return errors;
}
