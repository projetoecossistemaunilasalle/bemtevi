import type { FlowEffect, GuidedFlow } from '../../domain/flow-engine/types';

export type ConnectionSource =
  | { kind: 'option'; nodeId: string; optionId: string }
  | { kind: 'free_text'; nodeId: string }
  | { kind: 'branch'; nodeId: string; branchId: string };

export type AddNodeConnectFrom = ConnectionSource | { nodeId: string; optionId?: string };

export type TerminalDestination =
  | { kind: 'navigate'; destination: '/apoio' | '/contatos' | '/educacao' }
  | { kind: 'flow_start'; flowId: string }
  | { kind: 'end_flow'; message: string };

/**
 * Connects an origin source (option, free_text, or branch) to a local target node.
 * Pure: never mutates inputs. Removes conflicting terminal effects / navigation.
 */
export function connectSource(
  flow: GuidedFlow,
  source: ConnectionSource,
  targetNodeId: string,
): { flow: GuidedFlow; connected: boolean } {
  const origin = flow.nodes[source.nodeId];
  if (!origin) return { flow, connected: false };

  if (source.kind === 'option') {
    if (origin.kind !== 'choice') return { flow, connected: false };
    const optionIndex = origin.options.findIndex((opt) => opt.id === source.optionId);
    if (optionIndex === -1) return { flow, connected: false };

    const currentOpt = origin.options[optionIndex];
    const filteredEffects = currentOpt.effects?.filter(
      (eff) =>
        eff.kind !== 'navigate' &&
        eff.kind !== 'safety_interrupt' &&
        eff.kind !== 'end_flow' &&
        eff.kind !== 'flow_start',
    );

    const updatedOptions = origin.options.map((opt, idx) =>
      idx === optionIndex
        ? {
            ...opt,
            next: targetNodeId,
            ...(filteredEffects && filteredEffects.length > 0 ? { effects: filteredEffects } : { effects: undefined }),
          }
        : opt,
    );

    return {
      flow: {
        ...flow,
        nodes: {
          ...flow.nodes,
          [origin.id]: {
            ...origin,
            options: updatedOptions,
          },
        },
      },
      connected: true,
    };
  }

  if (source.kind === 'free_text') {
    if (origin.kind !== 'choice') return { flow, connected: false };
    return {
      flow: {
        ...flow,
        nodes: {
          ...flow.nodes,
          [origin.id]: {
            ...origin,
            freeText: { ...origin.freeText, next: targetNodeId },
          },
        },
      },
      connected: true,
    };
  }

  if (source.kind === 'branch') {
    if (origin.kind !== 'score_branch') return { flow, connected: false };
    const branchIndex = origin.branches.findIndex((b) => b.id === source.branchId);
    if (branchIndex === -1) return { flow, connected: false };

    const updatedBranches = origin.branches.map((b, idx) => {
      if (idx !== branchIndex) return b;
      const { navigation: _dropped, ...branchWithoutNav } = b;
      return { ...branchWithoutNav, next: targetNodeId };
    });

    return {
      flow: {
        ...flow,
        nodes: {
          ...flow.nodes,
          [origin.id]: {
            ...origin,
            branches: updatedBranches,
          },
        },
      },
      connected: true,
    };
  }

  return { flow, connected: false };
}

/**
 * Applies a terminal effect or navigation to a connection source.
 * Pure: never mutates inputs. Branches support 'navigate'; options support all terminal kinds.
 */
export function applyTerminalEffect(
  flow: GuidedFlow,
  source: ConnectionSource,
  destination: TerminalDestination,
): { flow: GuidedFlow; applied: boolean } {
  const origin = flow.nodes[source.nodeId];
  if (!origin) return { flow, applied: false };

  if (source.kind === 'option') {
    if (origin.kind !== 'choice') return { flow, applied: false };
    const optionIndex = origin.options.findIndex((opt) => opt.id === source.optionId);
    if (optionIndex === -1) return { flow, applied: false };

    const currentOpt = origin.options[optionIndex];
    const retainedEffects =
      currentOpt.effects?.filter(
        (eff) =>
          eff.kind !== 'navigate' &&
          eff.kind !== 'safety_interrupt' &&
          eff.kind !== 'end_flow' &&
          eff.kind !== 'flow_start',
      ) ?? [];

    let newEffect: FlowEffect;
    if (destination.kind === 'navigate') {
      newEffect = { kind: 'navigate', destination: destination.destination };
    } else if (destination.kind === 'flow_start') {
      newEffect = { kind: 'flow_start', flowId: destination.flowId };
    } else {
      newEffect = { kind: 'end_flow', message: destination.message };
    }

    const updatedOptions = origin.options.map((opt, idx) =>
      idx === optionIndex
        ? {
            ...opt,
            effects: [...retainedEffects, newEffect],
          }
        : opt,
    );

    return {
      flow: {
        ...flow,
        nodes: {
          ...flow.nodes,
          [origin.id]: {
            ...origin,
            options: updatedOptions,
          },
        },
      },
      applied: true,
    };
  }

  if (source.kind === 'branch') {
    if (origin.kind !== 'score_branch') return { flow, applied: false };
    if (destination.kind !== 'navigate') return { flow, applied: false };

    const branchIndex = origin.branches.findIndex((b) => b.id === source.branchId);
    if (branchIndex === -1) return { flow, applied: false };

    const updatedBranches = origin.branches.map((b, idx) =>
      idx === branchIndex ? { ...b, navigation: destination.destination } : b,
    );

    return {
      flow: {
        ...flow,
        nodes: {
          ...flow.nodes,
          [origin.id]: {
            ...origin,
            branches: updatedBranches,
          },
        },
      },
      applied: true,
    };
  }

  return { flow, applied: false };
}
