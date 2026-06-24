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

const scoringResumeFlow: GuidedFlow = {
  id: 'scoring-resume-flow',
  version: '1.0.0',
  locale: 'pt-BR',
  title: 'Fluxo de pontuação suspenso',
  type: 'guided_conversation',
  status: 'draft',
  entry: {
    nodeId: 'q1',
    enteringPhrases: ['Quero testar pontuação suspensa'],
    transitionMessage: 'Vamos salvar a pontuação antes de trocar de fluxo.',
  },
  nodes: {
    q1: {
      id: 'q1',
      kind: 'choice',
      text: 'Você quer registrar um ponto?',
      options: [
        {
          id: 'yes',
          label: 'Sim',
          next: 'after-score',
          effects: [{ kind: 'score', scoreKey: 'fixture-resume-score', value: 1 }],
        },
        { id: 'no', label: 'Não', next: 'after-score' },
      ],
    },
    'after-score': {
      id: 'after-score',
      kind: 'choice',
      text: 'A pontuação já foi registrada. O que deseja fazer?',
      options: [{ id: 'score-branch', label: 'Ir para pontuação', next: 'score-branch' }],
    },
    'score-branch': {
      id: 'score-branch',
      kind: 'score_branch',
      text: 'Calculando o retorno salvo.',
      scoreKey: 'fixture-resume-score',
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
      errors: ['Flow fixture-flow choice node start freeText points to missing node missing-node.'],
    });
  });
  it('returns validation errors for malformed JSON-shaped content instead of throwing', () => {
    expect(validateFlow({})).toEqual({
      valid: false,
      errors: ['Flow id is required.', 'Flow entry is required.', 'Flow nodes are required.'],
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
      'Flow fixture-flow node key start must match node id different-start.',
    );
  });

  it('parses unknown JSON-shaped flow content into a typed guided flow', () => {
    const parsed = parseGuidedFlow(validFlow);

    expect(parsed.id).toBe('fixture-flow');
    expect(parsed.nodes.start.kind).toBe('choice');
  });

  it('rejects invalid JSON-shaped flow content at the parser boundary', () => {
    expect(() => parseGuidedFlow({ id: 'broken-flow' })).toThrow('Flow entry is required. Flow nodes are required.');
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
      'Flow fixture-flow purpose must be one of orientation_entry, post_flow_routing.',
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
      'Flow fixture-flow option yes deferred safety effect must include flagKey, message, and supported destination.',
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
      'Flow fixture-flow option bad-start flow_start effect must include flowId.',
    );
    expect(validateFlow(invalidFlow).errors).toContain(
      'Flow fixture-flow option bad-start navigate effect must include a supported destination.',
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
      'Flow fixture-flow option bad-kind has unsupported effect kind "flow_statr".',
    );
  });
});

const neutralRouterFlow: GuidedFlow = {
  id: 'neutral-router',
  version: '1.0.0',
  locale: 'pt-BR',
  title: 'Roteador neutro',
  type: 'guided_conversation',
  purpose: 'orientation_entry',
  status: 'draft',
  entry: {
    nodeId: 'start',
    enteringPhrases: ['Quero escolher um caminho'],
    transitionMessage: 'Vamos escolher com calma.',
  },
  nodes: {
    start: {
      id: 'start',
      kind: 'choice',
      text: 'O que parece fazer sentido agora?',
      options: [
        {
          id: 'start-specific',
          label: 'Falar sobre sobrecarga',
          next: 'handoff',
          effects: [{ kind: 'flow_start', flowId: 'fixture-flow' }],
        },
      ],
    },
    handoff: {
      id: 'handoff',
      kind: 'result',
      text: 'Vou abrir outro caminho.',
    },
  },
};

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

  it('advances free text without storing the raw answer when a node explicitly allows it', () => {
    const freeTextFlow: GuidedFlow = {
      ...validFlow,
      nodes: {
        start: {
          id: 'start',
          kind: 'choice',
          text: 'Quer escrever algo livremente?',
          freeText: { next: 'end' },
          options: [{ id: 'skip', label: 'Prefiro pular', next: 'end' }],
        },
        end: {
          id: 'end',
          kind: 'result',
          text: 'Seguimos com calma.',
        },
      },
    };

    const nextState = advanceFlow(createInitialFlowState(freeTextFlow, [freeTextFlow]), [freeTextFlow], 'Foi difícil.');

    expect(nextState.activeNodeId).toBe('end');
    expect(nextState.answers).toEqual({ start: 'free_text_submitted' });
    expect(nextState.transcript.map((message) => message.text)).toContain('Foi difícil.');
    expect(nextState.transcript.at(-1)?.text).toBe('Seguimos com calma.');
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

  it('switches flows through another flow entry phrase without merging answers or dropping transcript', () => {
    const answeredState = advanceFlow(
      createInitialFlowState(validFlow, [validFlow, secondFlow]),
      [validFlow, secondFlow],
      'Continuar',
    );
    const switchedState = advanceFlow(answeredState, [validFlow, secondFlow], 'Quero trocar de assunto');

    expect(switchedState.activeFlowId).toBe('second-flow');
    expect(switchedState.activeNodeId).toBe('start');
    expect(switchedState.answers).toEqual({});
    expect(switchedState.suspendedFlows['fixture-flow']?.answers).toEqual({ start: 'continue' });
    expect(switchedState.transcript.map((message) => message.text)).toEqual([
      'Vamos começar com calma.',
      'O que você quer testar?',
      'Continuar',
      'Chegamos ao fim.',
      'Quero trocar de assunto',
      'Vamos olhar para outro ponto com calma.',
      'Por onde você quer começar?',
    ]);
  });

  it('offers resume only from result nodes when safety rules allow it', () => {
    const switchedState = advanceFlow(
      createInitialFlowState(validFlow, [validFlow, secondFlow]),
      [validFlow, secondFlow],
      'Quero trocar de assunto',
    );
    const finishedSecondFlow = advanceFlow(switchedState, [validFlow, secondFlow], 'Finalizar este caminho');

    expect(resolveOptions(finishedSecondFlow, [validFlow, secondFlow]).map((option) => option.label)).toContain(
      'Retomar Fluxo de teste',
    );

    const safetyBlockedState = {
      ...finishedSecondFlow,
      safetyFlags: { 'block-resume:fixture-flow': true },
    };

    expect(resolveOptions(safetyBlockedState, [validFlow, secondFlow]).map((option) => option.label)).not.toContain(
      'Retomar Fluxo de teste',
    );
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
    const resumed = resumeFlow(
      {
        ...suspended,
        activeFlowId: undefined,
        activeNodeId: undefined,
        transcript: [
          ...suspended.transcript,
          {
            id: 'second-flow-extra-message',
            sender: 'bot',
            text: 'Outro caminho terminou.',
            flowId: 'second-flow',
          },
        ],
      },
      'fixture-flow',
    );

    expect(resumed.activeFlowId).toBe('fixture-flow');
    expect(resumed.activeNodeId).toBe('start');
    expect(resumed.transcript.map((message) => message.text)).toContain('Outro caminho terminou.');
  });

  it('applies generic score effects and resolves score branches without React-specific logic', () => {
    const initialState = createInitialFlowState(scoringFlow, [scoringFlow]);
    const nextState = advanceFlow(initialState, [scoringFlow], 'Sim');

    expect(nextState.scores['fixture-score']).toBe(1);
    expect(nextState.activeNodeId).toBe('high-result');
    expect(nextState.transcript.map((message) => message.text)).toContain('Resultado alto.');
  });

  it('restores suspended scores before resuming a score branch', () => {
    const flows = [scoringResumeFlow, secondFlow];
    let state = createInitialFlowState(scoringResumeFlow, flows);

    state = advanceFlow(state, flows, 'Sim');

    expect(state.activeFlowId).toBe('scoring-resume-flow');
    expect(state.activeNodeId).toBe('after-score');
    expect(state.scores['fixture-resume-score']).toBe(1);

    const suspended = suspendFlow(state);

    expect(suspended.suspendedFlows['scoring-resume-flow']?.scores).toEqual({ 'fixture-resume-score': 1 });

    state = advanceFlow(suspended, flows, 'Quero trocar de assunto');

    expect(state.activeFlowId).toBe('second-flow');
    expect(state.scores).toEqual({});

    const resumed = resumeFlow({ ...state, scores: { 'fixture-resume-score': 0 } }, 'scoring-resume-flow');

    expect(resumed.activeFlowId).toBe('scoring-resume-flow');
    expect(resumed.activeNodeId).toBe('after-score');
    expect(resumed.scores).toEqual({ 'fixture-resume-score': 1 });

    const branchedState = advanceFlow(resumed, flows, 'Ir para pontuação');

    expect(branchedState.activeNodeId).toBe('high-result');
    expect(branchedState.transcript.map((message) => message.text)).toContain('Resultado alto.');
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
    expect(nextState.transcript.map((message) => message.text)).not.toContain(
      'Este texto não deve aparecer antes do apoio.',
    );
  });

  it('records deferred safety routing and continues until the result node', () => {
    const deferredSafetyFlow: GuidedFlow = {
      ...scoringFlow,
      id: 'deferred-safety-flow',
      title: 'Fluxo com segurança ao final',
      nodes: {
        q1: {
          id: 'q1',
          kind: 'choice',
          text: 'Você precisa de apoio?',
          options: [
            {
              id: 'yes',
              label: 'Sim',
              next: 'q2',
              effects: [
                {
                  kind: 'deferred_safety',
                  flagKey: 'self_harm_ideation',
                  message:
                    'Obrigado por responder com sinceridade. Vamos abrir a página de apoio depois do resultado.',
                  destination: '/apoio',
                },
              ],
            },
            { id: 'no', label: 'Não', next: 'q2' },
          ],
        },
        q2: {
          id: 'q2',
          kind: 'choice',
          text: 'Última pergunta.',
          options: [{ id: 'finish', label: 'Finalizar', next: 'result' }],
        },
        result: { id: 'result', kind: 'result', text: 'Resultado calculado.' },
      },
    };

    let state = createInitialFlowState(deferredSafetyFlow, [deferredSafetyFlow]);
    state = advanceFlow(state, [deferredSafetyFlow], 'Sim');

    expect(state.activeNodeId).toBe('q2');
    expect(state.pendingNavigation).toBeUndefined();
    expect(state.safetyFlags.self_harm_ideation).toBe(true);
    expect(state.deferredNavigation).toEqual({
      destination: '/apoio',
      message:
        'Obrigado por responder com sinceridade. Vamos abrir a página de apoio depois do resultado.',
      reason: 'self_harm_ideation',
    });

    state = advanceFlow(state, [deferredSafetyFlow], 'Finalizar');

    expect(state.activeNodeId).toBe('result');
    expect(state.pendingNavigation).toBe('/apoio');
    expect(state.transcript.map((message) => message.text)).toContain('Resultado calculado.');
    expect(state.transcript.map((message) => message.text)).toContain(
      'Obrigado por responder com sinceridade. Vamos abrir a página de apoio depois do resultado.',
    );
  });

  it('ends the flow when an end_flow effect is applied', () => {
    const endFlowFixture: GuidedFlow = {
      ...validFlow,
      nodes: {
        start: {
          id: 'start',
          kind: 'choice',
          text: 'O que deseja fazer?',
          options: [
            {
              id: 'end-today',
              label: 'Finalizar por hoje',
              next: 'end',
              effects: [{ kind: 'end_flow', message: 'Até a próxima.' }],
            },
          ],
        },
        end: {
          id: 'end',
          kind: 'result',
          text: 'Este texto não deve aparecer.',
        },
      },
    };

    const nextState = advanceFlow(
      createInitialFlowState(endFlowFixture, [endFlowFixture]),
      [endFlowFixture],
      'Finalizar por hoje',
    );

    expect(nextState.activeFlowId).toBeUndefined();
    expect(nextState.activeNodeId).toBeUndefined();
    expect(nextState.transcript.map((m) => m.text)).toContain('Até a próxima.');
    expect(nextState.transcript.map((m) => m.text)).not.toContain('Este texto não deve aparecer.');
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
    state = advanceFlow(state, flowRegistry.flows, 'Continuar');

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

  it('rejects registered flow_start targets that do not exist', () => {
    const invalidFlow: GuidedFlow = {
      ...validFlow,
      nodes: {
        ...validFlow.nodes,
        start: {
          ...(validFlow.nodes.start as import('../types').ChoiceFlowNode),
          options: [
            {
              id: 'missing-flow',
              label: 'Ir para outro fluxo',
              next: 'end',
              effects: [{ kind: 'flow_start', flowId: 'missing-target' }],
            },
          ],
        },
      },
    };

    expect(() => createInitialFlowStateFromRegistry([invalidFlow], 'fixture-flow')).toThrow(
      'Flow fixture-flow option missing-flow starts missing flow missing-target.',
    );
  });

  it('runs SRQ-20 Q17 affirmative through deferred support routing after the final result', () => {
    let state = createInitialFlowStateFromRegistry(flowRegistry.flows, 'srq20');

    state = advanceFlow(state, flowRegistry.flows, 'Quero responder');
    state = advanceFlow(state, flowRegistry.flows, 'Continuar');

    for (let question = 1; question <= 16; question++) {
      state = advanceFlow(state, flowRegistry.flows, 'Não');
    }

    state = advanceFlow(state, flowRegistry.flows, 'Sim');

    expect(state.activeNodeId).toBe('q18');
    expect(state.pendingNavigation).toBeUndefined();
    expect(state.safetyFlags.self_harm_ideation).toBe(true);

    state = advanceFlow(state, flowRegistry.flows, 'Não');
    state = advanceFlow(state, flowRegistry.flows, 'Não');
    state = advanceFlow(state, flowRegistry.flows, 'Não');

    expect(state.activeNodeId).toBe('low-distress-result');
    expect(state.pendingNavigation).toBe('/apoio');
    expect(state.transcript.map((message) => message.text)).toContain(
      'Obrigado por responder com sinceridade. Como você marcou um sinal que merece cuidado imediato, vamos abrir a página de apoio agora. Você não está sozinho(a).',
    );
  });

  it('starts a target flow from a neutral flow option without suspending the neutral flow', () => {
    const state = createInitialFlowState(neutralRouterFlow, [neutralRouterFlow, validFlow]);
    const nextState = advanceFlow(state, [neutralRouterFlow, validFlow], 'Falar sobre sobrecarga');

    expect(nextState.activeFlowId).toBe('fixture-flow');
    expect(nextState.activeNodeId).toBe('start');
    expect(nextState.suspendedFlows['neutral-router']).toBeUndefined();
    expect(nextState.transcript.map((message) => message.text)).toContain('Falar sobre sobrecarga');
    // The target flow starts immediately, so its entry transition appears in the same transcript.
    expect(nextState.transcript.map((message) => message.text)).toContain(validFlow.entry.transitionMessage);
  });

  it('navigates directly from neutral flow options that target app destinations', () => {
    const navigationFlow: GuidedFlow = {
      ...neutralRouterFlow,
      nodes: {
        start: {
          id: 'start',
          kind: 'choice',
          text: 'O que você quer abrir?',
          options: [
            {
              id: 'education',
              label: 'Abrir materiais educativos',
              next: 'fallback',
              effects: [{ kind: 'navigate', destination: '/educacao' }],
            },
          ],
        },
        fallback: {
          id: 'fallback',
          kind: 'result',
          text: 'Abrindo materiais educativos.',
        },
      },
    };
    const state = createInitialFlowState(navigationFlow, [navigationFlow, validFlow]);
    const nextState = advanceFlow(state, [navigationFlow, validFlow], 'Abrir materiais educativos');

    expect(nextState.activeFlowId).toBeUndefined();
    expect(nextState.activeNodeId).toBeUndefined();
    expect(nextState.pendingNavigation).toBe('/educacao');
    expect(nextState.transcript.map((message) => message.text)).toContain('Abrir materiais educativos');
  });

  it('offers post-flow routing after regular result nodes', () => {
    const postFlowRouter: GuidedFlow = {
      ...neutralRouterFlow,
      id: 'post-flow-next-step',
      purpose: 'post_flow_routing',
    };
    const flows = [validFlow, neutralRouterFlow, postFlowRouter];
    const state = createInitialFlowState(validFlow, flows);
    const resultState = advanceFlow(state, flows, 'Continuar');

    expect(resolveOptions(resultState, flows)).toContainEqual({
      kind: 'flow_start',
      id: 'post-flow-next-step-start',
      label: 'Escolher o que fazer agora',
      flowId: 'post-flow-next-step',
    });
  });

  it('does not offer post-flow routing from the post-flow router itself', () => {
    const postFlowRouter: GuidedFlow = {
      ...neutralRouterFlow,
      id: 'post-flow-next-step',
      purpose: 'post_flow_routing',
      nodes: {
        start: {
          id: 'start',
          kind: 'choice',
          text: 'Qual próximo passo você prefere?',
          options: [
            {
              id: 'end',
              label: 'Finalizar por hoje',
              next: 'done',
            },
          ],
        },
        done: {
          id: 'done',
          kind: 'result',
          text: 'Tudo bem. Você pode voltar quando quiser.',
        },
      },
    };
    const state = createInitialFlowState(postFlowRouter, [postFlowRouter, validFlow]);
    const resultState = advanceFlow(state, [postFlowRouter, validFlow], 'Finalizar por hoje');

    expect(resolveOptions(resultState, [postFlowRouter, validFlow])).not.toContainEqual(
      expect.objectContaining({ id: 'post-flow-next-step-start' }),
    );
  });

  it('does not offer post-flow routing from orientation neutral flow results', () => {
    const orientationFlow: GuidedFlow = {
      ...neutralRouterFlow,
      nodes: {
        start: {
          id: 'start',
          kind: 'choice',
          text: 'Qual próximo passo você prefere?',
          options: [
            {
              id: 'end',
              label: 'Finalizar por hoje',
              next: 'done',
            },
          ],
        },
        done: {
          id: 'done',
          kind: 'result',
          text: 'Tudo bem. Você pode voltar quando quiser.',
        },
      },
    };
    const postFlowRouter: GuidedFlow = {
      ...neutralRouterFlow,
      id: 'post-flow-next-step',
      purpose: 'post_flow_routing',
    };
    const flows = [orientationFlow, postFlowRouter, validFlow];
    const state = createInitialFlowState(orientationFlow, flows);
    const resultState = advanceFlow(state, flows, 'Finalizar por hoje');

    expect(resolveOptions(resultState, flows)).not.toContainEqual(
      expect.objectContaining({ id: 'post-flow-next-step-start' }),
    );
  });
});
