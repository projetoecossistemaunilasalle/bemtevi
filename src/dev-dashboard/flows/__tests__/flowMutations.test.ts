import { describe, expect, it } from 'vitest';
import type {
  ChoiceFlowNode,
  GuidedFlow,
  ResultFlowNode,
  ScoreBranchFlowNode,
} from '../../../domain/flow-engine/types';
import {
  addNode,
  deleteNode,
  duplicateNode,
  setEntryNode,
  switchNodeKind,
  updateFlowSettings,
} from '../flowMutations';

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

  it('appends the copy to nodeOrder when the original is missing from it', () => {
    const flow = {
      ...baseFlow({
        a: { id: 'a', kind: 'result', text: 'A' },
        b: { id: 'b', kind: 'result', text: 'B' },
        c: { id: 'c', kind: 'result', text: 'C' }, // in nodes but absent from nodeOrder
      }),
      nodeOrder: ['a', 'b'],
    };
    const snapshot = JSON.parse(JSON.stringify(flow)) as GuidedFlow;

    const { flow: next, newNodeId } = duplicateNode(flow, 'c');

    expect(newNodeId).toBe('c-copy-1');
    expect(next.nodes[newNodeId].text).toBe('C');
    // Pinned behavior: with no anchor position (indexOf → -1) the splice lands
    // at order.length, so the copy is APPENDED to nodeOrder — it is neither
    // inserted mid-list nor omitted from ordering.
    expect(next.nodeOrder).toEqual(['a', 'b', 'c-copy-1']);
    // Purity: the input flow is untouched.
    expect(JSON.parse(JSON.stringify(flow))).toEqual(snapshot);
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

  it('does not report the deleted node’s own self-reference as broken', () => {
    const flow = baseFlow({
      q1: { id: 'q1', kind: 'choice', text: 'Q', options: [{ id: 'loop', label: 'Repetir', next: 'q1' }] },
      done: { id: 'done', kind: 'result', text: 'Fim' },
    });
    const snapshot = JSON.parse(JSON.stringify(flow)) as GuidedFlow;

    const { flow: next, broken, error } = deleteNode(flow, 'q1');

    expect(error).toBeUndefined();
    // Self-references vanish together with their node; only surviving links are reported.
    expect(broken).toEqual([]);
    expect(next.nodes.q1).toBeUndefined();
    expect(Object.keys(next.nodes)).toEqual(['done']);
    // Purity: the input flow is untouched.
    expect(JSON.parse(JSON.stringify(flow))).toEqual(snapshot);
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

describe('setEntryNode', () => {
  it('points entry.nodeId at the target and leaves phrases, transitionMessage and nodes untouched', () => {
    const flow = baseFlow({
      start: { id: 'start', kind: 'choice', text: 'Q', options: [] },
      done: { id: 'done', kind: 'result', text: 'Fim' },
    });
    const snapshot = JSON.parse(JSON.stringify(flow)) as GuidedFlow;

    const next = setEntryNode(flow, 'done');

    expect(next.entry.nodeId).toBe('done');
    expect(next.entry.enteringPhrases).toEqual(['oi']);
    expect(next.entry.transitionMessage).toBe('');
    expect(Object.keys(next.nodes)).toEqual(['start', 'done']);
    expect(next).toEqual({ ...flow, entry: { nodeId: 'done', enteringPhrases: ['oi'], transitionMessage: '' } });
    // Purity: the input flow keeps its old entry.
    expect(flow.entry.nodeId).toBe('start');
    expect(JSON.parse(JSON.stringify(flow))).toEqual(snapshot);
  });

  it('throws when the target node does not exist', () => {
    const flow = baseFlow({ solo: { id: 'solo', kind: 'result', text: 'Só' } });
    expect(() => setEntryNode(flow, 'ghost')).toThrow('No such node: ghost');
  });
});

describe('updateFlowSettings', () => {
  it('changes only the provided title/purpose/status keys and keeps the entry object identity', () => {
    const flow: GuidedFlow = {
      ...baseFlow({ solo: { id: 'solo', kind: 'result', text: 'Só' } }),
      purpose: 'orientation_entry',
    };

    const titled = updateFlowSettings(flow, { title: 'Novo título' });
    expect(titled.title).toBe('Novo título');
    expect(titled.status).toBe('draft');
    expect(titled.purpose).toBe('orientation_entry');
    expect(titled.entry).toBe(flow.entry);

    const purposed = updateFlowSettings(flow, { purpose: 'post_flow_routing' });
    expect(purposed.purpose).toBe('post_flow_routing');
    expect(purposed.title).toBe('F');
    expect(purposed.status).toBe('draft');

    const statused = updateFlowSettings(flow, { status: 'approved' });
    expect(statused.status).toBe('approved');
    expect(statused.title).toBe('F');
    expect(statused.purpose).toBe('orientation_entry');

    // Purity: none of the patches touched the input.
    expect(flow.title).toBe('F');
    expect(flow.status).toBe('draft');
    expect(flow.purpose).toBe('orientation_entry');
  });

  it('replaces enteringPhrases wholesale while keeping transitionMessage; empty array is allowed', () => {
    const flow = baseFlow({ solo: { id: 'solo', kind: 'result', text: 'Só' } });
    const phrases = ['bom dia', 'tudo bem?'];

    const next = updateFlowSettings(flow, { enteringPhrases: phrases });

    expect(next.entry.enteringPhrases).toEqual(['bom dia', 'tudo bem?']);
    expect(next.entry.transitionMessage).toBe('');
    // The list is copied: later edits to the caller's array cannot leak in.
    expect(next.entry.enteringPhrases).not.toBe(phrases);
    phrases.push('injeção tardia');
    expect(next.entry.enteringPhrases).toEqual(['bom dia', 'tudo bem?']);

    const emptied = updateFlowSettings(flow, { enteringPhrases: [] });
    expect(emptied.entry.enteringPhrases).toEqual([]); // validation flags emptiness elsewhere
    expect(emptied.entry.transitionMessage).toBe('');
    expect(emptied.title).toBe('F');

    // Purity
    expect(flow.entry.enteringPhrases).toEqual(['oi']);
  });

  it('returns a structurally new but equivalent flow for a no-op patch (documented decision)', () => {
    const flow = baseFlow({ solo: { id: 'solo', kind: 'result', text: 'Só' } });
    const next = updateFlowSettings(flow, {});
    expect(next).not.toBe(flow); // always a fresh object…
    expect(next).toEqual(flow); // …structurally identical when no key was provided
  });

  it('keeps the existing purpose when the patch passes purpose: undefined (cannot clear via patch)', () => {
    const flow: GuidedFlow = {
      ...baseFlow({ solo: { id: 'solo', kind: 'result', text: 'Só' } }),
      purpose: 'orientation_entry',
    };
    const snapshot = JSON.parse(JSON.stringify(flow)) as GuidedFlow;

    const next = updateFlowSettings(flow, { purpose: undefined });

    expect(next.purpose).toBe('orientation_entry');
    expect(next.title).toBe('F'); // other keys still apply normally
    // Purity: the input flow is untouched.
    expect(JSON.parse(JSON.stringify(flow))).toEqual(snapshot);
  });
});

describe('switchNodeKind', () => {
  it('switches choice → result keeping id/key/text and dropping options/freeText/videos', () => {
    const flow = {
      ...baseFlow({
        q1: {
          id: 'q1',
          kind: 'choice',
          text: 'Escolha',
          videos: [{ id: 'v1', title: 'Vídeo', url: 'https://x' }],
          options: [
            { id: 'yes', label: 'Sim', next: 'done', effects: [{ kind: 'score', scoreKey: 'pontuacao', value: 2 }] },
          ],
          freeText: { next: 'done' },
        },
        src: { id: 'src', kind: 'choice', text: 'Src', options: [{ id: 'back', label: 'Voltar', next: 'q1' }] },
        done: { id: 'done', kind: 'result', text: 'Fim' },
      }),
      nodeOrder: ['q1', 'src', 'done'],
    };
    const snapshot = JSON.parse(JSON.stringify(flow)) as GuidedFlow;

    const { flow: next, node } = switchNodeKind(flow, 'q1', { kind: 'result' });

    const result = node as ResultFlowNode;
    expect(result.kind).toBe('result');
    expect(result.id).toBe('q1');
    expect(result.text).toBe('Escolha');
    expect(Object.keys(node).sort()).toEqual(['id', 'kind', 'text', 'videos']); // plain result: nothing leaks beyond carried videos
    // Media survives re-kinding as a fresh copy, never shared with the input.
    expect(result.videos).toEqual([{ id: 'v1', title: 'Vídeo', url: 'https://x' }]);
    expect(result.videos![0]).not.toBe((flow.nodes.q1 as ChoiceFlowNode).videos![0]);
    expect(node).toBe(next.nodes.q1); // record key preserved
    // Inbound references still point at the same id (content shape changed; validated downstream).
    expect((next.nodes.src as ChoiceFlowNode).options[0].next).toBe('q1');
    expect(next.nodeOrder).toBe(flow.nodeOrder); // position untouched
    expect(next.entry.nodeId).toBe('q1');
    // Purity: the input flow is untouched.
    expect(JSON.parse(JSON.stringify(flow))).toEqual(snapshot);
  });

  it('switches result → score_branch with the default score key and one default branch range', () => {
    const flow = baseFlow({
      fim: { id: 'fim', kind: 'result', text: 'Fim', recommendations: ['Levar documentos'] },
    });

    const { flow: next, node } = switchNodeKind(flow, 'fim', { kind: 'score_branch' });

    const branched = node as ScoreBranchFlowNode;
    expect(branched.kind).toBe('score_branch');
    expect(branched.id).toBe('fim'); // id preserved
    expect(branched.text).toBe('Fim'); // text always preserved
    expect(branched.scoreKey).toBe('pontuacao'); // DEFAULT_SCORE_KEY
    expect(branched.branches).toEqual([{ id: 'fim-faixa-1', min: 0, max: 10, next: '' }]);
    // Source had no videos: no videos key may appear; old extras stay dropped.
    expect(Object.keys(branched).sort()).toEqual(['branches', 'id', 'kind', 'scoreKey', 'text']);
    expect(node).toBe(next.nodes.fim); // record key preserved
  });

  it('switches score_branch → choice with one empty placeholder option, dropping branches/scoreKey', () => {
    const flow = baseFlow({
      calc: {
        id: 'calc',
        kind: 'score_branch',
        text: 'Calc',
        videos: [{ id: 'v9', title: 'Tutorial', url: 'https://y' }],
        scoreKey: 'pontuacao',
        branches: [{ id: 'alta', min: 6, max: 10, next: 'fim' }],
      },
      fim: { id: 'fim', kind: 'result', text: 'Fim' },
    });
    const snapshot = JSON.parse(JSON.stringify(flow)) as GuidedFlow;

    const { flow: next, node } = switchNodeKind(flow, 'calc', { kind: 'choice' });

    const choice = node as ChoiceFlowNode;
    expect(choice.kind).toBe('choice');
    expect(choice.id).toBe('calc');
    expect(choice.text).toBe('Calc');
    expect(choice.options).toEqual([{ id: 'calc-option-1', label: '', next: '' }]);
    expect(choice).not.toHaveProperty('branches');
    expect(choice).not.toHaveProperty('scoreKey');
    // Media survives the switch to choice as a fresh copy.
    expect(choice.videos).toEqual([{ id: 'v9', title: 'Tutorial', url: 'https://y' }]);
    expect(choice.videos![0]).not.toBe((flow.nodes.calc as ScoreBranchFlowNode).videos![0]);
    expect(node).toBe(next.nodes.calc);
    // Purity: the input flow is untouched.
    expect((flow.nodes.calc as ScoreBranchFlowNode).branches).toHaveLength(1);
    expect(JSON.parse(JSON.stringify(flow))).toEqual(snapshot);
  });

  it('is a same-kind no-op returning the current flow and node by reference', () => {
    const flow = baseFlow({
      q1: { id: 'q1', kind: 'choice', text: 'Q', options: [{ id: 'yes', label: 'Sim', next: '' }] },
    });
    const snapshot = JSON.parse(JSON.stringify(flow)) as GuidedFlow;

    const { flow: next, node } = switchNodeKind(flow, 'q1', { kind: 'choice' });

    expect(next).toBe(flow); // documented no-op: same references out
    expect(node).toBe(flow.nodes.q1);
    expect((node as ChoiceFlowNode).options).toHaveLength(1);
    expect(JSON.parse(JSON.stringify(flow))).toEqual(snapshot);
  });

  it('throws when the target node does not exist', () => {
    const flow = baseFlow({ solo: { id: 'solo', kind: 'result', text: 'Só' } });
    expect(() => switchNodeKind(flow, 'ghost', { kind: 'result' })).toThrow('No such node: ghost');
  });
});
