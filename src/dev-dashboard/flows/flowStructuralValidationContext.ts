// Compatibility facade: canonical implementation lives in @bemtevi/content-core
// (validation/flowStructuralValidationContext).
export {
  createFlowValidationContext,
  isRecord,
  stringify,
  hasTextValue,
  nodeId,
  findNode,
  findNodeWithMissingId,
  nodePath,
  findOption,
  findOptionByIndex,
  optionPath,
  effectPath,
  findVideo,
  findVisual,
  findBranch,
  findBranchByIndex,
  countPreviousOccurrences,
} from '@bemtevi/content-core';
export type {
  UnknownRecord,
  FlowValidationContext,
  NodeMatch,
  OptionMatch,
  IndexedRecord,
} from '@bemtevi/content-core';
