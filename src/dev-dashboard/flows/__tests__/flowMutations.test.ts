import { describe, expect, it } from 'vitest';
import type { ChoiceFlowNode, GuidedFlow } from '../../../domain/flow-engine/types';
import { addNode } from '../flowMutations';

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
