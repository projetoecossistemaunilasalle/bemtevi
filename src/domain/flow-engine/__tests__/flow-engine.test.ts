import { describe, expect, it } from 'vitest';
import { advanceFlow } from '../advanceFlow';
import { createInitialFlowState, createInitialFlowStateFromRegistry } from '../loadFlows';
import { resolveOptions } from '../resolveOptions';
import { resumeFlow } from '../resumeFlow';
import { suspendFlow } from '../suspendFlow';
import { parseGuidedFlow } from '../parseFlow';
import { validateFlow } from '../validateFlow';
import { flowRegistry } from '../../../content/flows/registry';
import type { GuidedFlow } from '../types';

const validFlow: GuidedFlow = {
  id: 'fixture-flow',
  version: '1.0.0',
  locale: 'pt-BR',
  title: 'Fluxo de teste',
  type: 'guided_conversation',
  status: 'draft',
  entry: {
    nodeId: 'start',
    enteringPhrases: ['Quero começar o fluxo de teste'],
    transitionMessage: 'Vamos começar com calma.',
  },
  nodes: {
    start: {
      id: 'start',
      kind: 'choice',
      text: 'O que você quer testar?',
      options: [{ id: 'continue', label: 'Continuar', next: 'end' }],
    },
    end: {
      id: 'end',
      kind: 'result',
      text: 'Chegamos ao fim.',
      recommendations: ['respiracao-professores'],
    },
  },
};

const scoringFlow: GuidedFlow = {
  id: 'scoring-flow',
  version: '1.0.0',
  locale: 'pt-BR',
  title: 'Fluxo com pontuação',
  type: 'guided_conversation',
  status: 'draft',
  entry: {
    nodeId: 'q1',
    enteringPhrases: ['Quero testar pontuação'],
    transitionMessage: 'Vamos testar uma pergunta com pontuação.',
  },
  nodes: {
    q1: {
      id: 'q1',
      kind: 'choice',
      text: 'Você quer somar um ponto?',
      options: [
        {
          id: 'yes',
          label: 'Sim',
          next: 'score-branch',
          effects: [{ kind: 'score', scoreKey: 'fixture-score', value: 1 }],
        },
        {
          id: 'no',
          label: 'Não',
          next: 'score-branch',
        },
      ],
    },
    'score-branch': {
      id: 'score-branch',
      kind: 'score_branch',
      text: 'Calculando o melhor retorno.',
      scoreKey: 'fixture-score',
      branches: [
        { id: 'low', min: 0, max: 0, next: 'low-result' },
        { id: 'high', min: 1, max: 20, next: 'high-result' },
      ],
    },
    'low-result': {
      id: 'low-result',
      kind: 'result',
      text: 'Resultado baixo.',
    },
    'high-result': {
      id: 'high-result',
      kind: 'result',
      text: 'Resultado alto.',
    },
  },
};

const secondFlow: GuidedFlow = {
  id: 'second-flow',
  version: '1.0.0',
  locale: 'pt-BR',
  title: 'Segundo fluxo',
  type: 'guided_conversation',
  status: 'draft',
  entry: {
    nodeId: 'start',
    enteringPhrases: ['Quero trocar de assunto'],
    transitionMessage: 'Vamos olhar para outro ponto com calma.',
  },
  nodes: {
    start: {
      id: 'start',
      kind: 'choice',
      text: 'Por onde você quer começar?',
      options: [{ id: 'finish', label: 'Finalizar este caminho', next: 'end' }],
    },
    end: {
      id: 'end',
      kind: 'result',
      text: 'Este caminho terminou.',
    },
  },
};

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
      errors: ['Flow fixture-flow option missing points to missing node missing-node.'],
    });
  });

  it('returns validation errors for malformed JSON-shaped content instead of throwing', () => {
    expect(validateFlow({})).toEqual({
      valid: false,
      errors: [
        'Flow id is required.',
        'Flow entry is required.',
        'Flow nodes are required.',
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

    expect(validateFlow(invalidFlow).errors).toContain('Flow fixture-flow node key start must match node id different-start.');
  });

  it('parses unknown JSON-shaped flow content into a typed guided flow', () => {
    const parsed = parseGuidedFlow(validFlow);

    expect(parsed.id).toBe('fixture-flow');
    expect(parsed.nodes.start.kind).toBe('choice');
  });

  it('rejects invalid JSON-shaped flow content at the parser boundary', () => {
    expect(() => parseGuidedFlow({ id: 'broken-flow' })).toThrow(
      'Flow entry is required. Flow nodes are required.',
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
      errors: ['Flow scoring-flow score branch score-branch branch broken points to missing node missing-result.'],
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
      errors: ['Flow scoring-flow option bad score effect must include scoreKey and numeric value.'],
    });
  });
});

describe('flow runtime', () => {
  it('starts a flow with the entry transition and current node prompt', () => {
    const state = createInitialFlowState(validFlow, [validFlow]);

    expect(state.activeFlowId).toBe('fixture-flow');
    expect(state.activeNodeId).toBe('start');
    expect(state.transcript.map((message) => message.text)).toEqual([
      'Vamos começar com calma.',
      'O que você quer testar?',
    ]);
  });

  it('advances only through currently available options', () => {
    const state = createInitialFlowState(validFlow, [validFlow]);

    expect(() => advanceFlow(state, [validFlow], 'Resposta livre')).toThrow(
      'Selection Resposta livre is not available for node start.',
    );

    const nextState = advanceFlow(state, [validFlow], 'Continuar');

    expect(nextState.activeNodeId).toBe('end');
    expect(nextState.transcript.at(-1)?.text).toBe('Chegamos ao fim.');
  });

  it('resolves current options and global actions', () => {
    const state = createInitialFlowState(validFlow, [validFlow]);
    const labels = resolveOptions(state, [validFlow]).map((option) => option.label);

    expect(labels).toContain('Continuar');
    expect(labels).toContain('Quero apoio agora');
  });

  it('validates every registered flow before creating initial state', () => {
    const invalidRegisteredFlow: GuidedFlow = {
      ...secondFlow,
      nodes: {
        ...secondFlow.nodes,
        start: {
          ...secondFlow.nodes.start,
          kind: 'choice',
          options: [{ id: 'bad', label: 'Opção inválida', next: 'missing' }],
        },
      },
    };

    expect(() => createInitialFlowStateFromRegistry([validFlow, invalidRegisteredFlow], 'fixture-flow')).toThrow(
      'Flow second-flow option bad points to missing node missing.',
    );
  });

  it('switches flows through another flow entry phrase without merging answers', () => {
    const answeredState = advanceFlow(createInitialFlowState(validFlow, [validFlow, secondFlow]), [validFlow, secondFlow], 'Continuar');
    const switchedState = advanceFlow(answeredState, [validFlow, secondFlow], 'Quero trocar de assunto');

    expect(switchedState.activeFlowId).toBe('second-flow');
    expect(switchedState.activeNodeId).toBe('start');
    expect(switchedState.answers).toEqual({});
    expect(switchedState.suspendedFlows['fixture-flow']?.answers).toEqual({ start: 'continue' });
    expect(switchedState.transcript.map((message) => message.text)).toEqual([
      'Vamos olhar para outro ponto com calma.',
      'Por onde você quer começar?',
    ]);
  });

  it('offers resume only from result nodes when safety rules allow it', () => {
    const switchedState = advanceFlow(createInitialFlowState(validFlow, [validFlow, secondFlow]), [validFlow, secondFlow], 'Quero trocar de assunto');
    const finishedSecondFlow = advanceFlow(switchedState, [validFlow, secondFlow], 'Finalizar este caminho');

    expect(resolveOptions(finishedSecondFlow, [validFlow, secondFlow]).map((option) => option.label)).toContain('Retomar Fluxo de teste');

    const safetyBlockedState = {
      ...finishedSecondFlow,
      safetyFlags: { 'block-resume:fixture-flow': true },
    };

    expect(resolveOptions(safetyBlockedState, [validFlow, secondFlow]).map((option) => option.label)).not.toContain('Retomar Fluxo de teste');
  });

  it('ends the active flow when the end action is selected', () => {
    const state = createInitialFlowState(validFlow, [validFlow]);
    const endedState = advanceFlow(state, [validFlow], 'Encerrar por enquanto');

    expect(endedState.activeFlowId).toBeUndefined();
    expect(endedState.activeNodeId).toBeUndefined();
    expect(endedState.transcript.at(-1)?.text).toBe('Tudo bem. Você pode retomar uma orientação quando quiser.');
    expect(resolveOptions(endedState, [validFlow]).some((option) => option.kind === 'node_option')).toBe(false);
  });

  it('suspends and resumes a flow in memory', () => {
    const state = createInitialFlowState(validFlow, [validFlow]);
    const suspended = suspendFlow(state);
    const resumed = resumeFlow({ ...suspended, activeFlowId: undefined, activeNodeId: undefined }, 'fixture-flow');

    expect(resumed.activeFlowId).toBe('fixture-flow');
    expect(resumed.activeNodeId).toBe('start');
  });

  it('applies generic score effects and resolves score branches without React-specific logic', () => {
    const initialState = createInitialFlowState(scoringFlow, [scoringFlow]);
    const nextState = advanceFlow(initialState, [scoringFlow], 'Sim');

    expect(nextState.scores['fixture-score']).toBe(1);
    expect(nextState.activeNodeId).toBe('high-result');
    expect(nextState.transcript.map((message) => message.text)).toContain('Resultado alto.');
  });

  it('resolves score branches using zero when the score key has not been set', () => {
    const initialState = createInitialFlowState(scoringFlow, [scoringFlow]);
    const nextState = advanceFlow(initialState, [scoringFlow], 'Não');

    expect(nextState.scores['fixture-score']).toBeUndefined();
    expect(nextState.activeNodeId).toBe('low-result');
    expect(nextState.transcript.map((message) => message.text)).toContain('Resultado baixo.');
  });

  it('handles safety interruption as a generic JSON option effect', () => {
    const safetyFlow: GuidedFlow = {
      ...scoringFlow,
      id: 'safety-flow',
      title: 'Fluxo com segurança',
      entry: {
        nodeId: 'q1',
        enteringPhrases: ['Quero testar segurança'],
        transitionMessage: 'Vamos testar segurança.',
      },
      nodes: {
        q1: {
          id: 'q1',
          kind: 'choice',
          text: 'Você precisa de apoio agora?',
          options: [
            {
              id: 'yes',
              label: 'Sim',
              next: 'high-result',
              effects: [
                {
                  kind: 'safety_interrupt',
                  message: 'Vamos te direcionar para apoio imediato.',
                  destination: '/apoio',
                  blockResume: true,
                },
              ],
            },
            { id: 'no', label: 'Não', next: 'low-result' },
          ],
        },
        'low-result': {
          id: 'low-result',
          kind: 'result',
          text: 'Seguimos com calma.',
        },
        'high-result': {
          id: 'high-result',
          kind: 'result',
          text: 'Este texto não deve aparecer antes do apoio.',
        },
      },
    };

    const nextState = advanceFlow(createInitialFlowState(safetyFlow, [safetyFlow]), [safetyFlow], 'Sim');

    expect(nextState.pendingNavigation).toBe('/apoio');
    expect(nextState.activeFlowId).toBeUndefined();
    expect(nextState.activeNodeId).toBeUndefined();
    expect(nextState.safetyFlags['block-resume:safety-flow']).toBe(true);
    expect(nextState.transcript.map((message) => message.text)).toContain('Vamos te direcionar para apoio imediato.');
    expect(nextState.transcript.map((message) => message.text)).not.toContain('Este texto não deve aparecer antes do apoio.');
  });

  it('discovers JSON flows from the content folder without per-flow imports', () => {
    const flowIds = flowRegistry.flows.map((flow) => flow.id);

    expect(flowIds).toContain('srq20');
  });

  it('registers SRQ-20 from JSON as a normal guided flow entry phrase', () => {
    const state = createInitialFlowStateFromRegistry(flowRegistry.flows, 'work-stress');
    const labels = resolveOptions(state, flowRegistry.flows).map((option) => option.label);

    expect(labels).toContain('Quero responder o SRQ-20');
  });

  it('runs SRQ-20 JSON through the generic flow engine and resolves possible distress at score 7', () => {
    let state = createInitialFlowStateFromRegistry(flowRegistry.flows, 'srq20');

    state = advanceFlow(state, flowRegistry.flows, 'Quero responder');

    for (let index = 0; index < 7; index += 1) {
      state = advanceFlow(state, flowRegistry.flows, 'Sim');
    }

    for (let index = 7; index < 20; index += 1) {
      state = advanceFlow(state, flowRegistry.flows, 'Não');
    }

    expect(state.activeNodeId).toBe('possible-distress-result');
    expect(state.scores.srq20).toBe(7);
    expect(state.transcript.at(-1)?.text).toContain('não é um diagnóstico');
  });

  it('routes SRQ-20 Q17 affirmative through generic JSON safety interruption', () => {
    let state = createInitialFlowStateFromRegistry(flowRegistry.flows, 'srq20');

    state = advanceFlow(state, flowRegistry.flows, 'Quero responder');

    for (let index = 0; index < 16; index += 1) {
      state = advanceFlow(state, flowRegistry.flows, 'Não');
    }

    state = advanceFlow(state, flowRegistry.flows, 'Sim');

    expect(state.pendingNavigation).toBe('/apoio');
    expect(state.safetyFlags['block-resume:srq20']).toBe(true);
    expect(state.activeFlowId).toBeUndefined();
  });
});
