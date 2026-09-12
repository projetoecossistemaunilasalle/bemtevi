/**
 * Public mutation boundary for guided flows.
 *
 * Keep callers on this stable module while the mutation families remain
 * cohesive and independently testable.
 */
export {
  applyTerminalEffect,
  connectSource,
  type AddNodeConnectFrom,
  type ConnectionSource,
  type TerminalDestination,
} from './flowMutationConnections';

export {
  addNode,
  deleteNode,
  duplicateNode,
  switchNodeKind,
  type AddNodeInput,
  type BrokenLink,
  type SwitchKindInput,
} from './flowMutationNodes';

export { addBranch, addOption, uniqueBranchId, uniqueOptionId } from './flowMutationOptions';

export {
  moveNode,
  setEntryNode,
  updateFlowSettings,
  type FlowSettingsPatch,
  type MoveDirection,
} from './flowMutationSettings';
