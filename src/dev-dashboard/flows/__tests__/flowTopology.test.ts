import { describe, expect, it } from 'vitest';
import type { FlowEffect, FlowNode, GuidedFlow } from '../../../domain/flow-engine/types';
import { buildFlowTopology, buildSystemFlowTopology } from '../flowTopology';

function flow(
  id: string,
  nodes: Record<string, FlowNode>,
  entryNodeId = Object.keys(nodes)[0],
  nodeOrder?: string[],
): GuidedFlow {
  return {
    id,
    version: '1.0',
    locale: 'pt-BR',
    title: id,
    type: 'guided_conversation',
    status: 'draft',
    entry: { nodeId: entryNodeId, enteringPhrases: ['start'], transitionMessage: '' },
    nodes,
    nodeOrder,
  };
}

function choice(id: string, next: string, label = 'Next', effects?: FlowEffect[]): FlowNode {
  return { id, kind: 'choice', text: id, options: [{ id: `${id}-option`, label, next, effects }] };
}

const result = (id: string, text = id): FlowNode => ({ id, kind: 'result', text });

describe('buildFlowTopology', () => {
  it('keeps branches and convergence while using nodeOrder for editorial steps', () => {
    const graph = flow(
      'branching',
      {
        q1: {
          id: 'q1',
          kind: 'choice',
          text: 'Question',
          options: [
            { id: 'yes', label: 'Yes', next: 'q2' },
            { id: 'no', label: 'No', next: 'q3' },
          ],
        },
        q2: choice('q2', 'result'),
        q3: choice('q3', 'result'),
        result: result('result', 'Done'),
      },
      'q1',
      ['result', 'q1', 'q2', 'q3'],
    );
    const topology = buildFlowTopology(graph, [graph]);

    expect(topology.nodeById.q1.stepNumber).toBe(2);
    expect(topology.nodeById.q1.depth).toBe(0);
    expect(topology.nodeById.q2.depth).toBe(1);
    expect(topology.nodeById.q3.depth).toBe(1);
    expect(topology.nodeById.result.depth).toBe(2);
    expect(topology.incomingCountByNodeId.result).toBe(2);
    expect(topology.reverseReachableDestinationIds.result).toEqual(['result', 'q1', 'q2', 'q3']);
    expect(topology.reachableTerminalDestinationIds).toEqual(['result']);
  });

  it('keeps a long linear sequence compactable while retaining score and deferred safety edges', () => {
    const srq = flow(
      'srq',
      {
        q1: choice('q1', 'q2'),
        q2: choice('q2', 'q3', 'Yes', [
          { kind: 'deferred_safety', flagKey: 'risk', message: 'Help', destination: '/apoio' },
        ]),
        q3: choice('q3', 'q4'),
        q4: choice('q4', 'score', 'Yes', [{ kind: 'score', scoreKey: 'srq20', value: 1 }]),
        score: {
          id: 'score',
          kind: 'score_branch',
          text: 'Score',
          scoreKey: 'srq20',
          branches: [
            { id: 'low', min: 0, max: 6, next: 'low-result' },
            { id: 'high', min: 7, max: 20, next: 'high-result' },
          ],
        },
        'low-result': result('low-result'),
        'high-result': result('high-result'),
      },
      'q1',
    );
    const topology = buildFlowTopology(srq, [srq]);

    expect(topology.edges.find((edge) => edge.kind === 'score')?.scores).toEqual([{ scoreKey: 'srq20', value: 1 }]);
    expect(topology.edges.filter((edge) => edge.kind === 'deferred_safety')).toHaveLength(1);
    expect(topology.linearSequences).toHaveLength(1);
    expect(topology.linearSequences[0].nodeIds).toEqual(['q1', 'q2', 'q3', 'q4']);
    expect(topology.linearSequences[0].hasScore).toBe(true);
    expect(topology.linearSequences[0].hasDeferredSafety).toBe(true);
    expect(topology.reverseReachableDestinationIds['deferred_safety:/apoio']).toEqual(['q1', 'q2']);
    expect(topology.reachableTerminalDestinationIds).toEqual(['low-result', 'high-result', 'deferred_safety:/apoio']);
  });

  it('uses flow_start before the local option.next target', () => {
    const target = flow('target', { 'target-entry': result('target-entry') }, 'target-entry');
    const source = flow(
      'source',
      {
        start: {
          id: 'start',
          kind: 'choice',
          text: 'Start',
          options: [
            {
              id: 'handoff',
              label: 'Open target',
              next: 'wrong-local',
              effects: [{ kind: 'flow_start', flowId: 'target' }],
            },
          ],
        },
        'wrong-local': result('wrong-local'),
      },
      'start',
    );
    const topology = buildFlowTopology(source, [source, target]);
    const edge = topology.edges.find((candidate) => candidate.optionId === 'handoff')!;

    expect(edge.kind).toBe('flow_start');
    expect(edge.targetFlowId).toBe('target');
    expect(edge.targetNodeId).toBe('target-entry');
    expect(topology.reachableNodeIds).toEqual(['start']);
    expect(topology.unreachableNodeIds).toContain('wrong-local');
  });

  it('represents missing targets and free-text advances explicitly', () => {
    const graph = flow('invalid', {
      start: {
        id: 'start',
        kind: 'choice',
        text: 'Start',
        options: [{ id: 'missing', label: 'Missing', next: 'no-such-node' }],
        freeText: { next: 'result' },
      },
      result: result('result'),
    });
    const topology = buildFlowTopology(graph, [graph]);

    expect(topology.edges.find((edge) => edge.isFreeText)?.kind).toBe('free_text');
    expect(topology.edges.find((edge) => edge.optionId === 'missing')?.destination?.kind).toBe('missing_node');
    expect(
      topology.destinations.some(
        (destination) => destination.kind === 'missing_node' && destination.target === 'no-such-node',
      ),
    ).toBe(true);
    expect(topology.reachableTerminalDestinationIds).toEqual(['result', 'missing_node:no-such-node']);
  });

  it('handles cycles with SCC depth and keeps disconnected nodes out of the entry path', () => {
    const graph = flow(
      'cycle',
      {
        q1: { id: 'q1', kind: 'choice', text: 'One', options: [{ id: 'next', label: 'Next', next: 'q2' }] },
        q2: {
          id: 'q2',
          kind: 'choice',
          text: 'Two',
          options: [
            { id: 'back', label: 'Back', next: 'q1' },
            { id: 'finish', label: 'Finish', next: 'result' },
          ],
        },
        result: result('result'),
        dead: choice('dead', 'dead'),
      },
      'q1',
    );
    const topology = buildFlowTopology(graph, [graph]);

    expect(topology.cycles.some((cycle) => cycle.nodeIds.includes('q1') && cycle.nodeIds.includes('q2'))).toBe(true);
    expect(topology.nodeById.q1.depth).toBe(0);
    expect(topology.nodeById.q2.depth).toBe(0);
    expect(topology.nodeById.dead.reachable).toBe(false);
    expect(topology.reverseReachableDestinationIds.result).toEqual(['q1', 'q2', 'result']);
  });

  it('creates score branch range edges and carries branch navigation as a destination', () => {
    const graph = flow('score', {
      start: {
        id: 'start',
        kind: 'score_branch',
        text: 'Score',
        scoreKey: 'x',
        branches: [
          { id: 'low', min: 0, max: 6, next: 'low-result', navigation: '/apoio' },
          { id: 'high', min: 7, max: 20, next: 'high-result' },
        ],
      },
      'low-result': result('low-result'),
      'high-result': result('high-result'),
    });
    const topology = buildFlowTopology(graph, [graph]);
    const low = topology.edges.find((edge) => edge.branchId === 'low')!;

    expect(low.kind).toBe('score_branch');
    expect(low.scoreRange?.label).toBe('0–6');
    expect(low.secondaryDestination?.kind).toBe('navigate');
    expect(topology.reachableTerminalDestinationIds).toEqual(['low-result', 'high-result', 'navigate:/apoio']);
  });
});

describe('buildSystemFlowTopology', () => {
  it('keeps one node per flow and exposes flow-start and typed external connections', () => {
    const target = flow('target', { result: result('result') });
    const source = flow('source', {
      start: {
        id: 'start',
        kind: 'choice',
        text: 'Start',
        options: [
          { id: 'handoff', label: 'Target', next: 'result', effects: [{ kind: 'flow_start', flowId: 'target' }] },
          { id: 'support', label: 'Support', next: 'result', effects: [{ kind: 'navigate', destination: '/apoio' }] },
          { id: 'stop', label: 'Stop', next: 'result', effects: [{ kind: 'end_flow', message: 'Bye' }] },
        ],
      },
      result: result('result'),
    });
    const topology = buildSystemFlowTopology([source, target]);

    expect(topology.flowNodes.map((node) => node.id)).toEqual(['source', 'target']);
    expect(topology.connections.find((connection) => connection.kind === 'flow_start')?.targetFlowId).toBe('target');
    expect(topology.destinations.map((destination) => destination.kind)).toEqual(['navigate', 'end_flow']);
    expect(topology.incomingCountByFlowId.target).toBe(1);
    expect(topology.outgoingCountByFlowId.source).toBe(3);
  });
});
