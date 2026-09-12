import type { FlowEffect, FlowNode, GuidedFlow } from '../../domain/flow-engine/types';

/** A transition kind is deliberately structural, not a semantic route category. */
export type FlowTopologyTransitionKind =
  | 'normal'
  | 'free_text'
  | 'score'
  | 'score_branch'
  | 'flow_start'
  | 'navigate'
  | 'safety_interrupt'
  | 'deferred_safety'
  | 'end_flow';

export type FlowTopologyDestinationKind =
  | 'result'
  | 'navigate'
  | 'safety_interrupt'
  | 'deferred_safety'
  | 'flow_start'
  | 'end_flow'
  | 'missing_node'
  | 'missing_flow';

export interface FlowTopologyScoreAnnotation {
  scoreKey: string;
  value: number;
}

export interface FlowTopologyScoreRange {
  id: string;
  min: number;
  max: number;
  label: string;
}

export interface FlowTopologyDestination {
  /** Stable within the topology. Result IDs are the original node IDs. */
  id: string;
  key: string;
  kind: FlowTopologyDestinationKind;
  label: string;
  value?: string;
  target?: string;
  flowId?: string;
  nodeId?: string;
  targetNodeId?: string;
  reachableFromEntry: boolean;
  sourceNodeIds: string[];
}

export interface FlowTopologyEdge {
  id: string;
  source: string;
  sourceNodeId: string;
  /** Local target, a destination ID, or a flow-start destination ID. */
  target: string;
  targetNodeId?: string;
  targetFlowId?: string;
  targetExists: boolean;
  sourceHandle: string;
  optionId?: string;
  optionLabel?: string;
  label?: string;
  kind: FlowTopologyTransitionKind;
  /** Aliases keep the data convenient for graph renderers. */
  type: FlowTopologyTransitionKind;
  transitionKind: FlowTopologyTransitionKind;
  terminal: boolean;
  isTerminal: boolean;
  secondary: boolean;
  isSecondary: boolean;
  deferred: boolean;
  isDeferred: boolean;
  freeText: boolean;
  isFreeText: boolean;
  destinationId?: string;
  destination?: FlowTopologyDestination;
  secondaryDestinationId?: string;
  secondaryDestination?: FlowTopologyDestination;
  score?: FlowTopologyScoreAnnotation;
  scores: FlowTopologyScoreAnnotation[];
  scoreRange?: FlowTopologyScoreRange;
  branchId?: string;
  effects: FlowEffect[];
}

export interface FlowTopologyCycle {
  id: string;
  nodeIds: string[];
  /** True for an SCC with a self-loop or more than one node. */
  cyclic: boolean;
}

export interface FlowTopologySequenceMarker {
  nodeId: string;
  stepNumber: number;
  kind: 'score' | 'deferred_safety' | 'video';
}

export interface FlowTopologySequence {
  id: string;
  nodeIds: string[];
  startNodeId: string;
  endNodeId: string;
  startStep: number;
  endStep: number;
  length: number;
  markers: FlowTopologySequenceMarker[];
  hasScore: boolean;
  hasDeferredSafety: boolean;
  expandedByDefault: boolean;
}

export interface FlowTopologyNode {
  id: string;
  node: FlowNode;
  kind: FlowNode['kind'];
  /** One-based editorial number, never a graph depth. */
  stepNumber: number;
  step: number;
  order: number;
  reachable: boolean;
  depth?: number;
  incomingCount: number;
  outgoingCount: number;
  localIncomingCount: number;
  localOutgoingCount: number;
  terminalDestinationIds: string[];
  destinationIds: string[];
  reverseReachableDestinationIds: string[];
  cycleId?: string;
  inCycle: boolean;
  linearSequenceId?: string;
}

export interface FlowTopologyMetrics {
  nodeCount: number;
  reachableNodeCount: number;
  unreachableNodeCount: number;
  resultCount: number;
  terminalDestinationCount: number;
  reachableTerminalDestinationCount: number;
  externalDestinationCount: number;
  flowStartCount: number;
  safetyRouteCount: number;
  deferredSafetyCount: number;
  branchCount: number;
  linearSequenceCount: number;
}

export interface FlowTopology {
  flow: GuidedFlow;
  flowId: string;
  entryNodeId: string;
  entryNode?: FlowTopologyNode;
  nodes: FlowTopologyNode[];
  nodeById: Record<string, FlowTopologyNode>;
  edges: FlowTopologyEdge[];
  edgeById: Record<string, FlowTopologyEdge>;
  destinations: FlowTopologyDestination[];
  terminalDestinations: FlowTopologyDestination[];
  reachableDestinations: FlowTopologyDestination[];
  destinationById: Record<string, FlowTopologyDestination>;
  destinationIds: string[];
  terminalDestinationIds: string[];
  reachableTerminalDestinationIds: string[];
  reachableNodeIds: string[];
  unreachableNodeIds: string[];
  depthByNodeId: Record<string, number | undefined>;
  incomingCountByNodeId: Record<string, number>;
  outgoingCountByNodeId: Record<string, number>;
  terminalDestinationIdsByNodeId: Record<string, string[]>;
  destinationIdsByNodeId: Record<string, string[]>;
  /** Destination ID -> every local node that can eventually reach it. */
  reverseReachableDestinationIds: Record<string, string[]>;
  reverseReachableNodeIdsByDestinationId: Record<string, string[]>;
  /** Node ID -> destinations reachable from that node. */
  reverseReachableDestinationIdsByNodeId: Record<string, string[]>;
  stronglyConnectedComponents: string[][];
  cycles: FlowTopologyCycle[];
  cycleNodeIds: string[];
  linearSequences: FlowTopologySequence[];
  /** Alias used by compacting renderers. */
  sequences: FlowTopologySequence[];
  metrics: FlowTopologyMetrics;
}

export type SystemFlowConnectionKind = 'flow_start' | 'navigate' | 'safety_interrupt' | 'deferred_safety' | 'end_flow';

export interface SystemFlowDestination {
  id: string;
  key: string;
  kind: FlowTopologyDestinationKind;
  label: string;
  value?: string;
  flowId?: string;
  target?: string;
  sourceFlowIds: string[];
}

export interface SystemFlowNode {
  kind: 'flow';
  id: string;
  flowId: string;
  flow: GuidedFlow;
  title: string;
  status: GuidedFlow['status'];
  stepCount: number;
  finalCount: number;
  reachableNodeCount: number;
  incomingCount: number;
  outgoingCount: number;
  connected: boolean;
}

export interface SystemDestinationNode extends Omit<SystemFlowDestination, 'kind'> {
  kind: 'navigate' | 'safety_interrupt' | 'deferred_safety' | 'end_flow' | 'missing_flow';
  nodeKind: 'destination';
}

export type SystemTopologyNode = SystemFlowNode | SystemDestinationNode;

export interface SystemFlowConnection {
  id: string;
  source: string;
  sourceFlowId: string;
  sourceNodeId: string;
  sourceHandle: string;
  optionId?: string;
  optionLabel?: string;
  label?: string;
  kind: SystemFlowConnectionKind;
  target: string;
  targetFlowId?: string;
  targetDestinationId?: string;
  targetNodeId?: string;
  destination?: SystemFlowDestination;
  secondary: boolean;
}

export interface SystemFlowTopology {
  flows: GuidedFlow[];
  flowNodes: SystemFlowNode[];
  destinations: SystemFlowDestination[];
  externalDestinations: SystemFlowDestination[];
  nodes: SystemTopologyNode[];
  connections: SystemFlowConnection[];
  edges: SystemFlowConnection[];
  flowTopologiesById: Record<string, FlowTopology>;
  incomingCountByFlowId: Record<string, number>;
  outgoingCountByFlowId: Record<string, number>;
  connectedFlowIds: string[];
  disconnectedFlowIds: string[];
}
