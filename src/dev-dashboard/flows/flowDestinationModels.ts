import type { Edge, Node } from '@xyflow/react';

import type { FlowNode, GuidedFlow } from '../../domain/flow-engine/types';
import type { MapFocusSection } from './flowDisplay';
import type { ConnectionSource, TerminalDestination } from './flowMutations';

export type DestinationKind =
  | 'result'
  | 'navigate'
  | 'safety_interrupt'
  | 'deferred_safety'
  | 'flow_start'
  | 'end_flow'
  | 'missing';

export interface Destination {
  id: string;
  kind: DestinationKind;
  label: string;
  detail?: string;
  nodeId?: string;
  flowId?: string;
  reachable: boolean;
  sources: Set<string>;
}

export interface DestinationTransition {
  id: string;
  source: string;
  sourceHandle: string;
  target: string;
  label: string;
  kind:
    | 'normal'
    | 'flow_start'
    | 'navigate'
    | 'safety_interrupt'
    | 'deferred_safety'
    | 'end_flow'
    | 'missing'
    | 'score_branch';
  badge?: string;
}

export interface DestinationAnalysisNode {
  id: string;
  node?: FlowNode;
  depth: number | null;
  reachable: boolean;
  order: number;
  destinations: Set<string>;
  cycle?: boolean;
}

export interface DestinationSequenceGroup {
  id: string;
  nodeIds: string[];
}

export interface DestinationAnalysis {
  nodes: DestinationAnalysisNode[];
  transitions: DestinationTransition[];
  destinations: Destination[];
  sequences: DestinationSequenceGroup[];
  stats: { nodes: number; results: number; external: number; handoffs: number; safety: number };
  maxDepth: number;
}

export interface DestinationNodeData extends Record<string, unknown> {
  kind: 'choice' | 'score_branch' | 'result' | 'destination' | 'sequence' | 'missing';
  node?: FlowNode;
  stepLabel?: string;
  nodeIds?: string[];
  destination?: Destination;
  matched?: boolean;
  highlighted?: boolean;
  expanded?: boolean;
  cycle?: boolean;
  isDisconnected?: boolean;
  optionTargets?: Record<string, string>;
  targetHandles?: Array<{ id: string; top: number }>;
  flows?: GuidedFlow[];
  onOpenFlow?: (flowId: string) => void;
  onToggleSequence?: () => void;
  onAddConnectedStage?: (source: ConnectionSource, kind: FlowNode['kind']) => void;
  onApplyTerminalEffect?: (source: ConnectionSource, destination: TerminalDestination) => void;
  onAddOption?: (nodeId: string) => void;
  onAddBranch?: (nodeId: string) => void;
  activeFocusSection?: MapFocusSection;
  activeFocusTargetId?: string;
  onFocusSection?: (nodeId: string, section: MapFocusSection, targetId?: string) => void;
}

export type DestinationRFNode = Node<DestinationNodeData>;

export type DestinationRFEdge = Edge<
  { kind: DestinationTransition['kind']; optionLabel: string; badge?: string },
  'smoothstep'
> & {
  pathOptions?: { borderRadius?: number; offset?: number; stepPosition?: number };
};

export function destinationId(kind: DestinationKind, value: string) {
  return `destination:${kind}:${value}`;
}

export function destinationNodeKindLabel(kind: DestinationNodeData['kind']) {
  if (kind === 'choice') return 'Pergunta';
  if (kind === 'score_branch') return 'Ramificação';
  if (kind === 'result') return 'Final';
  if (kind === 'sequence') return 'Sequência linear';
  if (kind === 'missing') return 'Destino ausente';
  return 'Destino';
}
