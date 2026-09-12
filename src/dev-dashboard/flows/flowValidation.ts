import { validateFlow } from '../../domain/flow-engine/validateFlow';
import type { GuidedFlow } from '../../domain/flow-engine/types';
import { createValidationResult, type DashboardValidationIssue } from '../validation/validationTypes';
import { findDuplicateIds } from '../validation/duplicateIds';
import { collectScoringKeys, validateFlowEffect, validateScoreBranch } from './flowEffectValidation';
import { toStructuralIssue } from './flowStructuralValidation';

const allowedNodeKinds = new Set(['choice', 'result', 'score_branch']);

export function validateDashboardFlows(flows: GuidedFlow[], resourceIds: string[]) {
  const issues: DashboardValidationIssue[] = [];
  const flowIds = new Set(flows.map((flow) => flow.id));
  const resourceSet = new Set(resourceIds);

  flows.forEach((flow) => {
    const validation = validateFlow(flow);
    validation.errors.forEach((message, index) => {
      issues.push({
        level: 'error',
        area: 'flows',
        id: `structural:${flow.id}:${index}`,
        ...toStructuralIssue(flow, message, index, validation.errors),
      });
    });
  });

  findDuplicateIds(flows.map((flow) => flow.id)).forEach((id) => {
    issues.push({
      level: 'error',
      area: 'flows',
      id: `duplicate-flow-id:${id}`,
      message: `Existe mais de um fluxo com o identificador "${id}". Remova um dos fluxos duplicados e crie-o novamente.`,
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
          message: 'Esta etapa usa um tipo incompatível com o painel. Troque o tipo da etapa antes de publicar.',
          path: `${flow.id}.nodes.${node.id}.kind`,
        });
      }
      if (node.kind === 'choice') {
        node.options.forEach((option) => {
          option.effects?.forEach((effect) => {
            issues.push(...validateFlowEffect(flow.id, node.id, option.id, effect, flowIds));
          });
        });
      }
      if (node.kind === 'score_branch') issues.push(...validateScoreBranch(flow.id, node, scoringKeys));
      if (node.kind === 'result') {
        node.recommendations?.forEach((recommendation) => {
          if (resourceSet.has(recommendation)) return;
          issues.push({
            level: 'error',
            area: 'flows',
            id: `missing-resource:${flow.id}:${node.id}:${recommendation}`,
            message: `Este resultado recomenda um material que não existe: ${recommendation}.`,
            path: `${flow.id}.nodes.${node.id}.recommendations`,
          });
        });
      }
    });
  });

  return createValidationResult(issues);
}
