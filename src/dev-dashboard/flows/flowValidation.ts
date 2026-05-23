import { validateFlow } from '../../domain/flow-engine/validateFlow';
import type { FlowEffect, GuidedFlow } from '../../domain/flow-engine/types';
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
