import type { ChoiceFlowNode, FlowValidationResult, GuidedFlow } from './types';

function hasText(value: string | undefined) {
  return Boolean(value?.trim());
}

export function validateFlow(flow: GuidedFlow): FlowValidationResult {
  const errors: string[] = [];
  const nodeIds = new Set(Object.keys(flow.nodes));

  if (!hasText(flow.id)) {
    errors.push('Flow id is required.');
  }

  if (!nodeIds.has(flow.entry.nodeId)) {
    errors.push(`Flow ${flow.id} entry points to missing node ${flow.entry.nodeId}.`);
  }

  if (flow.entry.enteringPhrases.length === 0 || flow.entry.enteringPhrases.some((phrase) => !hasText(phrase))) {
    errors.push(`Flow ${flow.id} must define explicit entering phrases.`);
  }

  Object.values(flow.nodes).forEach((node) => {
    if (!hasText(node.id)) {
      errors.push(`Flow ${flow.id} has a node without an id.`);
    }

    if (!hasText(node.text)) {
      errors.push(`Flow ${flow.id} node ${node.id} must include text.`);
    }

    if (node.kind === 'choice') {
      validateChoiceNode(flow, node, nodeIds, errors);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

function validateChoiceNode(flow: GuidedFlow, node: ChoiceFlowNode, nodeIds: Set<string>, errors: string[]) {
  if (node.options.length === 0) {
    errors.push(`Flow ${flow.id} choice node ${node.id} must include options.`);
  }

  node.options.forEach((option) => {
    if (!hasText(option.id)) {
      errors.push(`Flow ${flow.id} node ${node.id} has an option without an id.`);
    }

    if (!hasText(option.label)) {
      errors.push(`Flow ${flow.id} option ${option.id} must include a label.`);
    }

    if (!nodeIds.has(option.next)) {
      errors.push(`Flow ${flow.id} option ${option.id} points to missing node ${option.next}.`);
    }
  });
}
