import type { FlowEffect, GuidedFlow, ScoreBranchFlowNode } from '../../domain/flow-engine/types';
import type { DashboardValidationIssue } from '../validation/validationTypes';

const allowedNavigateDestinations = new Set(['/apoio', '/contatos', '/educacao']);

export function validateFlowEffect(
  flowId: string,
  nodeId: string,
  optionId: string,
  effect: FlowEffect,
  flowIds: Set<string>,
): DashboardValidationIssue[] {
  if (effect.kind === 'flow_start' && !flowIds.has(effect.flowId)) {
    return [
      {
        level: 'error',
        area: 'flows',
        id: `missing-flow-start:${flowId}:${nodeId}:${optionId}`,
        message: `Esta opção tenta começar um fluxo que não existe: ${effect.flowId}.`,
        path: `${flowId}.nodes.${nodeId}.options.${optionId}.effects`,
      },
    ];
  }
  if (effect.kind === 'navigate' && !allowedNavigateDestinations.has(effect.destination)) {
    return [
      {
        level: 'error',
        area: 'flows',
        id: `invalid-navigate:${flowId}:${nodeId}:${optionId}`,
        message: `Esta opção tenta abrir um destino que não é permitido: ${effect.destination}.`,
        path: `${flowId}.nodes.${nodeId}.options.${optionId}.effects`,
      },
    ];
  }
  if (effect.kind === 'safety_interrupt' && !allowedNavigateDestinations.has(effect.destination)) {
    return [
      {
        level: 'error',
        area: 'flows',
        id: `invalid-safety-destination:${flowId}:${nodeId}:${optionId}`,
        message: `A interrupção de segurança usa um destino que não é permitido: ${effect.destination}.`,
        path: `${flowId}.nodes.${nodeId}.options.${optionId}.effects`,
      },
    ];
  }
  return [];
}

export function collectScoringKeys(flow: GuidedFlow) {
  const keys = new Set<string>();
  Object.values(flow.nodes).forEach((node) => {
    if (node.kind !== 'choice') return;
    node.options.forEach((option) => {
      option.effects?.forEach((effect) => {
        if (effect.kind === 'score' && effect.scoreKey.trim()) keys.add(effect.scoreKey);
      });
    });
  });
  return keys;
}

export function validateScoreBranch(
  flowId: string,
  node: ScoreBranchFlowNode,
  scoringKeys: Set<string>,
): DashboardValidationIssue[] {
  const issues: DashboardValidationIssue[] = [];
  if (!scoringKeys.has(node.scoreKey)) {
    issues.push({
      level: 'warning',
      area: 'flows',
      id: `unused-score-key:${flowId}:${node.id}:${node.scoreKey}`,
      message: `Esta ramificação usa a pontuação "${node.scoreKey}", mas nenhuma opção soma pontos nessa chave.`,
      path: `${flowId}.nodes.${node.id}.scoreKey`,
    });
  }
  const sortedBranches = [...node.branches].sort((left, right) => left.min - right.min || left.max - right.max);
  sortedBranches.forEach((branch, index) => {
    if (branch.navigation !== undefined && !allowedNavigateDestinations.has(branch.navigation)) {
      issues.push({
        level: 'error',
        area: 'flows',
        id: `invalid-score-branch-navigation:${flowId}:${node.id}:${branch.id}`,
        message: `A faixa "${branch.id}" tenta abrir um destino que não é permitido: ${branch.navigation}.`,
        path: `${flowId}.nodes.${node.id}.branches.${branch.id}.navigation`,
      });
    }
    const previousBranch = sortedBranches[index - 1];
    if (previousBranch && branch.min <= previousBranch.max) {
      issues.push({
        level: 'warning',
        area: 'flows',
        id: `overlapping-score-range:${flowId}:${node.id}:${branch.id}`,
        message: `A faixa "${branch.id}" sobrepõe outra faixa de pontuação neste redirecionamento.`,
        path: `${flowId}.nodes.${node.id}.branches.${branch.id}`,
      });
    }
  });
  return issues;
}
