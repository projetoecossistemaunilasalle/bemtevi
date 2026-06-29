import { describe, expect, it } from 'vitest';
import type { GuidedFlow } from '../../domain/flow-engine/types';
import { validateDashboardFlows } from '../flows/flowValidation';

const baseFlow: GuidedFlow = {
  id: 'base-flow',
  version: '1.0.0',
  locale: 'pt-BR',
  title: 'Fluxo base',
  type: 'guided_conversation',
  status: 'draft',
  entry: {
    nodeId: 'start',
    enteringPhrases: ['Começar fluxo base'],
    transitionMessage: 'Vamos começar.',
  },
  nodes: {
    start: {
      id: 'start',
      kind: 'choice',
      text: 'Escolha uma opção.',
      options: [{ id: 'continue', label: 'Continuar', next: 'end' }],
    },
    end: {
      id: 'end',
      kind: 'result',
      text: 'Resultado final.',
      recommendations: ['known-resource'],
    },
  },
};

describe('validateDashboardFlows', () => {
  it('rejects duplicate flow IDs', () => {
    const result = validateDashboardFlows([baseFlow, { ...baseFlow }], ['known-resource']);

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        id: 'duplicate-flow-id:base-flow',
        message: 'Existe mais de um fluxo com o ID "base-flow".',
      }),
    );
  });

  it('rejects missing flow_start targets', () => {
    const result = validateDashboardFlows(
      [
        {
          ...baseFlow,
          nodes: {
            ...baseFlow.nodes,
            start: {
              id: 'start',
              kind: 'choice',
              text: 'Escolha uma opção.',
              options: [
                {
                  id: 'handoff',
                  label: 'Começar outro fluxo',
                  next: 'end',
                  effects: [{ kind: 'flow_start', flowId: 'missing-flow' }],
                },
              ],
            },
          },
        },
      ],
      ['known-resource'],
    );

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        id: 'missing-flow-start:base-flow:start:handoff',
        message: 'Esta opção tenta começar um fluxo que não existe: missing-flow.',
      }),
    );
  });

  it('rejects missing recommendation resources', () => {
    const result = validateDashboardFlows([baseFlow], []);

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        id: 'missing-resource:base-flow:end:known-resource',
        message: 'Este resultado recomenda um material que não existe: known-resource.',
      }),
    );
  });

  it('warns when score branch ranges overlap or use a score key with no scoring options', () => {
    const result = validateDashboardFlows(
      [
        {
          ...baseFlow,
          nodes: {
            start: {
              id: 'start',
              kind: 'choice',
              text: 'Escolha uma opção.',
              options: [{ id: 'continue', label: 'Continuar', next: 'score' }],
            },
            score: {
              id: 'score',
              kind: 'score_branch',
              text: 'Calculando.',
              scoreKey: 'missing-score',
              branches: [
                { id: 'low', min: 0, max: 5, next: 'end' },
                { id: 'high', min: 5, max: 10, next: 'end', navigation: '/apoio' },
              ],
            },
            end: baseFlow.nodes.end,
          },
        },
      ],
      ['known-resource'],
    );

    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        id: 'unused-score-key:base-flow:score:missing-score',
        message: 'Esta ramificação usa a pontuação "missing-score", mas nenhuma opção soma pontos nessa chave.',
      }),
    );
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        id: 'overlapping-score-range:base-flow:score:high',
        message: 'A faixa "high" sobrepõe outra faixa de pontuação neste redirecionamento.',
      }),
    );
  });
});
