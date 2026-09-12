import type { FlowEffect, FlowOption, GuidedFlow } from '../../domain/flow-engine/types';
import {
  destinationId,
  type Destination,
  type DestinationAnalysis,
  type DestinationAnalysisNode,
  type DestinationKind,
  type DestinationSequenceGroup,
  type DestinationTransition,
} from './flowDestinationModels';
import { previewFlowText } from './flowText';

function stableNodes(flow: GuidedFlow) {
  const order = flow.nodeOrder ?? [];
  const rank = new Map(order.map((id, index) => [id, index]));
  return Object.values(flow.nodes).sort((a, b) => {
    const byOrder = (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER);
    return byOrder || a.id.localeCompare(b.id);
  });
}

function optionEffect(option: FlowOption, kind: FlowEffect['kind']) {
  return option.effects?.find((effect) => effect.kind === kind);
}

function optionTerminal(option: FlowOption) {
  const effects = option.effects ?? [];
  return (
    effects.find((effect) => effect.kind === 'safety_interrupt') ??
    effects.find((effect) => effect.kind === 'navigate') ??
    effects.find((effect) => effect.kind === 'end_flow')
  );
}

export function buildLocalAnalysis(flow: GuidedFlow, flows: GuidedFlow[]): DestinationAnalysis {
  const flowNodes = stableNodes(flow);
  const byId = new Map(flowNodes.map((node) => [node.id, node]));
  const transitions: DestinationTransition[] = [];
  const destinations = new Map<string, Destination>();
  const addDestination = (id: string, kind: DestinationKind, label: string, detail?: string) => {
    const existing = destinations.get(id);
    if (existing) return existing;
    const created: Destination = { id, kind, label, detail, reachable: false, sources: new Set() };
    destinations.set(id, created);
    return created;
  };
  const addTransition = (
    source: string,
    sourceHandle: string,
    target: string,
    label: string,
    kind: DestinationTransition['kind'],
    badge?: string,
  ) => {
    const transition: DestinationTransition = {
      id: `${source}:${sourceHandle}:${target}:${transitions.length}`,
      source,
      sourceHandle,
      target,
      label,
      kind,
      badge,
    };
    transitions.push(transition);
    return transition;
  };

  for (const node of flowNodes) {
    if (node.kind === 'result') {
      const id = destinationId('result', node.id);
      const result = addDestination(id, 'result', `${node.id} · ${previewFlowText(node.text, 48)}`);
      result.nodeId = node.id;
      continue;
    }
    if (node.kind === 'choice') {
      for (const option of node.options) {
        const terminal = optionTerminal(option);
        const score = optionEffect(option, 'score');
        const badge = score && score.kind === 'score' ? `+${score.value} · ${score.scoreKey}` : undefined;
        if (terminal?.kind === 'safety_interrupt' || terminal?.kind === 'navigate') {
          const id = destinationId(terminal.kind, terminal.destination);
          addDestination(
            id,
            terminal.kind,
            terminal.kind === 'safety_interrupt'
              ? `Segurança imediata · ${terminal.destination}`
              : terminal.destination,
            terminal.destination,
          ).sources.add(node.id);
          addTransition(node.id, option.id, id, option.label, terminal.kind, badge);
        } else if (terminal?.kind === 'end_flow') {
          const id = destinationId('end_flow', 'end');
          addDestination(id, 'end_flow', 'Encerramento', terminal.message).sources.add(node.id);
          addTransition(node.id, option.id, id, option.label, 'end_flow', badge);
        } else if (optionEffect(option, 'flow_start')?.kind === 'flow_start') {
          const effect = optionEffect(option, 'flow_start');
          if (effect?.kind !== 'flow_start') continue;
          const targetFlow = flows.find((candidate) => candidate.id === effect.flowId);
          const id = targetFlow
            ? destinationId('flow_start', targetFlow.id)
            : destinationId('missing', `flow:${effect.flowId}`);
          addDestination(
            id,
            targetFlow ? 'flow_start' : 'missing',
            targetFlow ? `Fluxo · ${targetFlow.title}` : `Fluxo ausente · ${effect.flowId}`,
            targetFlow ? `Entrada: ${targetFlow.entry.nodeId}` : effect.flowId,
          ).sources.add(node.id);
          const destination = destinations.get(id);
          if (destination && targetFlow) destination.flowId = targetFlow.id;
          addTransition(node.id, option.id, id, option.label, targetFlow ? 'flow_start' : 'missing', badge);
        } else {
          const target = byId.get(option.next);
          const targetId = target ? target.id : destinationId('missing', option.next);
          if (!target)
            addDestination(targetId, 'missing', `Destino ausente · ${option.next}`, option.next).sources.add(node.id);
          addTransition(node.id, option.id, targetId, option.label, target ? 'normal' : 'missing', badge);
        }
        const deferred = optionEffect(option, 'deferred_safety');
        if (deferred?.kind === 'deferred_safety') {
          const id = destinationId('deferred_safety', deferred.destination);
          addDestination(
            id,
            'deferred_safety',
            `Segurança ao concluir · ${deferred.destination}`,
            deferred.destination,
          ).sources.add(node.id);
          addTransition(node.id, `${option.id}:deferred`, id, 'ao concluir', 'deferred_safety');
        }
      }
      if (node.freeText) {
        const target = byId.get(node.freeText.next);
        const targetId = target ? target.id : destinationId('missing', node.freeText.next);
        if (!target)
          addDestination(
            targetId,
            'missing',
            `Destino ausente · ${node.freeText.next}`,
            node.freeText.next,
          ).sources.add(node.id);
        addTransition(node.id, 'free-text', targetId, 'Resposta livre', target ? 'normal' : 'missing');
      }
    } else {
      for (const branch of node.branches) {
        if (branch.navigation) {
          const id = destinationId('navigate', branch.navigation);
          addDestination(id, 'navigate', branch.navigation, branch.navigation).sources.add(node.id);
          addTransition(node.id, branch.id, id, `${branch.min}–${branch.max}`, 'navigate');
          continue;
        }
        const target = byId.get(branch.next);
        const targetId = target ? target.id : destinationId('missing', branch.next);
        if (!target)
          addDestination(targetId, 'missing', `Destino ausente · ${branch.next}`, branch.next).sources.add(node.id);
        const badge = branch.navigation ? `→ ${branch.navigation}` : undefined;
        addTransition(
          node.id,
          branch.id,
          targetId,
          `${branch.min}–${branch.max}`,
          target ? 'score_branch' : 'missing',
          badge,
        );
      }
    }
  }

  for (const node of flowNodes) {
    const resultDestination = destinations.get(destinationId('result', node.id));
    if (resultDestination) resultDestination.sources.add(node.id);
  }

  const adjacency = new Map<string, string[]>();
  for (const node of flowNodes) adjacency.set(node.id, []);
  for (const transition of transitions) {
    const resultDestination =
      byId.get(transition.target)?.kind === 'result'
        ? destinations.get(destinationId('result', transition.target))
        : undefined;
    if (resultDestination) resultDestination.sources.add(transition.source);
    if (byId.has(transition.target)) adjacency.get(transition.source)?.push(transition.target);
  }

  const depth = new Map<string, number>();
  const queue: string[] = [];
  if (byId.has(flow.entry.nodeId)) {
    depth.set(flow.entry.nodeId, 0);
    queue.push(flow.entry.nodeId);
  }
  while (queue.length) {
    const current = queue.shift()!;
    for (const next of adjacency.get(current) ?? []) {
      if (!depth.has(next)) {
        depth.set(next, (depth.get(current) ?? 0) + 1);
        queue.push(next);
      }
    }
  }
  const maxDepth = Math.max(0, ...depth.values());
  const analysisNodes: DestinationAnalysisNode[] = flowNodes.map((node, order) => ({
    id: node.id,
    node,
    depth: depth.get(node.id) ?? null,
    reachable: depth.has(node.id),
    order,
    destinations: new Set(),
  }));
  const cycleNodes = new Set<string>();
  const colors = new Map<string, 0 | 1 | 2>();
  const stack: string[] = [];
  const visitCycle = (id: string) => {
    colors.set(id, 1);
    stack.push(id);
    for (const next of adjacency.get(id) ?? []) {
      if (colors.get(next) === 1) {
        const start = stack.indexOf(next);
        stack.slice(start < 0 ? 0 : start).forEach((cycleId) => cycleNodes.add(cycleId));
      } else if (!colors.has(next)) visitCycle(next);
    }
    stack.pop();
    colors.set(id, 2);
  };
  for (const node of flowNodes) if (!colors.has(node.id)) visitCycle(node.id);
  analysisNodes.forEach((node) => {
    node.cycle = cycleNodes.has(node.id);
  });
  const nodeById = new Map(analysisNodes.map((node) => [node.id, node]));
  for (const destination of destinations.values()) {
    const pending = [...destination.sources];
    const seen = new Set<string>();
    while (pending.length) {
      const current = pending.pop()!;
      if (seen.has(current)) continue;
      seen.add(current);
      nodeById.get(current)?.destinations.add(destination.id);
      for (const transition of transitions) {
        if (transition.target === current) pending.push(transition.source);
      }
    }
    destination.reachable = [...destination.sources].some((sourceId) => depth.has(sourceId));
  }

  const sequences: DestinationSequenceGroup[] = [];
  const included = new Set<string>();
  const localOutgoing = (id: string) => [...new Set((adjacency.get(id) ?? []).filter((target) => byId.has(target)))];
  const localIncoming = (id: string) =>
    transitions.filter((transition) => transition.target === id).map((transition) => transition.source);
  for (const node of analysisNodes) {
    if (!node.reachable || !node.node || node.node.kind === 'result' || node.cycle || included.has(node.id)) continue;
    const outgoing = localOutgoing(node.id);
    const incoming = localIncoming(node.id);
    const isStart = node.id === flow.entry.nodeId || incoming.some((source) => localOutgoing(source).length !== 1);
    if (!isStart || outgoing.length !== 1) continue;
    const ids = [node.id];
    let current = outgoing[0];
    while (ids.length < 50) {
      const candidate = nodeById.get(current);
      if (!candidate?.reachable || !candidate.node || candidate.node.kind === 'result') break;
      const next = localOutgoing(current);
      const prev = localIncoming(current);
      if (next.length !== 1 || prev.length === 0 || prev.some((source) => source !== ids[ids.length - 1])) break;
      if (ids.includes(current)) break;
      ids.push(current);
      current = next[0];
    }
    if (ids.length >= 4) {
      ids.forEach((id) => included.add(id));
      sequences.push({ id: `sequence:${ids[0]}:${ids[ids.length - 1]}`, nodeIds: ids });
    }
  }

  const resultDestinations = [...destinations.values()].filter((destination) => destination.kind === 'result');
  const externalDestinations = [...destinations.values()].filter((destination) => destination.kind !== 'result');
  return {
    nodes: analysisNodes,
    transitions,
    destinations: [...resultDestinations, ...externalDestinations],
    sequences,
    stats: {
      nodes: flowNodes.length,
      results: resultDestinations.length,
      external: externalDestinations.filter(
        (destination) =>
          destination.kind === 'navigate' ||
          destination.kind === 'safety_interrupt' ||
          destination.kind === 'deferred_safety',
      ).length,
      handoffs: externalDestinations.filter((destination) => destination.kind === 'flow_start').length,
      safety: transitions.filter(
        (transition) => transition.kind === 'safety_interrupt' || transition.kind === 'deferred_safety',
      ).length,
    },
    maxDepth,
  };
}
