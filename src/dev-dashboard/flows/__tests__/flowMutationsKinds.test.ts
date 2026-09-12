import { describe, expect, it } from 'vitest';
import type {
  ChoiceFlowNode,
  GuidedFlow,
  ResultFlowNode,
  ScoreBranchFlowNode,
} from '../../../domain/flow-engine/types';
import { duplicateNode, moveNode, switchNodeKind } from '../flowMutations';
import { baseFlow } from './flowMutationTestUtils';

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

describe('visuals', () => {
  const visual = { id: 'img1', alt: 'Foto acolhedora', src: 'https://exemplo.com/foto.png' };

  it('switchNodeKind choice → result preserves visuals as a fresh deep copy', () => {
    const flow = baseFlow({
      q1: {
        id: 'q1',
        kind: 'choice',
        text: 'Escolha',
        visuals: [visual],
        options: [{ id: 'yes', label: 'Sim', next: 'done' }],
      },
      done: { id: 'done', kind: 'result', text: 'Fim' },
    });
    const snapshot = JSON.parse(JSON.stringify(flow)) as GuidedFlow;

    const { flow: next, node } = switchNodeKind(flow, 'q1', { kind: 'result' });

    const result = node as ResultFlowNode;
    expect(result.visuals).toEqual([visual]);
    expect(result.visuals).not.toBe(flow.nodes.q1.visuals);
    expect(result.visuals![0]).not.toBe(flow.nodes.q1.visuals![0]);
    // Mutating the rebuilt array must not leak into the original node.
    result.visuals![0].alt = 'Alterada';
    result.visuals!.push({ id: 'img2', alt: 'Outra', src: '' });
    expect(flow.nodes.q1.visuals).toEqual([visual]);
    expect(JSON.parse(JSON.stringify(flow))).toEqual(snapshot);
    expect(next.nodes.q1).toBe(node);
  });

  it('switchNodeKind result → score_branch preserves visuals as a fresh deep copy', () => {
    const flow = baseFlow({
      fim: { id: 'fim', kind: 'result', text: 'Fim', visuals: [visual] },
    });

    const { node } = switchNodeKind(flow, 'fim', { kind: 'score_branch' });

    const branched = node as ScoreBranchFlowNode;
    expect(branched.visuals).toEqual([visual]);
    expect(branched.visuals).not.toBe(flow.nodes.fim.visuals);
    expect(branched.visuals![0]).not.toBe(flow.nodes.fim.visuals![0]);
    branched.visuals![0].alt = 'Alterada';
    expect(flow.nodes.fim.visuals![0].alt).toBe('Foto acolhedora');
  });

  it('switchNodeKind score_branch → choice preserves visuals as a fresh deep copy', () => {
    const flow = baseFlow({
      calc: {
        id: 'calc',
        kind: 'score_branch',
        text: 'Calc',
        visuals: [visual],
        scoreKey: 'pontuacao',
        branches: [{ id: 'alta', min: 6, max: 10, next: 'fim' }],
      },
      fim: { id: 'fim', kind: 'result', text: 'Fim' },
    });

    const { node } = switchNodeKind(flow, 'calc', { kind: 'choice' });

    const choice = node as ChoiceFlowNode;
    expect(choice.visuals).toEqual([visual]);
    expect(choice.visuals).not.toBe(flow.nodes.calc.visuals);
    expect(choice.visuals![0]).not.toBe(flow.nodes.calc.visuals![0]);
    choice.visuals![0].alt = 'Alterada';
    expect(flow.nodes.calc.visuals![0].alt).toBe('Foto acolhedora');
  });

  it('duplicateNode deep-copies visuals: editing the copy leaves the source untouched', () => {
    const flow = baseFlow({
      q1: {
        id: 'q1',
        kind: 'choice',
        text: 'Escolha',
        visuals: [visual],
        options: [{ id: 'yes', label: 'Sim', next: 'done' }],
      },
      done: { id: 'done', kind: 'result', text: 'Fim' },
    });

    const { flow: next, newNodeId } = duplicateNode(flow, 'q1');

    const copy = next.nodes[newNodeId] as ChoiceFlowNode;
    expect(copy.visuals).toEqual([visual]);
    expect(copy.visuals).not.toBe(flow.nodes.q1.visuals);
    expect(copy.visuals![0]).not.toBe(flow.nodes.q1.visuals![0]);

    copy.visuals![0] = { ...copy.visuals![0], alt: 'Nova descrição' };
    copy.visuals!.push({ id: 'img2', alt: '', src: '' });

    expect(flow.nodes.q1.visuals).toEqual([visual]);
    expect(flow.nodes.q1.visuals).toHaveLength(1);
    expect(copy.visuals).toHaveLength(2);
    expect(copy.visuals![0].alt).toBe('Nova descrição');
  });
});

describe('moveNode', () => {
  function orderedFlow(): { flow: GuidedFlow; snapshot: GuidedFlow } {
    const flow = {
      ...baseFlow({
        a: { id: 'a', kind: 'result', text: 'A' },
        b: { id: 'b', kind: 'result', text: 'B' },
        c: { id: 'c', kind: 'result', text: 'C' },
      }),
      nodeOrder: ['a', 'b', 'c'],
    };
    return { flow, snapshot: JSON.parse(JSON.stringify(flow)) as GuidedFlow };
  }

  it('swaps with the previous neighbor inside an explicit nodeOrder (up)', () => {
    const { flow, snapshot } = orderedFlow();

    const { flow: next, moved } = moveNode(flow, 'b', 'up');

    expect(moved).toBe(true);
    expect(next.nodeOrder).toEqual(['b', 'a', 'c']);
    // Only the order changed — nodes are the same references.
    expect(next.nodes).toBe(flow.nodes);
    // Purity: the input flow is untouched.
    expect(flow.nodeOrder).toEqual(['a', 'b', 'c']);
    expect(JSON.parse(JSON.stringify(flow))).toEqual(snapshot);
  });

  it('swaps with the next neighbor inside an explicit nodeOrder (down)', () => {
    const { flow } = orderedFlow();

    const { flow: next, moved } = moveNode(flow, 'b', 'down');

    expect(moved).toBe(true);
    expect(next.nodeOrder).toEqual(['a', 'c', 'b']);
  });

  it('refuses to move past either bound, returning the original references untouched', () => {
    const { flow, snapshot } = orderedFlow();

    const upAtFirst = moveNode(flow, 'a', 'up');
    expect(upAtFirst.moved).toBe(false);
    expect(upAtFirst.flow).toBe(flow); // documented no-op: same references out
    expect(upAtFirst.flow.nodeOrder).toEqual(['a', 'b', 'c']);

    const downAtLast = moveNode(flow, 'c', 'down');
    expect(downAtLast.moved).toBe(false);
    expect(downAtLast.flow).toBe(flow);

    // Purity
    expect(JSON.parse(JSON.stringify(flow))).toEqual(snapshot);
  });

  it('materializes nodeOrder from the insertion order on the first move when none exists', () => {
    const unordered = baseFlow({
      a: { id: 'a', kind: 'result', text: 'A' },
      b: { id: 'b', kind: 'result', text: 'B' },
      c: { id: 'c', kind: 'result', text: 'C' },
    });
    const snapshot = JSON.parse(JSON.stringify(unordered)) as GuidedFlow;
    expect(unordered.nodeOrder).toBeUndefined();

    const { flow: next, moved } = moveNode(unordered, 'c', 'up');

    expect(moved).toBe(true);
    // Insertion order [a, b, c] with c swapped above b.
    expect(next.nodeOrder).toEqual(['a', 'c', 'b']);
    expect(Object.keys(next.nodes)).toEqual(['a', 'b', 'c']); // record keys untouched
    // Purity: the input still has no nodeOrder.
    expect(unordered.nodeOrder).toBeUndefined();
    expect(JSON.parse(JSON.stringify(unordered))).toEqual(snapshot);
  });

  it('never materializes nodeOrder for an unmovable single node without an order', () => {
    const solo = baseFlow({ solo: { id: 'solo', kind: 'result', text: 'Só' } });

    const result = moveNode(solo, 'solo', 'up');

    expect(result.moved).toBe(false);
    expect(result.flow).toBe(solo);
    expect(result.flow.nodeOrder).toBeUndefined(); // nothing changed → nothing materialized
  });

  it('treats a node missing from its own explicit order as unmovable (defensive)', () => {
    const flow = {
      ...baseFlow({
        a: { id: 'a', kind: 'result', text: 'A' },
        stray: { id: 'stray', kind: 'result', text: 'Stray' }, // in nodes, absent from nodeOrder
      }),
      nodeOrder: ['a'],
    };

    const down = moveNode(flow, 'stray', 'down'); // indexOf → -1 would corrupt a naive swap
    expect(down.moved).toBe(false);
    expect(down.flow).toBe(flow);
    expect(down.flow.nodeOrder).toEqual(['a']);

    const up = moveNode(flow, 'stray', 'up');
    expect(up.moved).toBe(false);
    expect(up.flow.nodeOrder).toEqual(['a']);
  });

  it('throws when the target node does not exist', () => {
    const { flow } = orderedFlow();
    expect(() => moveNode(flow, 'ghost', 'up')).toThrow('No such node: ghost');
  });
});
