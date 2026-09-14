// Semantic compare/reconcile for published content. Implementation is split
// into focused modules; this hub preserves the original public surface.
export { assertComparable, compareContent } from './compare';
export { describePath } from './describePath';
export { reconcileContent } from './merge';
export { contentIdentity } from './types';
export type {
  ComparisonResult,
  ConflictDecisions,
  ContentPath,
  PathSegment,
  SemanticChange,
  SemanticConflict,
  SemanticMerge,
  ValueSlot,
} from './types';
