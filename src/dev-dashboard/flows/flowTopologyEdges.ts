import type {
  FlowEffect,
  FlowNode,
  FlowOption,
  GuidedFlow,
  ScoreBranch,
  ScoreFlowEffect,
} from '../../domain/flow-engine/types';
import type {
  FlowTopologyDestination,
  FlowTopologyEdge,
  FlowTopologyScoreRange,
  FlowTopologyTransitionKind,
} from './flowTopologyTypes';
import { excerptFlowText } from './flowText';

type MutableDestination = FlowTopologyDestination;

const TERMINAL_EFFECT_ORDER: FlowEffect['kind'][] = ['safety_interrupt', 'navigate', 'end_flow'];

export function getOrderedNodes(flow: GuidedFlow): FlowNode[] {
  const nodeMap = flow.nodes;
  const ordered: FlowNode[] = [];
  const seen = new Set<string>();
  if (flow.nodeOrder) {
    for (const id of flow.nodeOrder) {
      const node = nodeMap[id];
      if (node && !seen.has(node.id)) {
        ordered.push(node);
        seen.add(node.id);
      }
    }
  }
  for (const node of Object.values(nodeMap)) {
    if (!seen.has(node.id)) {
      ordered.push(node);
      seen.add(node.id);
    }
  }
  return ordered;
}

export function resultLabel(node: FlowNode, step: number) {
  return `Etapa ${step} · ${excerptFlowText(node.text)}`;
}

export function makeScoreRange(branch: ScoreBranch): FlowTopologyScoreRange {
  return { id: branch.id, min: branch.min, max: branch.max, label: `${branch.min}–${branch.max}` };
}

export function createEdge(
  input: Partial<FlowTopologyEdge> & Pick<FlowTopologyEdge, 'id' | 'sourceNodeId' | 'sourceHandle' | 'target' | 'kind'>,
): FlowTopologyEdge {
  const kind = input.kind;
  const effects = input.effects ?? [];
  const scores = input.scores ?? [];
  return {
    id: input.id,
    source: input.sourceNodeId,
    sourceNodeId: input.sourceNodeId,
    target: input.target,
    targetNodeId: input.targetNodeId,
    targetFlowId: input.targetFlowId,
    targetExists: input.targetExists ?? Boolean(input.targetNodeId),
    sourceHandle: input.sourceHandle,
    optionId: input.optionId,
    optionLabel: input.optionLabel,
    label: input.label,
    kind,
    type: kind,
    transitionKind: kind,
    terminal: input.terminal ?? false,
    isTerminal: input.terminal ?? false,
    secondary: input.secondary ?? false,
    isSecondary: input.secondary ?? false,
    deferred: input.deferred ?? kind === 'deferred_safety',
    isDeferred: input.deferred ?? kind === 'deferred_safety',
    freeText: input.freeText ?? kind === 'free_text',
    isFreeText: input.freeText ?? kind === 'free_text',
    destinationId: input.destinationId,
    destination: input.destination,
    secondaryDestinationId: input.secondaryDestinationId,
    secondaryDestination: input.secondaryDestination,
    score: input.score ?? scores[0],
    scores,
    scoreRange: input.scoreRange,
    branchId: input.branchId,
    effects,
  };
}

export function addOptionEdges(
  _flow: GuidedFlow,
  flows: GuidedFlow[],
  node: Extract<FlowNode, { kind: 'choice' }>,
  option: FlowOption,
  nodeMap: Map<string, FlowNode>,
  registerDestination: (
    destination: Omit<MutableDestination, 'key' | 'reachableFromEntry' | 'sourceNodeIds'>,
  ) => MutableDestination,
  addEdge: (edge: FlowTopologyEdge) => void,
) {
  const effects = option.effects ?? [];
  const scores = effects
    .filter((effect): effect is ScoreFlowEffect => effect.kind === 'score')
    .map(({ scoreKey, value }) => ({ scoreKey, value }));
  const terminalEffect = findTerminalEffect(effects);
  const flowStart = effects.find((effect) => effect.kind === 'flow_start');
  const deferred = findLastEffect(effects, 'deferred_safety');
  const targetNode = nodeMap.get(option.next);
  let primary: FlowTopologyEdge;

  if (terminalEffect) {
    const destination = registerEffectDestination(terminalEffect, registerDestination);
    primary = createEdge({
      id: `${node.id}__${option.id}__${terminalEffect.kind}`,
      sourceNodeId: node.id,
      sourceHandle: option.id,
      optionId: option.id,
      optionLabel: option.label,
      label: option.label,
      kind: terminalEffect.kind,
      target: destination.id,
      targetExists: true,
      terminal: true,
      destinationId: destination.id,
      destination,
      scores,
      score: scores[0],
      effects,
    });
  } else if (flowStart?.kind === 'flow_start') {
    const targetFlow = flows.find((candidate) => candidate.id === flowStart.flowId);
    const destination = targetFlow
      ? registerDestination({
          id: `flow_start:${targetFlow.id}`,
          kind: 'flow_start',
          label: `Fluxo · ${targetFlow.title}`,
          value: targetFlow.id,
          target: targetFlow.entry.nodeId,
          flowId: targetFlow.id,
          targetNodeId: targetFlow.entry.nodeId,
        })
      : registerDestination({
          id: `missing_flow:${flowStart.flowId}`,
          kind: 'missing_flow',
          label: `Fluxo ausente · ${flowStart.flowId}`,
          value: flowStart.flowId,
          target: flowStart.flowId,
          flowId: flowStart.flowId,
        });
    primary = createEdge({
      id: `${node.id}__${option.id}__flow-start__${flowStart.flowId}`,
      sourceNodeId: node.id,
      sourceHandle: option.id,
      optionId: option.id,
      optionLabel: option.label,
      label: option.label,
      kind: 'flow_start',
      target: destination.id,
      targetFlowId: targetFlow?.id,
      targetNodeId: targetFlow?.entry.nodeId,
      targetExists: Boolean(targetFlow),
      terminal: true,
      destinationId: destination.id,
      destination,
      scores,
      score: scores[0],
      effects,
    });
  } else {
    const missingDestination = targetNode
      ? undefined
      : registerMissingNodeDestination(option.next, registerDestination);
    const kind: FlowTopologyTransitionKind = scores.length > 0 ? 'score' : 'normal';
    primary = createEdge({
      id: `${node.id}__${option.id}__${option.next}`,
      sourceNodeId: node.id,
      sourceHandle: option.id,
      optionId: option.id,
      optionLabel: option.label,
      label: option.label,
      kind,
      target: targetNode?.id ?? missingDestination!.id,
      targetNodeId: targetNode?.id,
      targetExists: Boolean(targetNode),
      terminal: !targetNode,
      destinationId: targetNode?.kind === 'result' ? targetNode.id : missingDestination?.id,
      scores,
      score: scores[0],
      effects,
    });
  }

  addEdge(primary);

  // A deferred safety route supplements the normal route unless an immediate terminal effect wins.
  if (deferred && !terminalEffect) {
    const deferredDestination = registerEffectDestination(deferred, registerDestination);
    addEdge(
      createEdge({
        id: `${node.id}__${option.id}__deferred-safety`,
        sourceNodeId: node.id,
        sourceHandle: `${option.id}__deferred-safety`,
        optionId: option.id,
        optionLabel: option.label,
        label: 'ao concluir',
        kind: 'deferred_safety',
        target: deferredDestination.id,
        targetExists: true,
        terminal: true,
        secondary: true,
        deferred: true,
        destinationId: deferredDestination.id,
        destination: deferredDestination,
        effects: [deferred],
      }),
    );
  }
}

function findTerminalEffect(
  effects: FlowEffect[],
): Extract<FlowEffect, { kind: 'safety_interrupt' | 'navigate' | 'end_flow' }> | undefined {
  for (const kind of TERMINAL_EFFECT_ORDER) {
    const effect = effects.find((candidate) => candidate.kind === kind);
    if (effect && (effect.kind === 'safety_interrupt' || effect.kind === 'navigate' || effect.kind === 'end_flow'))
      return effect;
  }
  return undefined;
}

function findLastEffect<TKind extends FlowEffect['kind']>(
  effects: FlowEffect[],
  kind: TKind,
): Extract<FlowEffect, { kind: TKind }> | undefined {
  const effect = [...effects].reverse().find((candidate) => candidate.kind === kind);
  return effect as Extract<FlowEffect, { kind: TKind }> | undefined;
}

function registerEffectDestination(
  effect: Extract<FlowEffect, { kind: 'safety_interrupt' | 'navigate' | 'end_flow' | 'deferred_safety' }>,
  registerDestination: (
    destination: Omit<MutableDestination, 'key' | 'reachableFromEntry' | 'sourceNodeIds'>,
  ) => MutableDestination,
) {
  if (effect.kind === 'end_flow') {
    return registerDestination({ id: 'end_flow', kind: 'end_flow', label: 'Encerramento' });
  }
  const value = effect.destination;
  return registerDestination({
    id: `${effect.kind}:${value}`,
    kind: effect.kind,
    label:
      effect.kind === 'safety_interrupt'
        ? `Segurança imediata · ${value}`
        : effect.kind === 'deferred_safety'
          ? `Segurança ao concluir · ${value}`
          : value,
    value,
    target: value,
  });
}

export function registerExternalDestination(
  kind: 'navigate',
  value: string,
  _unused: undefined,
  registerDestination: (
    destination: Omit<MutableDestination, 'key' | 'reachableFromEntry' | 'sourceNodeIds'>,
  ) => MutableDestination,
) {
  return registerDestination({ id: `${kind}:${value}`, kind, label: value, value, target: value });
}

export function registerMissingNodeDestination(
  target: string,
  registerDestination: (
    destination: Omit<MutableDestination, 'key' | 'reachableFromEntry' | 'sourceNodeIds'>,
  ) => MutableDestination,
) {
  return registerDestination({
    id: `missing_node:${target}`,
    kind: 'missing_node',
    label: `Destino ausente · ${target}`,
    value: target,
    target,
  });
}
