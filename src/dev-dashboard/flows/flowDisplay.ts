import type { FlowNode, GuidedFlow } from '../../domain/flow-engine/types';

/**
 * Node-panel sections addressable by a map focus request. Flow-level
 * ('configuracoes') targets never flow through this field — they are encoded
 * by an absent `nodeId`, so this union stays panel-only.
 */
export type MapFocusSection = 'texto' | 'opcoes' | 'ramificacao' | 'midia' | 'opcao' | 'faixa' | 'geral';

/**
 * Shared pt-BR labels for the flow status union. Single source for every
 * surface that renders or edits a status (overview map nodes, settings
 * selects), so wording can't drift between read-only and editable views.
 */
export const STATUS_LABELS: Record<GuidedFlow['status'], string> = {
  draft: 'Rascunho',
  pending_review: 'Em revisão',
  approved: 'Aprovado',
  archived: 'Arquivado',
};

export function getFlowNodeTitle(nodeId: string, nodes: FlowNode[]) {
  const index = nodes.findIndex((node) => node.id === nodeId);
  return index === -1 ? 'Etapa sem nome' : `Etapa ${index + 1}`;
}

export function getFlowNodeLabel(node: FlowNode, nodes: FlowNode[]) {
  const preview = node.text.trim().replace(/\s+/g, ' ').slice(0, 64);
  return `${getFlowNodeTitle(node.id, nodes)} - ${preview}`;
}

export function getFlowStartTargetTitle(flowId: string, flows: GuidedFlow[]) {
  return flows.find((flow) => flow.id === flowId)?.title ?? 'outro fluxo';
}
