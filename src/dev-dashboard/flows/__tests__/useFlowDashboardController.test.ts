import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { GuidedFlow } from '../../../domain/flow-engine/types';
import { useFlowDashboardController } from '../useFlowDashboardController';

function flow(id: string): GuidedFlow {
  return {
    id,
    version: '1.0',
    locale: 'pt-BR',
    title: `Fluxo ${id}`,
    type: 'guided_conversation',
    status: 'draft',
    entry: { nodeId: 'question', enteringPhrases: ['Iniciar'], transitionMessage: '' },
    nodes: {
      question: {
        id: 'question',
        kind: 'choice',
        text: 'Como você está?',
        options: [
          { id: 'continue', label: 'Continuar', next: 'result' },
          {
            id: 'support',
            label: 'Apoio',
            next: 'result',
            effects: [{ kind: 'deferred_safety', flagKey: 'support', message: 'Apoio', destination: '/apoio' }],
          },
        ],
      },
      result: { id: 'result', kind: 'result', text: 'Fim.' },
      branch: { id: 'branch', kind: 'score_branch', text: 'Faixa', scoreKey: 'score', branches: [] },
    },
  };
}

describe('useFlowDashboardController', () => {
  it('keeps selection by ID when flows reorder and falls back when it disappears', () => {
    const first = flow('first');
    const second = flow('second');
    const { result, rerender } = renderHook(
      ({ flows }: { flows: GuidedFlow[] }) => useFlowDashboardController({ flows }),
      { initialProps: { flows: [first, second] } },
    );

    act(() => result.current.selectFlow('second'));
    rerender({ flows: [second, first] });
    expect(result.current.effectiveIndex).toBe(0);
    expect(result.current.selectedFlow?.id).toBe('second');

    rerender({ flows: [first] });
    expect(result.current.selectedFlow?.id).toBe('first');
  });

  it('applies external flow focus and returns to the editor surface', () => {
    const flows = [flow('first'), flow('second')];
    const { result, rerender } = renderHook(
      ({ externalFocus }: { externalFocus?: { id: string; requestId: number } }) =>
        useFlowDashboardController({ flows, externalFocus }),
      { initialProps: { externalFocus: undefined } },
    );

    act(() => result.current.setActiveDetailTab('preview'));
    rerender({ externalFocus: { id: 'second', requestId: 1 } });

    expect(result.current.selectedFlow?.id).toBe('second');
    expect(result.current.activeDetailTab).toBe('editor');
  });

  it('filters nodes and keeps an active node within the visible set', () => {
    const { result } = renderHook(() => useFlowDashboardController({ flows: [flow('first')] }));

    act(() => result.current.selectNode('result'));
    expect(result.current.activeNodeId).toBe('result');

    act(() => result.current.setActiveNodeFilter('safety'));
    expect(result.current.visibleNodes.map((node) => node.id)).toEqual(['question']);
    expect(result.current.activeNodeId).toBe('question');

    act(() => result.current.setNodeSearch('faixa'));
    expect(result.current.visibleNodes).toHaveLength(0);
    expect(result.current.activeNodeId).toBeNull();
  });

  it('opens validation targets on the map with a fresh focus request', () => {
    const { result } = renderHook(() => useFlowDashboardController({ flows: [flow('first')] }));

    act(() =>
      result.current.openValidationTarget({
        flowId: 'first',
        nodeId: 'question',
        section: 'opcoes',
        description: 'Corrija a opção.',
      }),
    );

    expect(result.current.activeDetailTab).toBe('map');
    expect(result.current.validationFocusRequest).toEqual({ nodeId: 'question', section: 'opcoes', requestId: 1 });

    act(() => result.current.setActiveDetailTab('editor'));
    expect(result.current.validationFocusRequest).toBeNull();
  });
});
