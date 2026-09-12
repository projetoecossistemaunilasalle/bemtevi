import { describe, expect, it } from 'vitest';
import type { ChoiceFlowNode, ScoreBranchFlowNode } from '../../../domain/flow-engine/types';
import { addBranch, addNode, addOption, applyTerminalEffect, connectSource } from '../flowMutations';
import { baseFlow } from './flowMutationTestUtils';

describe('connectSource', () => {
  it('connects an option to a target node, removing terminal effects and preserving score/deferred_safety', () => {
    const flow = baseFlow({
      q1: {
        id: 'q1',
        kind: 'choice',
        text: 'Q1',
        options: [
          {
            id: 'opt1',
            label: 'Opção',
            next: 'done',
            effects: [
              { kind: 'score', scoreKey: 'pontuacao', value: 1 },
              { kind: 'navigate', destination: '/apoio' },
              { kind: 'deferred_safety', flagKey: 'safety', message: 'alerta', destination: '/apoio' },
            ],
          },
        ],
      },
      done: { id: 'done', kind: 'result', text: 'Fim' },
      novo: { id: 'novo', kind: 'result', text: 'Novo' },
    });

    const { flow: next, connected } = connectSource(flow, { kind: 'option', nodeId: 'q1', optionId: 'opt1' }, 'novo');

    expect(connected).toBe(true);
    const q1 = next.nodes.q1 as ChoiceFlowNode;
    expect(q1.options[0].next).toBe('novo');
    // Terminal effect 'navigate' removed; 'score' and 'deferred_safety' retained!
    expect(q1.options[0].effects).toEqual([
      { kind: 'score', scoreKey: 'pontuacao', value: 1 },
      { kind: 'deferred_safety', flagKey: 'safety', message: 'alerta', destination: '/apoio' },
    ]);
  });

  it('connects freeText to a target node', () => {
    const flow = baseFlow({
      q1: { id: 'q1', kind: 'choice', text: 'Q1', options: [], freeText: { next: 'done' } },
      done: { id: 'done', kind: 'result', text: 'Fim' },
      novo: { id: 'novo', kind: 'result', text: 'Novo' },
    });

    const { flow: next, connected } = connectSource(flow, { kind: 'free_text', nodeId: 'q1' }, 'novo');

    expect(connected).toBe(true);
    const q1 = next.nodes.q1 as ChoiceFlowNode;
    expect(q1.freeText?.next).toBe('novo');
  });

  it('connects a branch to a target node and clears branch navigation', () => {
    const flow = baseFlow({
      br: {
        id: 'br',
        kind: 'score_branch',
        text: 'Calc',
        scoreKey: 'pontuacao',
        branches: [{ id: 'faixa-1', min: 0, max: 5, next: 'done', navigation: '/apoio' }],
      },
      done: { id: 'done', kind: 'result', text: 'Fim' },
      novo: { id: 'novo', kind: 'result', text: 'Novo' },
    });

    const { flow: next, connected } = connectSource(
      flow,
      { kind: 'branch', nodeId: 'br', branchId: 'faixa-1' },
      'novo',
    );

    expect(connected).toBe(true);
    const br = next.nodes.br as ScoreBranchFlowNode;
    expect(br.branches[0].next).toBe('novo');
    expect(br.branches[0].navigation).toBeUndefined();
  });

  it('returns connected: false when source node or option/branch is missing', () => {
    const flow = baseFlow({ q1: { id: 'q1', kind: 'choice', text: 'Q1', options: [] } });

    expect(connectSource(flow, { kind: 'option', nodeId: 'ghost', optionId: 'opt' }, 'q1').connected).toBe(false);
    expect(connectSource(flow, { kind: 'option', nodeId: 'q1', optionId: 'ghost' }, 'q1').connected).toBe(false);
    expect(connectSource(flow, { kind: 'branch', nodeId: 'q1', branchId: 'ghost' }, 'q1').connected).toBe(false);
  });
});

describe('applyTerminalEffect', () => {
  it('applies navigate effect to an option, replacing other terminal effects and keeping score', () => {
    const flow = baseFlow({
      q1: {
        id: 'q1',
        kind: 'choice',
        text: 'Q1',
        options: [
          {
            id: 'opt1',
            label: 'Ajuda',
            next: 'q1',
            effects: [
              { kind: 'score', scoreKey: 'pontuacao', value: 1 },
              { kind: 'end_flow', message: 'tchau' },
            ],
          },
        ],
      },
    });

    const { flow: next, applied } = applyTerminalEffect(
      flow,
      { kind: 'option', nodeId: 'q1', optionId: 'opt1' },
      { kind: 'navigate', destination: '/apoio' },
    );

    expect(applied).toBe(true);
    const q1 = next.nodes.q1 as ChoiceFlowNode;
    expect(q1.options[0].effects).toEqual([
      { kind: 'score', scoreKey: 'pontuacao', value: 1 },
      { kind: 'navigate', destination: '/apoio' },
    ]);
  });

  it('applies flow_start and end_flow effects to an option', () => {
    const flow = baseFlow({
      q1: {
        id: 'q1',
        kind: 'choice',
        text: 'Q1',
        options: [{ id: 'opt1', label: 'Opção', next: 'q1' }],
      },
    });

    const { flow: next1, applied: applied1 } = applyTerminalEffect(
      flow,
      { kind: 'option', nodeId: 'q1', optionId: 'opt1' },
      { kind: 'flow_start', flowId: 'respiracao' },
    );
    expect(applied1).toBe(true);
    expect((next1.nodes.q1 as ChoiceFlowNode).options[0].effects).toEqual([
      { kind: 'flow_start', flowId: 'respiracao' },
    ]);

    const { flow: next2, applied: applied2 } = applyTerminalEffect(
      flow,
      { kind: 'option', nodeId: 'q1', optionId: 'opt1' },
      { kind: 'end_flow', message: 'Obrigado pela conversa.' },
    );
    expect(applied2).toBe(true);
    expect((next2.nodes.q1 as ChoiceFlowNode).options[0].effects).toEqual([
      { kind: 'end_flow', message: 'Obrigado pela conversa.' },
    ]);
  });

  it('applies navigate destination to a score branch via navigation field', () => {
    const flow = baseFlow({
      br: {
        id: 'br',
        kind: 'score_branch',
        text: 'Calc',
        scoreKey: 'pontuacao',
        branches: [{ id: 'b1', min: 0, max: 5, next: 'br' }],
      },
    });

    const { flow: next, applied } = applyTerminalEffect(
      flow,
      { kind: 'branch', nodeId: 'br', branchId: 'b1' },
      { kind: 'navigate', destination: '/contatos' },
    );

    expect(applied).toBe(true);
    expect((next.nodes.br as ScoreBranchFlowNode).branches[0].navigation).toBe('/contatos');
  });

  it('refuses terminal effects not supported by branch or freeText', () => {
    const flow = baseFlow({
      br: {
        id: 'br',
        kind: 'score_branch',
        text: 'Calc',
        scoreKey: 'pontuacao',
        branches: [{ id: 'b1', min: 0, max: 5, next: 'br' }],
      },
      q1: { id: 'q1', kind: 'choice', text: 'Q1', options: [], freeText: { next: 'q1' } },
    });

    // branch does not support flow_start
    const branchRes = applyTerminalEffect(
      flow,
      { kind: 'branch', nodeId: 'br', branchId: 'b1' },
      { kind: 'flow_start', flowId: 'outro' },
    );
    expect(branchRes.applied).toBe(false);

    // freeText does not support terminal effects
    const freeTextRes = applyTerminalEffect(
      flow,
      { kind: 'free_text', nodeId: 'q1' },
      { kind: 'navigate', destination: '/apoio' },
    );
    expect(freeTextRes.applied).toBe(false);
  });
});

describe('addNode with ConnectionSource', () => {
  it('connects branch to newly created node', () => {
    const flow = baseFlow({
      br: {
        id: 'br',
        kind: 'score_branch',
        text: 'Calc',
        scoreKey: 'pontuacao',
        branches: [{ id: 'b1', min: 0, max: 5, next: '' }],
      },
    });

    const {
      flow: next,
      nodeId,
      linked,
    } = addNode(flow, {
      kind: 'result',
      connectFrom: { kind: 'branch', nodeId: 'br', branchId: 'b1' },
    });

    expect(linked).toBe(true);
    expect((next.nodes.br as ScoreBranchFlowNode).branches[0].next).toBe(nodeId);
  });

  it('connects free_text to newly created node', () => {
    const flow = baseFlow({
      q1: { id: 'q1', kind: 'choice', text: 'Q1', options: [], freeText: { next: '' } },
    });

    const {
      flow: next,
      nodeId,
      linked,
    } = addNode(flow, {
      kind: 'choice',
      connectFrom: { kind: 'free_text', nodeId: 'q1' },
    });

    expect(linked).toBe(true);
    expect((next.nodes.q1 as ChoiceFlowNode).freeText?.next).toBe(nodeId);
  });
});

describe('addOption and addBranch', () => {
  it('appends an option with unique id to a choice node', () => {
    const flow = baseFlow({
      q1: { id: 'q1', kind: 'choice', text: 'Q1', options: [{ id: 'q1-option-1', label: 'Op 1', next: '' }] },
    });

    const { flow: next, optionId } = addOption(flow, 'q1');
    expect(optionId).toBe('q1-option-2');
    const q1 = next.nodes.q1 as ChoiceFlowNode;
    expect(q1.options).toHaveLength(2);
    expect(q1.options[1]).toEqual({ id: 'q1-option-2', label: '', next: '' });
  });

  it('appends a branch with automatic range to a score_branch node', () => {
    const flow = baseFlow({
      br: {
        id: 'br',
        kind: 'score_branch',
        text: 'Calc',
        scoreKey: 'pontuacao',
        branches: [{ id: 'br-faixa-1', min: 0, max: 5, next: '' }],
      },
    });

    const { flow: next, branchId } = addBranch(flow, 'br');
    expect(branchId).toBe('br-faixa-2');
    const br = next.nodes.br as ScoreBranchFlowNode;
    expect(br.branches).toHaveLength(2);
    expect(br.branches[1]).toEqual({ id: 'br-faixa-2', min: 6, max: 11, next: '' });
  });

  it('newly created choice nodes start with 1 default option', () => {
    const flow = baseFlow({});
    const { flow: next, nodeId } = addNode(flow, { kind: 'choice' });
    const choice = next.nodes[nodeId] as ChoiceFlowNode;
    expect(choice.options).toHaveLength(1);
    expect(choice.options[0].id).toBe(`${nodeId}-option-1`);
  });
});
