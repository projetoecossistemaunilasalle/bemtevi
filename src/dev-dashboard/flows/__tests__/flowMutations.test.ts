import { describe, expect, it } from 'vitest';
import type {
  ChoiceFlowNode,
  GuidedFlow,
  ResultFlowNode,
  ScoreBranchFlowNode,
} from '../../../domain/flow-engine/types';
import { addNode, deleteNode, duplicateNode } from '../flowMutations';

function baseFlow(nodes: GuidedFlow['nodes']): GuidedFlow {
  return {
    id: 'f', version: '1.0', locale: 'pt-BR', title: 'F', type: 'guided_conversation',
    status: 'draft',
    entry: { nodeId: Object.keys(nodes)[0], enteringPhrases: ['oi'], transitionMessage: '' },
    nodes,
  };
}

describe('addNode', () => {
  it('appends a unique step-N node and links an origin option when requested', () => {
    const flow = baseFlow({
      q1: { id: 'q1', kind: 'choice', text: 'Q1', options: [{ id: 'yes', label: 'Sim', next: 'done' }] },
      done: { id: 'done', kind: 'result', text: 'Fim' },
    });
    const {
      flow: updated, nodeId, linked,
    } = addNode(flow, { kind: 'result', connectFrom: { nodeId: 'q1', optionId: 'yes' } });
    expect(linked).toBe(true);
    expect(nodeId).toBe('step-3');
    expect(updated.nodes['step-3'].kind).toBe('result');
    const q1 = updated.nodes.q1 as ChoiceFlowNode;
    expect(q1.options[0].next).toBe('step-3');
    expect(flow.nodes['step-3']).toBeUndefined();

    const { flow: plain } = addNode(flow, { kind: 'choice' });
    expect(plain.nodes['step-3']).toBeDefined();
    expect(Object.keys(plain.nodes)).toHaveLength(3);
  });

  it('creates the node but skips linking when connectFrom has no optionId', () => {
    const flow = baseFlow({
      q1: { id: 'q1', kind: 'choice', text: 'Q1', options: [{ id: 'yes', label: 'Sim', next: 'done' }] },
    });
    const { flow: next, nodeId, linked } = addNode(flow, { kind: 'result', connectFrom: { nodeId: 'q1' } });
    expect(linked).toBe(false);
    expect(next.nodes[nodeId]).toBeDefined();
    expect(next.nodes[nodeId].id).toBe(nodeId);
    const q1 = next.nodes.q1 as ChoiceFlowNode;
    expect(q1.options[0].next).toBe('done');
  });

  it('keeps nodeOrder in sync when the flow already has one', () => {
    const flow = { ...baseFlow({ q1: { id: 'q1', kind: 'choice', text: 'Q', options: [] } }), nodeOrder: ['q1'] };
    const { flow: next } = addNode(flow, { kind: 'result' });
    expect(next.nodeOrder).toEqual(['q1', 'step-2']);
  });

  it('skips occupied ids when generating', () => {
    const flow = baseFlow({
      q1: { id: 'q1', kind: 'choice', text: 'Q', options: [] },
      'step-3': { id: 'step-3', kind: 'choice', text: 'X', options: [] },
    });
    const { nodeId } = addNode(flow, { kind: 'result' });
    expect(nodeId).toBe('step-4');
    expect(flow.nodes[nodeId]).toBeUndefined();
  });

  it('starts at step-1 on an empty flow', () => {
    const flow = baseFlow({});
    const { flow: next, nodeId } = addNode(flow, { kind: 'choice' });
    expect(nodeId).toBe('step-1');
    expect(Object.keys(next.nodes)).toEqual(['step-1']);
  });
});

describe('duplicateNode', () => {
  it('deep-copies a choice with fresh node/option ids, keeping the original untouched', () => {
    const flow = {
      ...baseFlow({
        q1: {
          id: 'q1',
          kind: 'choice',
          text: 'Escolha',
          options: [
            { id: 'yes', label: 'Sim', next: 'done', effects: [{ kind: 'score', scoreKey: 'pontuacao', value: 2 }] },
            { id: 'no', label: 'Não', next: 'q1' },
          ],
        },
        done: { id: 'done', kind: 'result', text: 'Fim' },
      }),
      nodeOrder: ['q1', 'done'],
    };
    const snapshot = JSON.parse(JSON.stringify(flow)) as GuidedFlow;

    const { flow: next, newNodeId } = duplicateNode(flow, 'q1');

    expect(newNodeId).toBe('q1-copy-1');
    expect(next.nodeOrder).toEqual(['q1', 'q1-copy-1', 'done']);
    expect(Object.keys(next.nodes)).toHaveLength(3);

    const source = flow.nodes.q1 as ChoiceFlowNode;
    const copy = next.nodes['q1-copy-1'] as ChoiceFlowNode;
    expect(copy).not.toBe(source);
    expect(copy.id).toBe(newNodeId);
    expect(copy.text).toBe('Escolha');
    expect(copy.options.map((option) => [option.id, option.label, option.next])).toEqual([
      ['yes-copy-1', 'Sim', 'done'],
      ['no-copy-1', 'Não', 'q1'],
    ]);
    // Content is deep-copied: effects are equal but not shared references.
    expect(copy.options[0].effects).toEqual(source.options[0].effects);
    expect(copy.options[0].effects).not.toBe(source.options[0].effects);
    expect(copy.options[0]).not.toBe(source.options[0]);

    // Nothing points at the copy: incoming edges are not duplicated.
    for (const node of Object.values(next.nodes)) {
      if (node.kind === 'choice') {
        for (const option of node.options) expect(option.next).not.toBe(newNodeId);
        if (node.freeText) expect(node.freeText.next).not.toBe(newNodeId);
      }
      if (node.kind === 'score_branch') {
        for (const branch of node.branches) expect(branch.next).not.toBe(newNodeId);
      }
    }

    // Purity: the input flow is untouched.
    expect(JSON.parse(JSON.stringify(flow))).toEqual(snapshot);
  });

  it('duplicates a score_branch with fresh branch ids preserving ranges and navigation', () => {
    const flow = baseFlow({
      calc: {
        id: 'calc',
        kind: 'score_branch',
        text: 'Resultado',
        scoreKey: 'pontuacao',
        branches: [
          { id: 'baixa', min: 0, max: 5, next: 'apoio' },
          { id: 'alta', min: 6, max: 10, next: 'fim', navigation: '/contatos' },
        ],
      },
      fim: { id: 'fim', kind: 'result', text: 'Fim' },
    });

    const { flow: next, newNodeId } = duplicateNode(flow, 'calc');

    expect(newNodeId).toBe('calc-copy-1');
    const copy = next.nodes[newNodeId] as ScoreBranchFlowNode;
    expect(copy.id).toBe(newNodeId);
    expect(copy.text).toBe('Resultado');
    expect(copy.scoreKey).toBe('pontuacao');
    expect(copy.branches.map((branch) => [branch.id, branch.min, branch.max, branch.next, branch.navigation])).toEqual([
      ['baixa-copy-1', 0, 5, 'apoio', undefined],
      ['alta-copy-1', 6, 10, 'fim', '/contatos'],
    ]);
    expect(next.nodes.fim as ResultFlowNode).toEqual({ id: 'fim', kind: 'result', text: 'Fim' });
    expect(next.nodeOrder).toBeUndefined();
  });

  it('duplicates a result node verbatim without a nodeOrder entry change beyond insertion', () => {
    const flow = baseFlow({
      fim: { id: 'fim', kind: 'result', text: 'Fim', recommendations: ['Levar documentos'] },
    });
    const { flow: next, newNodeId } = duplicateNode(flow, 'fim');
    expect(newNodeId).toBe('fim-copy-1');
    expect((next.nodes[newNodeId] as ResultFlowNode).recommendations).toEqual(['Levar documentos']);
    expect(next.nodeOrder).toBeUndefined();
  });

  it('skips occupied copy ids and still inserts right after the original in nodeOrder', () => {
    const flow = {
      ...baseFlow({
        q1: { id: 'q1', kind: 'result', text: 'A' },
        'q1-copy-1': { id: 'q1-copy-1', kind: 'result', text: 'B' },
        zz: { id: 'zz', kind: 'result', text: 'C' },
      }),
      nodeOrder: ['q1', 'q1-copy-1', 'zz'],
    };
    const { flow: next, newNodeId } = duplicateNode(flow, 'q1');
    expect(newNodeId).toBe('q1-copy-2');
    expect(next.nodeOrder).toEqual(['q1', 'q1-copy-2', 'q1-copy-1', 'zz']);
    expect(next.nodes[newNodeId].text).toBe('A');
  });

  it('throws when the source node does not exist', () => {
    const flow = baseFlow({ q1: { id: 'q1', kind: 'result', text: 'A' } });
    expect(() => duplicateNode(flow, 'nope')).toThrow('No such node: nope');
  });
});

describe('deleteNode', () => {
  it('removes the node from nodes and nodeOrder and reports no breaks when unreferenced', () => {
    const flow = {
      ...baseFlow({
        q1: { id: 'q1', kind: 'choice', text: 'Q', options: [{ id: 'yes', label: 'Sim', next: 'done' }] },
        done: { id: 'done', kind: 'result', text: 'Fim' },
        orphan: { id: 'orphan', kind: 'result', text: 'Órfão' },
      }),
      nodeOrder: ['q1', 'done', 'orphan'],
    };

    const { flow: next, broken, error } = deleteNode(flow, 'orphan');

    expect(error).toBeUndefined();
    expect(broken).toEqual([]);
    expect(next.nodes.orphan).toBeUndefined();
    expect(Object.keys(next.nodes)).toEqual(['q1', 'done']);
    expect(next.nodeOrder).toEqual(['q1', 'done']);
    // Purity: the input flow keeps its node.
    expect(flow.nodes.orphan).toBeDefined();
    expect(flow.nodeOrder).toEqual(['q1', 'done', 'orphan']);
  });

  it('reports every inbound reference from an option, a freeText, and a branch without touching them', () => {
    const flow = baseFlow({
      src: {
        id: 'src',
        kind: 'choice',
        text: 'Q',
        options: [{ id: 'opt1', label: 'Ir', next: 'alvo' }],
        freeText: { next: 'alvo' },
      },
      br: {
        id: 'br',
        kind: 'score_branch',
        text: 'S',
        scoreKey: 'pontuacao',
        branches: [{ id: 'faixa-alta', min: 0, max: 10, next: 'alvo' }],
      },
      alvo: { id: 'alvo', kind: 'result', text: 'Alvo' },
    });

    const { flow: next, broken, error } = deleteNode(flow, 'alvo');

    expect(error).toBeUndefined();
    expect(broken).toEqual([
      { sourceNodeId: 'src', optionId: 'opt1', via: 'option' },
      { sourceNodeId: 'src', via: 'free-text' },
      { sourceNodeId: 'br', branchId: 'faixa-alta', via: 'branch' },
    ]);
    // References stay pointing at the removed id — cleanup is explicit elsewhere.
    const src = next.nodes.src as ChoiceFlowNode;
    expect(src.options[0].next).toBe('alvo');
    expect(src.freeText?.next).toBe('alvo');
    expect((next.nodes.br as ScoreBranchFlowNode).branches[0].next).toBe('alvo');
    expect(next.nodes.alvo).toBeUndefined();
  });

  it('allows deleting the entry node with no special casing', () => {
    const flow = baseFlow({
      start: { id: 'start', kind: 'choice', text: 'Q', options: [] },
      done: { id: 'done', kind: 'result', text: 'Fim' },
    });
    const { flow: next, error } = deleteNode(flow, 'start');
    expect(error).toBeUndefined();
    expect(next.nodes.start).toBeUndefined();
    expect(next.entry.nodeId).toBe('start'); // untouched; validation flags it elsewhere
  });

  it('refuses to remove the last remaining node', () => {
    const flow = baseFlow({ solo: { id: 'solo', kind: 'result', text: 'Só' } });
    const { flow: next, broken, error } = deleteNode(flow, 'solo');
    expect(error).toBe('last-node');
    expect(broken).toEqual([]);
    expect(next.nodes.solo).toBeDefined();
    expect(Object.keys(next.nodes)).toHaveLength(1);
  });

  it('throws when the target node does not exist', () => {
    const flow = baseFlow({ solo: { id: 'solo', kind: 'result', text: 'Só' } });
    expect(() => deleteNode(flow, 'ghost')).toThrow('No such node: ghost');
  });
});
