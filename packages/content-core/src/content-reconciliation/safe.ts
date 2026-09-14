import { assertComparable } from './compare';
import type { ComparisonResult } from './types';

// Validates every input structurally before running the callback, mapping
// validation failures to `invalid_input` and callback failures to
// `comparison_failed` (never throws).
export function compareSafe<T>(inputs: unknown[], run: () => T): ComparisonResult<T> {
  try {
    inputs.forEach(assertComparable);
  } catch {
    return { ok: false, code: 'invalid_input' };
  }
  try {
    return { ok: true, value: run() };
  } catch {
    return { ok: false, code: 'comparison_failed' };
  }
}
