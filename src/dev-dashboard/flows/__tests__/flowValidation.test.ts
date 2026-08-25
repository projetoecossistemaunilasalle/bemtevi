import { describe, expect, it, vi } from 'vitest';
import type { FlowNode, GuidedFlow } from '../../../domain/flow-engine/types';
import { validateDashboardFlows } from '../flowValidation';

// Sentinel flow id used to inject an unmapped validator message so the generic
// fallback branch of `toStructuralIssue` can be exercised deterministically.
const UNKNOWN_ERROR_FLOW_ID = vi.hoisted(() => 'fluxo-desconhecido');

vi.mock('../../../domain/flow-engine/validateFlow', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../domain/flow-engine/validateFlow')>();
  return {
    ...actual,
    validateFlow(flow: unknown) {
      const result = actual.validateFlow(flow);
      if ((flow as { id?: unknown }).id === UNKNOWN_ERROR_FLOW_ID && result.errors.length > 0) {
        return { valid: false, errors: [...result.errors, 'Erro estrutural não mapeado nos testes.'] };
      }
      return result;
    },
  };
});

// Same fixture shape as flowTopology.test.ts, but nodes stay loosely typed so
// malformed flows can be expressed without per-field casts.
function brokenFlow(id: string, nodes: Record<string, unknown>, entryNodeId = Object.keys(nodes)[0]): GuidedFlow {
  return {
    id,
    version: '1.0',
    locale: 'pt-BR',
    title: id,
    type: 'guided_conversation',
    status: 'draft',
    entry: { nodeId: entryNodeId, enteringPhrases: ['começar'], transitionMessage: '' },
    nodes: nodes as Record<string, FlowNode>,
  };
}

function structuralIssues(result: ReturnType<typeof validateDashboardFlows>, flowId: string) {
  return result.errors.filter((issue) => issue.id.startsWith(`structural:${flowId}:`));
}

describe('validateDashboardFlows', () => {
  it('reports no structural issues for a well-formed flow', () => {
    const ok = brokenFlow('fluxo-ok', {
      inicio: { id: 'inicio', kind: 'choice', text: 'Oi', options: [{ id: 'op', label: 'Op', next: 'fim' }] },
      fim: { id: 'fim', kind: 'result', text: 'Fim' },
    });

    const result = validateDashboardFlows([ok], []);

    expect(structuralIssues(result, 'fluxo-ok')).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('deep-links an entry that points to a missing node', () => {
    const broken = brokenFlow(
      'entrada-quebrada',
      {
        inicio: { id: 'inicio', kind: 'choice', text: 'Oi', options: [{ id: 'op', label: 'Op', next: 'fim' }] },
        fim: { id: 'fim', kind: 'result', text: 'Fim' },
      },
      'fantasma',
    );

    const result = validateDashboardFlows([broken], []);
    const [issue] = structuralIssues(result, 'entrada-quebrada');

    expect(issue?.path).toBe('entrada-quebrada.entry.nodeId');
    expect(issue?.message).toContain('fantasma');
  });

  it('points into the option chain when an effect navigates to a forbidden destination', () => {
    const broken = brokenFlow('navegacao-proibida', {
      inicio: {
        id: 'inicio',
        kind: 'choice',
        text: 'Para onde?',
        options: [
          { id: 'abrir', label: 'Abrir', next: 'fim', effects: [{ kind: 'navigate', destination: '/youtube' }] },
        ],
      },
      fim: { id: 'fim', kind: 'result', text: 'Fim' },
    });

    const result = validateDashboardFlows([broken], []);
    const issue = result.errors.find((candidate) => candidate.id === 'structural:navegacao-proibida:0');

    expect(issue?.path).toBe('navegacao-proibida.nodes.inicio.options.abrir.effects.0');
    expect(issue?.message).toContain('"abrir"');
  });

  it('points at the offending video when the YouTube URL is invalid', () => {
    const broken = brokenFlow('video-invalido', {
      intro: {
        id: 'intro',
        kind: 'result',
        text: 'Assista',
        videos: [{ id: 'demo', title: 'Demo', url: 'https://exemplo.com/video' }],
      },
    });

    const result = validateDashboardFlows([broken], []);
    const issue = result.errors.find((candidate) => candidate.id === 'structural:video-invalido:0');

    expect(issue?.path).toBe('video-invalido.nodes.intro.videos.0.url');
    expect(issue?.message).toContain('"demo"');
  });

  it('falls back to the generic flow path for unmapped structural errors', () => {
    const broken = brokenFlow(UNKNOWN_ERROR_FLOW_ID, {
      inicio: { id: 'inicio', kind: 'choice', text: 'Oi', options: [{ id: 'op', label: 'Op', next: 'fantasma' }] },
    });

    const result = validateDashboardFlows([broken], []);
    const fallback = result.errors.find((candidate) => candidate.id === `structural:${UNKNOWN_ERROR_FLOW_ID}:1`);

    expect(fallback?.path).toBe(`${UNKNOWN_ERROR_FLOW_ID}.validation`);
    expect(fallback?.message).toContain('erro estrutural');
  });

  it('maps repeated identical errors to successive unnamed nodes', () => {
    const broken = brokenFlow('sem-ids', {
      primeira: { kind: 'result', text: 'Um' },
      segunda: { kind: 'result', text: 'Dois' },
    });

    const result = validateDashboardFlows([broken], []);
    const issues = structuralIssues(result, 'sem-ids').filter((issue) => issue.path.endsWith('.id'));

    expect(issues.map((issue) => issue.path)).toEqual(['sem-ids.nodes.primeira.id', 'sem-ids.nodes.segunda.id']);
  });
});
