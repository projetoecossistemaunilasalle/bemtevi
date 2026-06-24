import { describe, expect, it } from 'vitest';
import type { GuidedFlow } from '../../domain/flow-engine/types';
import { getFlowRedirections } from '../flows/flowRedirections';

const flow: GuidedFlow = {
  id: 'test-flow',
  version: '1.0.0',
  locale: 'pt-BR',
  title: 'Fluxo de teste',
  type: 'guided_conversation',
  status: 'draft',
  entry: { nodeId: 'q1', enteringPhrases: ['Começar'], transitionMessage: 'Olá.' },
  nodes: {
    q1: {
      id: 'q1',
      kind: 'choice',
      text: 'Pergunta 1',
      options: [
        {
          id: 'yes',
          label: 'Sim',
          next: 'q2',
          effects: [
            { kind: 'score', scoreKey: 'srq20', value: 1 },
            {
              kind: 'deferred_safety',
              flagKey: 'self_harm_ideation',
              message: 'Mensagem de apoio.',
              destination: '/apoio',
            },
          ],
        },
      ],
    },
    q2: {
      id: 'q2',
      kind: 'score_branch',
      text: 'Pontuação',
      scoreKey: 'srq20',
      branches: [{ id: 'low', min: 0, max: 6, next: 'low-result' }],
    },
    'low-result': { id: 'low-result', kind: 'result', text: 'Resultado.' },
  },
};

describe('getFlowRedirections', () => {
  it('returns deferred safety, score, and score branch rows', () => {
    expect(getFlowRedirections(flow)).toEqual([
      {
        id: 'deferred-safety:test-flow:q1:yes:self_harm_ideation',
        kind: 'deferred_safety',
        nodeId: 'q1',
        optionId: 'yes',
        title: 'Encaminhamento de segurança ao final',
        summary: 'Sim marca self_harm_ideation, continua para q2 e depois abre /apoio.',
      },
      {
        id: 'score:test-flow:q1:yes:srq20',
        kind: 'score',
        nodeId: 'q1',
        optionId: 'yes',
        title: '+1 em srq20',
        summary: 'Sim soma +1 em srq20 e segue para q2.',
      },
      {
        id: 'score-branch:test-flow:q2:srq20',
        kind: 'score_branch',
        nodeId: 'q2',
        title: 'Ramificação por pontuação srq20',
        summary: '1 faixa decide o próximo resultado.',
      },
    ]);
  });

  it('returns safety_interrupt and navigate rows for immediate routing', () => {
    const immediateFlow: GuidedFlow = {
      id: 'immediate-flow',
      version: '1.0.0',
      locale: 'pt-BR',
      title: 'Roteamento imediato',
      type: 'guided_conversation',
      status: 'draft',
      entry: {
        nodeId: 'risk',
        enteringPhrases: ['Sair'],
        transitionMessage: 'Vamos lá.',
      },
      nodes: {
        risk: {
          id: 'risk',
          kind: 'choice',
          text: 'Você está em risco agora?',
          options: [
            {
              id: 'now',
              label: 'Sim, agora',
              next: 'noop',
              effects: [
                {
                  kind: 'safety_interrupt',
                  message: 'Procure ajuda imediata.',
                  destination: '/apoio',
                  blockResume: true,
                },
              ],
            },
            {
              id: 'leave',
              label: 'Não, quero sair',
              next: 'noop',
              effects: [{ kind: 'navigate', destination: '/educacao' }],
            },
          ],
        },
      },
    };

    expect(getFlowRedirections(immediateFlow)).toEqual([
      {
        id: 'safety-interrupt:immediate-flow:risk:now',
        kind: 'safety_interrupt',
        nodeId: 'risk',
        optionId: 'now',
        title: 'Interrupção de segurança imediata',
        summary: 'Sim, agora interrompe o fluxo e abre /apoio.',
      },
      {
        id: 'navigate:immediate-flow:risk:leave:/educacao',
        kind: 'navigate',
        nodeId: 'risk',
        optionId: 'leave',
        title: 'Navegação de tela',
        summary: 'Não, quero sair encerra a conversa e abre /educacao.',
      },
    ]);
  });

  it('returns flow_start and end_flow rows for conversation termination', () => {
    const exitFlow: GuidedFlow = {
      id: 'exit-flow',
      version: '1.0.0',
      locale: 'pt-BR',
      title: 'Saídas do fluxo',
      type: 'guided_conversation',
      status: 'draft',
      entry: {
        nodeId: 'wrap',
        enteringPhrases: ['Encerrar'],
        transitionMessage: 'Vamos encerrar.',
      },
      nodes: {
        wrap: {
          id: 'wrap',
          kind: 'choice',
          text: 'Como você quer prosseguir?',
          options: [
            {
              id: 'start-other',
              label: 'Iniciar triagem',
              next: 'noop',
              effects: [{ kind: 'flow_start', flowId: 'triage-flow' }],
            },
            {
              id: 'end',
              label: 'Encerrar por aqui',
              next: 'noop',
              effects: [{ kind: 'end_flow', message: 'Cuide-se!' }],
            },
          ],
        },
      },
    };

    expect(getFlowRedirections(exitFlow)).toEqual([
      {
        id: 'flow-start:exit-flow:wrap:start-other:triage-flow',
        kind: 'flow_start',
        nodeId: 'wrap',
        optionId: 'start-other',
        title: 'Início de outro fluxo',
        summary: 'Iniciar triagem começa o fluxo triage-flow.',
      },
      {
        id: 'end-flow:exit-flow:wrap:end',
        kind: 'end_flow',
        nodeId: 'wrap',
        optionId: 'end',
        title: 'Encerramento',
        summary: 'Encerrar por aqui encerra a conversa com uma mensagem.',
      },
    ]);
  });
});
