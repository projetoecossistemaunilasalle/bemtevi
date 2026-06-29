import { validateFlow } from '../../domain/flow-engine/validateFlow';
import type { FlowEffect, GuidedFlow, ScoreBranchFlowNode } from '../../domain/flow-engine/types';
import { createValidationResult, type DashboardValidationIssue } from '../validation/validationTypes';
import { findDuplicateIds } from '../validation/duplicateIds';

const allowedNavigateDestinations = new Set(['/apoio', '/contatos', '/educacao']);
const allowedNodeKinds = new Set(['choice', 'result', 'score_branch']);

export function validateDashboardFlows(flows: GuidedFlow[], resourceIds: string[]) {
  const issues: DashboardValidationIssue[] = [];
  const flowIds = new Set(flows.map((flow) => flow.id));
  const resourceSet = new Set(resourceIds);

  flows.forEach((flow) => {
    validateFlow(flow).errors.forEach((message, index) => {
      issues.push({
        level: 'error',
        area: 'flows',
        id: `structural:${flow.id}:${index}`,
        message,
      });
    });
  });

  findDuplicateIds(flows.map((flow) => flow.id)).forEach((id) => {
    issues.push({
      level: 'error',
      area: 'flows',
      id: `duplicate-flow-id:${id}`,
      message: `Existe mais de um fluxo com o ID "${id}".`,
    });
  });

  flows.forEach((flow) => {
    const scoringKeys = collectScoringKeys(flow);

    Object.values(flow.nodes).forEach((node) => {
      if (!allowedNodeKinds.has(node.kind)) {
        issues.push({
          level: 'error',
          area: 'flows',
          id: `unsupported-node-kind:${flow.id}:${node.id}`,
          message: `Esta etapa usa um tipo que o dashboard não entende: ${node.kind}.`,
          path: `${flow.id}.nodes.${node.id}.kind`,
        });
      }

      if (node.kind === 'choice') {
        node.options.forEach((option) => {
          (option.effects ?? []).forEach((effect) => {
            issues.push(...validateEffect(flow.id, node.id, option.id, effect, flowIds));
          });
        });
      }

      if (node.kind === 'score_branch') {
        issues.push(...validateScoreBranch(flow.id, node, scoringKeys));
      }

      if (node.kind === 'result') {
        (node.recommendations ?? []).forEach((recommendation) => {
          if (!resourceSet.has(recommendation)) {
            issues.push({
              level: 'error',
              area: 'flows',
              id: `missing-resource:${flow.id}:${node.id}:${recommendation}`,
              message: `Este resultado recomenda um material que não existe: ${recommendation}.`,
              path: `${flow.id}.nodes.${node.id}.recommendations`,
            });
          }
        });
      }
    });
  });

  return createValidationResult(issues);
}

function validateEffect(
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

function collectScoringKeys(flow: GuidedFlow) {
  const keys = new Set<string>();

  Object.values(flow.nodes).forEach((node) => {
    if (node.kind !== 'choice') return;

    node.options.forEach((option) => {
      option.effects?.forEach((effect) => {
        if (effect.kind === 'score' && effect.scoreKey.trim()) {
          keys.add(effect.scoreKey);
        }
      });
    });
  });

  return keys;
}

function validateScoreBranch(
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

  const sortedBranches = [...node.branches].sort((a, b) => a.min - b.min || a.max - b.max);
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
