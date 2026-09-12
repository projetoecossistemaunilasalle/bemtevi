import { describe, expect, it } from 'vitest';
import { flowRegistry } from '../../../content/flows/registry';
import { advanceFlow } from '../advanceFlow';
import { createInitialFlowState, createInitialFlowStateFromRegistry } from '../loadFlows';
import { resolveOptions } from '../resolveOptions';
import { validateFlow } from '../validateFlow';
import type { GuidedFlow } from '../types';
import { validFlow } from './flowEngineFixtures';
import { neutralRouterFlow } from './neutralRouterFlowFixture';

describe('flow runtime registry and routing', () => {
  it('discovers JSON flows from the content folder without per-flow imports', () => {
    const flowIds = flowRegistry.flows.map((flow) => flow.id);

    expect(flowIds).toContain('srq20');
  });

  it('registers SRQ-20 from JSON as a normal guided flow entry phrase', () => {
    const state = createInitialFlowStateFromRegistry(flowRegistry.flows, 'orientation-understand-feelings');
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
      'A opção missing-flow do fluxo fixture-flow tenta iniciar um fluxo que não existe: missing-target.',
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

  it('propagates exercise property to chat messages during flow initialization and advance', () => {
    const exerciseFlow: GuidedFlow = {
      id: 'exercise-flow',
      version: '1.0.0',
      locale: 'pt-BR',
      title: 'Fluxo com exercício',
      type: 'guided_conversation',
      status: 'approved',
      entry: {
        nodeId: 'start',
        enteringPhrases: ['Quero testar exercício'],
        transitionMessage: 'Iniciando teste.',
      },
      nodes: {
        start: {
          id: 'start',
          kind: 'choice',
          text: 'Escolha uma opção:',
          options: [{ id: 'opt-breathe', label: 'Fazer respiração', next: 'breathe-node' }],
        },
        'breathe-node': {
          id: 'breathe-node',
          kind: 'choice',
          text: 'Faça uma pausa para respirar.',
          exercise: 'breathing',
          options: [{ id: 'opt-done', label: 'Concluir', next: 'breathe-node' }],
        },
      },
    };

    expect(validateFlow(exerciseFlow)).toEqual({ valid: true, errors: [] });

    const state = createInitialFlowState(exerciseFlow, [exerciseFlow]);
    const advanced = advanceFlow(state, [exerciseFlow], 'Fazer respiração');

    const botMessage = advanced.transcript.find((m) => m.nodeId === 'breathe-node');
    expect(botMessage).toBeDefined();
    expect(botMessage?.exercise).toBe('breathing');
    expect(botMessage?.text).toBe('Faça uma pausa para respirar.');
  });
});
