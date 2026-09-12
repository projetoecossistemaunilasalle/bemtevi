import { describe, expect, it } from 'vitest';
import { parseGuidedFlow } from '../parseFlow';
import { validateFlow } from '../validateFlow';
import type { GuidedFlow } from '../types';
import { scoringFlow, validFlow } from './flowEngineFixtures';

describe('validateFlow', () => {
  it('accepts a JSON-compatible guided flow with explicit entering phrases', () => {
    expect(validateFlow(validFlow)).toEqual({ valid: true, errors: [] });
  });

  it('rejects invalid next references before runtime', () => {
    const invalidFlow: GuidedFlow = {
      ...validFlow,
      nodes: {
        ...validFlow.nodes,
        start: {
          ...validFlow.nodes.start,
          kind: 'choice',
          options: [{ id: 'missing', label: 'Ir para lugar ausente', next: 'missing-node' }],
        },
      },
    };

    expect(validateFlow(invalidFlow)).toEqual({
      valid: false,
      errors: ['A opção missing do fluxo fixture-flow aponta para um nó inexistente: missing-node.'],
    });
  });

  it('rejects invalid free-text next references before runtime', () => {
    const invalidFlow: GuidedFlow = {
      ...validFlow,
      nodes: {
        ...validFlow.nodes,
        start: {
          id: 'start',
          kind: 'choice',
          text: 'O que você quer testar?',
          options: [{ id: 'continue', label: 'Continuar', next: 'end' }],
          freeText: { next: 'missing-node' },
        },
      },
    };

    expect(validateFlow(invalidFlow)).toEqual({
      valid: false,
      errors: [
        'A opção de texto livre do nó start, no fluxo fixture-flow, aponta para um nó inexistente: missing-node.',
      ],
    });
  });
  it('returns validation errors for malformed JSON-shaped content instead of throwing', () => {
    expect(validateFlow({})).toEqual({
      valid: false,
      errors: [
        'O ID do fluxo é obrigatório.',
        'A entrada do fluxo é obrigatória.',
        'Os nós do fluxo são obrigatórios.',
      ],
    });
  });

  it('rejects node key and id mismatches', () => {
    const invalidFlow: GuidedFlow = {
      ...validFlow,
      nodes: {
        start: {
          ...validFlow.nodes.start,
          id: 'different-start',
        },
        end: validFlow.nodes.end,
      },
    };

    expect(validateFlow(invalidFlow).errors).toContain(
      'A chave do nó start no fluxo fixture-flow deve ser igual ao ID do nó different-start.',
    );
  });

  it('parses unknown JSON-shaped flow content into a typed guided flow', () => {
    const parsed = parseGuidedFlow(validFlow);

    expect(parsed.id).toBe('fixture-flow');
    expect(parsed.nodes.start.kind).toBe('choice');
  });

  it('rejects invalid JSON-shaped flow content at the parser boundary', () => {
    expect(() => parseGuidedFlow({ id: 'broken-flow' })).toThrow(
      'A entrada do fluxo é obrigatória. Os nós do fluxo são obrigatórios.',
    );
  });

  it('rejects score branch nodes with broken next references', () => {
    const invalidFlow: GuidedFlow = {
      ...scoringFlow,
      nodes: {
        ...scoringFlow.nodes,
        'score-branch': {
          id: 'score-branch',
          kind: 'score_branch',
          text: 'Calculando.',
          scoreKey: 'fixture-score',
          branches: [{ id: 'broken', min: 0, max: 1, next: 'missing-result' }],
        },
      },
    };

    expect(validateFlow(invalidFlow)).toEqual({
      valid: false,
      errors: [
        'A faixa broken do nó de ramificação score-branch, no fluxo scoring-flow, aponta para um nó inexistente: missing-result.',
      ],
    });
  });

  it('rejects score effects without a score key', () => {
    const invalidFlow: GuidedFlow = {
      ...scoringFlow,
      nodes: {
        ...scoringFlow.nodes,
        q1: {
          id: 'q1',
          kind: 'choice',
          text: 'Pergunta inválida.',
          options: [
            {
              id: 'bad',
              label: 'Inválida',
              next: 'score-branch',
              effects: [{ kind: 'score', scoreKey: '', value: 1 }],
            },
          ],
        },
      },
    };

    expect(validateFlow(invalidFlow)).toEqual({
      valid: false,
      errors: [
        'O efeito de pontuação da opção bad do fluxo scoring-flow precisa informar uma chave de pontuação (scoreKey) e um valor numérico.',
      ],
    });
  });

  it('accepts optional neutral flow purpose metadata', () => {
    const neutralFlow: GuidedFlow = {
      ...validFlow,
      id: 'neutral-flow',
      purpose: 'orientation_entry',
    };

    expect(validateFlow(neutralFlow)).toEqual({ valid: true, errors: [] });
  });

  it('rejects unknown flow purpose metadata', () => {
    const invalidFlow = {
      ...validFlow,
      purpose: 'diagnostic_router',
    };

    expect(validateFlow(invalidFlow).errors).toContain(
      'O propósito do fluxo fixture-flow deve ser um destes: orientation_entry, post_flow_routing.',
    );
  });

  it('validates deferred safety effects', () => {
    const invalidFlow: GuidedFlow = {
      ...validFlow,
      nodes: {
        start: {
          id: 'start',
          kind: 'choice',
          text: 'Você precisa de apoio?',
          options: [
            {
              id: 'yes',
              label: 'Sim',
              next: 'end',
              effects: [
                {
                  kind: 'deferred_safety',
                  flagKey: '',
                  message: '',
                  destination: '/privacidade' as '/apoio',
                },
              ],
            },
          ],
        },
        end: { id: 'end', kind: 'result', text: 'Fim.' },
      },
    };

    expect(validateFlow(invalidFlow).errors).toContain(
      'O efeito de segurança adiada da opção yes do fluxo fixture-flow precisa informar a chave de sinalização (flagKey), mensagem e destino permitido.',
    );
  });

  it('rejects malformed flow_start and navigate effects', () => {
    const invalidFlow = {
      ...validFlow,
      nodes: {
        ...validFlow.nodes,
        start: {
          ...validFlow.nodes.start,
          options: [
            {
              id: 'bad-start',
              label: 'Começar outro fluxo',
              next: 'end',
              effects: [
                { kind: 'flow_start', flowId: '' },
                { kind: 'navigate', destination: 'end' },
              ],
            },
          ],
        },
      },
    };

    expect(validateFlow(invalidFlow).errors).toContain(
      'O efeito de início de fluxo da opção bad-start do fluxo fixture-flow precisa informar o ID do fluxo de destino (flowId).',
    );
    expect(validateFlow(invalidFlow).errors).toContain(
      'O efeito de navegação da opção bad-start do fluxo fixture-flow precisa usar um destino permitido.',
    );
  });

  it('rejects unknown effect kinds', () => {
    const invalidFlow = {
      ...validFlow,
      nodes: {
        ...validFlow.nodes,
        start: {
          ...validFlow.nodes.start,
          options: [
            {
              id: 'bad-kind',
              label: 'Efeito desconhecido',
              next: 'end',
              effects: [{ kind: 'flow_statr', flowId: 'some-flow' }],
            },
          ],
        },
      },
    };

    expect(validateFlow(invalidFlow).errors).toContain(
      'A opção bad-kind do fluxo fixture-flow contém um tipo de efeito não suportado: "flow_statr".',
    );
  });
});
