import { describe, expect, it } from 'vitest';
import { advanceFlow } from '../advanceFlow';
import { createInitialFlowState, createInitialFlowStateFromRegistry } from '../loadFlows';
import { resolveOptions } from '../resolveOptions';
import { resumeFlow } from '../resumeFlow';
import { suspendFlow } from '../suspendFlow';
import type { GuidedFlow } from '../types';
import { scoringFlow, scoringResumeFlow, secondFlow, validFlow } from './flowEngineFixtures';

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
      'A opção bad do fluxo second-flow aponta para um nó inexistente: missing.',
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

  it('sets score branch navigation after showing the branch result', () => {
    const navigationFlow: GuidedFlow = {
      ...scoringFlow,
      nodes: {
        ...scoringFlow.nodes,
        'score-branch': {
          id: 'score-branch',
          kind: 'score_branch',
          text: 'Calculando o melhor retorno.',
          scoreKey: 'fixture-score',
          branches: [
            { id: 'low', min: 0, max: 0, next: 'low-result' },
            { id: 'high', min: 1, max: 20, next: 'high-result', navigation: '/apoio' },
          ],
        },
      },
    };

    const nextState = advanceFlow(createInitialFlowState(navigationFlow, [navigationFlow]), [navigationFlow], 'Sim');

    expect(nextState.activeNodeId).toBe('high-result');
    expect(nextState.transcript.map((message) => message.text)).toContain('Resultado alto.');
    expect(nextState.pendingNavigation).toBe('/apoio');
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
                  message: 'Obrigado por responder com sinceridade. Vamos abrir a página de apoio depois do resultado.',
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
      message: 'Obrigado por responder com sinceridade. Vamos abrir a página de apoio depois do resultado.',
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
});
