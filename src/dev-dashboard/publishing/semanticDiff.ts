// Thin compatibility facade (MERGE-03). The canonical implementation lives in
// `@bemtevi/content-core` (`content-reconciliation/semanticDiff.ts`); export
// names, conflict IDs and fingerprints are preserved unchanged.
export {
  assertComparable,
  compareContent,
  contentIdentity,
  describePath,
  reconcileContent,
} from '@bemtevi/content-core';
export type {
  ComparisonResult,
  ConflictDecisions,
  ContentPath,
  JsonValue,
  PathSegment,
  SemanticChange,
  SemanticConflict,
  SemanticMerge,
  ValueSlot,
} from '@bemtevi/content-core';
