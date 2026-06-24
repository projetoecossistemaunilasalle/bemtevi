import type { FlowEffect, GuidedFlow } from '../../domain/flow-engine/types';

export type FlowRedirectionKind =
  | 'deferred_safety'
  | 'score'
  | 'score_branch'
  | 'safety_interrupt'
  | 'navigate'
  | 'flow_start'
  | 'end_flow';

export interface FlowRedirectionRow {
  id: string;
  kind: FlowRedirectionKind;
  nodeId: string;
  optionId?: string;
  title: string;
  summary: string;
}

export function getFlowRedirections(flow: GuidedFlow): FlowRedirectionRow[] {
  const rows: FlowRedirectionRow[] = [];

  Object.values(flow.nodes).forEach((node) => {
    if (node.kind === 'score_branch') {
      rows.push({
        id: `score-branch:${flow.id}:${node.id}:${node.scoreKey}`,
        kind: 'score_branch',
        nodeId: node.id,
        title: `Ramificação por pontuação ${node.scoreKey}`,
        summary: `${node.branches.length} ${node.branches.length === 1 ? 'faixa decide' : 'faixas decidem'} o próximo resultado.`,
      });
      return;
    }

    if (node.kind !== 'choice') return;

    node.options.forEach((option) => {
      option.effects?.forEach((effect) => {
        rows.push(toEffectRow(flow.id, node.id, option.id, option.label, option.next, effect));
      });
    });
  });

  return rows.sort(compareRows);
}

function toEffectRow(
  flowId: string,
  nodeId: string,
  optionId: string,
  optionLabel: string,
  nextNodeId: string,
  effect: FlowEffect,
): FlowRedirectionRow {
  if (effect.kind === 'deferred_safety') {
    return {
      id: `deferred-safety:${flowId}:${nodeId}:${optionId}:${effect.flagKey}`,
      kind: 'deferred_safety',
      nodeId,
      optionId,
      title: 'Encaminhamento de segurança ao final',
      summary: `${optionLabel} marca ${effect.flagKey}, continua para ${nextNodeId} e depois abre ${effect.destination}.`,
    };
  }

  if (effect.kind === 'score') {
    return {
      id: `score:${flowId}:${nodeId}:${optionId}:${effect.scoreKey}`,
      kind: 'score',
      nodeId,
      optionId,
      title: `${effect.value >= 0 ? '+' : ''}${effect.value} em ${effect.scoreKey}`,
      summary: `${optionLabel} soma ${effect.value >= 0 ? '+' : ''}${effect.value} em ${effect.scoreKey} e segue para ${nextNodeId}.`,
    };
  }

  if (effect.kind === 'safety_interrupt') {
    return {
      id: `safety-interrupt:${flowId}:${nodeId}:${optionId}`,
      kind: 'safety_interrupt',
      nodeId,
      optionId,
      title: 'Interrupção de segurança imediata',
      summary: `${optionLabel} interrompe o fluxo e abre ${effect.destination}.`,
    };
  }

  if (effect.kind === 'navigate') {
    return {
      id: `navigate:${flowId}:${nodeId}:${optionId}:${effect.destination}`,
      kind: 'navigate',
      nodeId,
      optionId,
      title: 'Navegação de tela',
      summary: `${optionLabel} encerra a conversa e abre ${effect.destination}.`,
    };
  }

  if (effect.kind === 'flow_start') {
    return {
      id: `flow-start:${flowId}:${nodeId}:${optionId}:${effect.flowId}`,
      kind: 'flow_start',
      nodeId,
      optionId,
      title: 'Início de outro fluxo',
      summary: `${optionLabel} começa o fluxo ${effect.flowId}.`,
    };
  }

  return {
    id: `end-flow:${flowId}:${nodeId}:${optionId}`,
    kind: 'end_flow',
    nodeId,
    optionId,
    title: 'Encerramento',
    summary: `${optionLabel} encerra a conversa com uma mensagem.`,
  };
}

function compareRows(a: FlowRedirectionRow, b: FlowRedirectionRow) {
  const order: Record<FlowRedirectionKind, number> = {
    deferred_safety: 0,
    safety_interrupt: 1,
    score: 2,
    score_branch: 3,
    navigate: 4,
    flow_start: 5,
    end_flow: 6,
  };

  return order[a.kind] - order[b.kind] || a.nodeId.localeCompare(b.nodeId) || a.id.localeCompare(b.id);
}
