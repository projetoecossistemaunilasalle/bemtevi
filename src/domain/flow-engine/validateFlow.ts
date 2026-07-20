import type { ChoiceFlowNode, FlowEffect, FlowNode, FlowValidationResult, ScoreBranchFlowNode } from './types';

const allowedFlowPurposes = ['orientation_entry', 'post_flow_routing'];

function hasText(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateFlow(flow: unknown): FlowValidationResult {
  const errors: string[] = [];
  const flowRecord = isRecord(flow) ? flow : {};
  const flowId = hasText(flowRecord.id) ? String(flowRecord.id) : '';
  const flowLabel = flowId || 'unknown';
  const entry = flowRecord.entry;
  const nodes = flowRecord.nodes;

  if (!hasText(flowRecord.id)) {
    errors.push('Flow id is required.');
  }

  if (flowRecord.purpose !== undefined && !allowedFlowPurposes.includes(String(flowRecord.purpose))) {
    errors.push(`Flow ${flowLabel} purpose must be one of ${allowedFlowPurposes.join(', ')}.`);
  }

  if (!isRecord(entry)) {
    errors.push('Flow entry is required.');
  }

  if (!isRecord(nodes)) {
    errors.push('Flow nodes are required.');
  }

  if (!isRecord(entry) || !isRecord(nodes)) {
    return {
      valid: errors.length === 0,
      errors,
    };
  }

  const nodeIds = new Set(Object.keys(nodes));
  const entryNodeId = entry.nodeId;
  const enteringPhrases = entry.enteringPhrases;

  if (!hasText(entryNodeId) || !nodeIds.has(String(entryNodeId))) {
    errors.push(`Flow ${flowLabel} entry points to missing node ${String(entryNodeId)}.`);
  }

  if (
    !Array.isArray(enteringPhrases) ||
    enteringPhrases.length === 0 ||
    enteringPhrases.some((phrase) => !hasText(phrase))
  ) {
    errors.push(`Flow ${flowLabel} must define explicit entering phrases.`);
  }

  Object.entries(nodes).forEach(([nodeKey, nodeValue]) => {
    validateNode(flowLabel, nodeKey, nodeValue, nodeIds, errors);
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

function validateNode(flowLabel: string, nodeKey: string, nodeValue: unknown, nodeIds: Set<string>, errors: string[]) {
  if (!isRecord(nodeValue)) {
    errors.push(`Flow ${flowLabel} node ${nodeKey} must be an object.`);
    return;
  }

  const node = nodeValue as unknown as FlowNode;

  if (!hasText(node.id)) {
    errors.push(`Flow ${flowLabel} has a node without an id.`);
  } else if (nodeKey !== node.id) {
    errors.push(`Flow ${flowLabel} node key ${nodeKey} must match node id ${node.id}.`);
  }

  if (!hasText(node.text)) {
    errors.push(`Flow ${flowLabel} node ${String(node.id)} must include text.`);
  }

  if (node.kind === 'choice') {
    validateChoiceNode(flowLabel, node, nodeIds, errors);
    return;
  }

  if (node.kind === 'score_branch') {
    validateScoreBranchNode(flowLabel, node, nodeIds, errors);
  }
}

function validateChoiceNode(flowLabel: string, node: ChoiceFlowNode, nodeIds: Set<string>, errors: string[]) {
  if (node.options.length === 0 && node.freeText === undefined) {
    errors.push(`Flow ${flowLabel} choice node ${node.id} must include options.`);
  }

  if (node.freeText !== undefined && !nodeIds.has(node.freeText.next)) {
    errors.push(`Flow ${flowLabel} choice node ${node.id} freeText points to missing node ${node.freeText.next}.`);
  }

  node.options.forEach((option) => {
    if (!hasText(option.id)) {
      errors.push(`Flow ${flowLabel} node ${node.id} has an option without an id.`);
    }

    if (!hasText(option.label)) {
      errors.push(`Flow ${flowLabel} option ${option.id} must include a label.`);
    }

    if (!nodeIds.has(option.next)) {
      errors.push(`Flow ${flowLabel} option ${option.id} points to missing node ${option.next}.`);
    }

    option.effects?.forEach((effect) => validateEffect(flowLabel, option.id, effect, errors));
  });
}

function validateScoreBranchNode(flowLabel: string, node: ScoreBranchFlowNode, nodeIds: Set<string>, errors: string[]) {
  if (!hasText(node.scoreKey)) {
    errors.push(`Flow ${flowLabel} score branch ${node.id} must include a scoreKey.`);
  }

  if (!Array.isArray(node.branches) || node.branches.length === 0) {
    errors.push(`Flow ${flowLabel} score branch ${node.id} must include branches.`);
    return;
  }

  node.branches.forEach((branch) => {
    if (!hasText(branch.id) || typeof branch.min !== 'number' || typeof branch.max !== 'number') {
      errors.push(`Flow ${flowLabel} score branch ${node.id} has an invalid branch.`);
      return;
    }

    if (!nodeIds.has(branch.next)) {
      errors.push(
        `Flow ${flowLabel} score branch ${node.id} branch ${branch.id} points to missing node ${branch.next}.`,
      );
    }

    if (branch.navigation !== undefined && !['/apoio', '/contatos', '/educacao'].includes(String(branch.navigation))) {
      errors.push(
        `Flow ${flowLabel} score branch ${node.id} branch ${branch.id} navigation must be a supported destination.`,
      );
    }
  });
}

function validateEffect(flowLabel: string, optionId: string, effect: FlowEffect, errors: string[]) {
  if (effect.kind === 'score') {
    if (!hasText(effect.scoreKey) || typeof effect.value !== 'number') {
      errors.push(`Flow ${flowLabel} option ${optionId} score effect must include scoreKey and numeric value.`);
    }
    return;
  }

  if (effect.kind === 'safety_interrupt') {
    if (!hasText(effect.message) || !hasText(effect.destination) || typeof effect.blockResume !== 'boolean') {
      errors.push(
        `Flow ${flowLabel} option ${optionId} safety interrupt effect must include message, destination, and blockResume.`,
      );
    }
    return;
  }

  if (effect.kind === 'deferred_safety') {
    if (
      !hasText(effect.flagKey) ||
      !hasText(effect.message) ||
      !['/apoio', '/contatos', '/educacao'].includes(String(effect.destination))
    ) {
      errors.push(
        `Flow ${flowLabel} option ${optionId} deferred safety effect must include flagKey, message, and supported destination.`,
      );
    }
    return;
  }

  if (effect.kind === 'flow_start') {
    if (!hasText(effect.flowId)) {
      errors.push(`Flow ${flowLabel} option ${optionId} flow_start effect must include flowId.`);
    }
    return;
  }

  if (effect.kind === 'navigate') {
    if (!['/apoio', '/contatos', '/educacao'].includes(String(effect.destination))) {
      errors.push(`Flow ${flowLabel} option ${optionId} navigate effect must include a supported destination.`);
    }
    return;
  }

  if (effect.kind === 'end_flow') {
    if (!hasText(effect.message)) {
      errors.push(`Flow ${flowLabel} option ${optionId} end_flow effect must include message.`);
    }
    return;
  }

  errors.push(
    `Flow ${flowLabel} option ${optionId} has unsupported effect kind "${(effect as { kind: string }).kind}".`,
  );
}
