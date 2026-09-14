import type { FlowNode, FlowValidationResult } from '../model/flowTypes';
import { validateChoiceNode, validateScoreBranchNode } from './flowNodeKindValidation';
import { validateNodeExercise, validateNodeVideos, validateNodeVisuals } from './flowNodeMediaValidation';

const allowedFlowPurposes = ['orientation_entry', 'post_flow_routing'];

export function hasText(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isFlowRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateFlow(flow: unknown): FlowValidationResult {
  const errors: string[] = [];
  const flowRecord = isFlowRecord(flow) ? flow : {};
  const flowId = hasText(flowRecord.id) ? String(flowRecord.id) : '';
  const flowLabel = flowId || 'unknown';
  const entry = flowRecord.entry;
  const nodes = flowRecord.nodes;

  if (!hasText(flowRecord.id)) {
    errors.push('O ID do fluxo é obrigatório.');
  }

  if (flowRecord.purpose !== undefined && !allowedFlowPurposes.includes(String(flowRecord.purpose))) {
    errors.push(`O propósito do fluxo ${flowLabel} deve ser um destes: ${allowedFlowPurposes.join(', ')}.`);
  }

  if (!isFlowRecord(entry)) {
    errors.push('A entrada do fluxo é obrigatória.');
  }

  if (!isFlowRecord(nodes)) {
    errors.push('Os nós do fluxo são obrigatórios.');
  }

  if (!isFlowRecord(entry) || !isFlowRecord(nodes)) {
    return {
      valid: errors.length === 0,
      errors,
    };
  }

  const nodeIds = new Set(Object.keys(nodes));
  const entryNodeId = entry.nodeId;
  const enteringPhrases = entry.enteringPhrases;

  if (!hasText(entryNodeId) || !nodeIds.has(String(entryNodeId))) {
    errors.push(`A entrada do fluxo ${flowLabel} aponta para um nó inexistente: ${String(entryNodeId)}.`);
  }

  if (
    !Array.isArray(enteringPhrases) ||
    enteringPhrases.length === 0 ||
    enteringPhrases.some((phrase) => !hasText(phrase))
  ) {
    errors.push(`O fluxo ${flowLabel} precisa definir frases explícitas para iniciá-lo.`);
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
  if (!isFlowRecord(nodeValue)) {
    errors.push(`O nó ${nodeKey} do fluxo ${flowLabel} precisa ser um objeto.`);
    return;
  }

  const node = nodeValue as unknown as FlowNode;

  if (!hasText(node.id)) {
    errors.push(`O fluxo ${flowLabel} tem um nó sem ID.`);
  } else if (nodeKey !== node.id) {
    errors.push(`A chave do nó ${nodeKey} no fluxo ${flowLabel} deve ser igual ao ID do nó ${node.id}.`);
  }

  if (!hasText(node.text)) {
    errors.push(`O nó ${String(node.id)} do fluxo ${flowLabel} precisa informar um texto.`);
  }

  validateNodeVideos(flowLabel, nodeKey, nodeValue.videos, errors);
  validateNodeVisuals(flowLabel, nodeKey, nodeValue.visuals, errors);
  validateNodeExercise(flowLabel, nodeKey, nodeValue.exercise, errors);

  if (node.kind === 'choice') {
    validateChoiceNode(flowLabel, node, nodeIds, errors);
    return;
  }

  if (node.kind === 'score_branch') {
    validateScoreBranchNode(flowLabel, node, nodeIds, errors);
  }
}
