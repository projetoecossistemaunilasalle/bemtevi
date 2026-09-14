import type { Counter, DraftHead } from './drafts';

/**
 * Re-pointed to the canonical reconciliation definitions (MERGE-03). Kept as
 * re-exports so existing `contracts/errors` importers stay unchanged.
 */
export type { ContentPath, PathSegment, SemanticConflict, ValueSlot } from '../content-reconciliation/semanticDiff';
import type { SemanticConflict } from '../content-reconciliation/semanticDiff';

export type ErrorCode =
  | 'unauthorized'
  | 'invalid_capability'
  | 'invalid_input'
  | 'unsupported_schema'
  | 'draft_unavailable'
  | 'published_base_unavailable'
  | 'stale_generation'
  | 'revision_conflict'
  | 'invalid_operations'
  | 'invalid_image'
  | 'payload_too_large'
  | 'validation_failed'
  | 'export_base_unavailable'
  | 'preparation_invalid'
  | 'preparation_expired'
  | 'preparation_stale'
  | 'counter_exhausted'
  | 'rebase_required'
  | 'merge_conflict'
  | 'retry_required'
  | 'rate_limited'
  | 'response_too_large'
  | 'unavailable'
  | 'not_configured';

export interface EditorialError {
  code: ErrorCode;
  currentHead?: DraftHead;
  currentRevision?: Counter;
  conflicts?: SemanticConflict[];
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: EditorialError };
