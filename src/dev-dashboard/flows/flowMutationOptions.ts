import type { FlowEffect, GuidedFlow } from '../../domain/flow-engine/types';

/** First free `${node.id}-option-N`, matching switchNodeKind's naming convention. */
export function uniqueOptionId(node: { id: string; options: Array<{ id: string }> }): string {
  let index = node.options.length + 1;
  let candidate = `${node.id}-option-${index}`;
  while (node.options.some((option) => option.id === candidate)) {
    index += 1;
    candidate = `${node.id}-option-${index}`;
  }
  return candidate;
}

/** First free `${node.id}-faixa-N` within the branch list, same convention as switchNodeKind. */
export function uniqueBranchId(node: { id: string; branches: Array<{ id: string }> }): string {
  let index = node.branches.length + 1;
  let candidate = `${node.id}-faixa-${index}`;
  while (node.branches.some((branch) => branch.id === candidate)) {
    index += 1;
    candidate = `${node.id}-faixa-${index}`;
  }
  return candidate;
}

/** Appends an option to a choice node without mutating the source flow. */
export function addOption(
  flow: GuidedFlow,
  nodeId: string,
  initial?: Partial<{ id: string; label: string; next: string; effects?: FlowEffect[] }>,
): { flow: GuidedFlow; optionId: string } {
  const node = flow.nodes[nodeId];
  if (!node || node.kind !== 'choice') return { flow, optionId: '' };

  const optionId = initial?.id || uniqueOptionId(node);
  const label = initial?.label !== undefined ? initial.label : '';
  const newOption: { id: string; label: string; next: string; effects?: FlowEffect[] } = {
    id: optionId,
    label,
    next: initial?.next ?? '',
    ...(initial?.effects ? { effects: initial.effects } : {}),
  };

  return {
    flow: {
      ...flow,
      nodes: {
        ...flow.nodes,
        [nodeId]: {
          ...node,
          options: [...node.options, newOption],
        },
      },
    },
    optionId,
  };
}

/** Appends a score range branch to a score_branch node without mutating the source flow. */
export function addBranch(
  flow: GuidedFlow,
  nodeId: string,
  initial?: Partial<{
    id: string;
    min: number;
    max: number;
    next: string;
    navigation?: '/apoio' | '/contatos' | '/educacao';
  }>,
): { flow: GuidedFlow; branchId: string } {
  const node = flow.nodes[nodeId];
  if (!node || node.kind !== 'score_branch') return { flow, branchId: '' };

  const branchId = initial?.id || uniqueBranchId(node);
  const lastBranch = node.branches[node.branches.length - 1];
  const min = initial?.min ?? (lastBranch ? lastBranch.max + 1 : 0);
  const max = initial?.max ?? min + 5;
  const newBranch = {
    id: branchId,
    min,
    max,
    next: initial?.next ?? '',
    ...(initial?.navigation ? { navigation: initial.navigation } : {}),
  };

  return {
    flow: {
      ...flow,
      nodes: {
        ...flow.nodes,
        [nodeId]: {
          ...node,
          branches: [...node.branches, newBranch],
        },
      },
    },
    branchId,
  };
}
