import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { GuidedFlow } from '../../../domain/flow-engine/types';
import type { DashboardValidationIssue } from '../../validation/validationTypes';
import { FlowDashboard, resolveFlowValidationTarget } from '../FlowDashboard';
import { installScrollStub } from './scrollStubs';

const flow: GuidedFlow = {
  id: 'check-in',
  version: '1.0',
  locale: 'pt-BR',
  title: 'Check-in',
  type: 'guided_conversation',
  status: 'draft',
  entry: { nodeId: 'q1', enteringPhrases: ['Oi'], transitionMessage: '' },
  nodes: {
    q1: {
      id: 'q1',
      kind: 'choice',
      text: 'Como você está hoje?',
      // Dangling `next` below yields the single validation error used by the
      // dashboard deep-link test; the other effects stay valid.
      options: [
        {
          id: 'go',
          label: 'Ir',
          next: 'fantasma',
          effects: [
            { kind: 'score', scoreKey: 'srq20', value: 1 },
            { kind: 'navigate', destination: '/apoio' },
          ],
        },
      ],
    },
    brancher: {
      id: 'brancher',
      kind: 'score_branch',
      text: 'Calculando o resultado.',
      scoreKey: 'srq20',
      branches: [{ id: 'faixa-1', min: 0, max: 5, next: 'result' }],
    },
    media: {
      id: 'media',
      kind: 'result',
      text: 'Assista antes de continuar.',
      videos: [{ id: 'video-1', title: 'Vídeo', url: 'https://exemplo.com/nao-youtube' }],
    },
    result: { id: 'result', kind: 'result', text: 'Fim.' },
  },
};

function issue(path: string, message = 'Problema de validação.'): DashboardValidationIssue {
  return { level: 'error', area: 'flows', id: `test:${path}`, message, path };
}

describe('resolveFlowValidationTarget', () => {
  it('maps option effect issues to the opcoes section of their node', () => {
    const target = resolveFlowValidationTarget(issue(`${flow.id}.nodes.q1.options.go.effects`), [flow]);

    expect(target).toMatchObject({ flowId: flow.id, nodeId: 'q1', section: 'opcoes' });
    // Representative shape pin: targets carry ONLY map-routing fields — no
    // legacy editor anchors (ariaLabel/initialConfiguration) anywhere.
    expect(Object.keys(target ?? {}).sort()).toEqual(['description', 'flowId', 'nodeId', 'section']);
    expect(target?.description).toContain('no painel da etapa');
  });

  it('maps branch and scoreKey issues to the ramificacao section', () => {
    expect(
      resolveFlowValidationTarget(issue(`${flow.id}.nodes.brancher.branches.faixa-1.navigation`), [flow]),
    ).toMatchObject({
      flowId: flow.id,
      nodeId: 'brancher',
      section: 'ramificacao',
    });
    expect(resolveFlowValidationTarget(issue(`${flow.id}.nodes.brancher.scoreKey`), [flow])).toMatchObject({
      flowId: flow.id,
      nodeId: 'brancher',
      section: 'ramificacao',
    });
  });

  it('maps video url issues to the midia section', () => {
    expect(resolveFlowValidationTarget(issue(`${flow.id}.nodes.media.videos.video-1.url`), [flow])).toMatchObject({
      flowId: flow.id,
      nodeId: 'media',
      section: 'midia',
    });
  });

  it('routes entry and purpose issues to the flow-level configuracoes surface without a node', () => {
    const entryMessage = `A entrada do fluxo "${flow.id}" aponta para a etapa "fantasma", mas ela não existe.`;
    const entryTarget = resolveFlowValidationTarget(issue(`${flow.id}.entry.nodeId`, entryMessage), [flow]);

    expect(entryTarget).toMatchObject({ flowId: flow.id, section: 'configuracoes' });
    expect(entryTarget?.nodeId).toBeUndefined();
    expect(resolveFlowValidationTarget(issue(`${flow.id}.purpose`, 'Propósito inválido.'), [flow])).toMatchObject({
      flowId: flow.id,
      section: 'configuracoes',
    });
  });

  it('falls back to the texto section for generic node issues', () => {
    expect(resolveFlowValidationTarget(issue(`${flow.id}.nodes.result.text`), [flow])).toMatchObject({
      flowId: flow.id,
      nodeId: 'result',
      section: 'texto',
    });
  });

  it('returns null when no flow owns the issue', () => {
    expect(resolveFlowValidationTarget(issue('outro-fluxo.nodes.x.text'), [flow])).toBeNull();
  });
});

describe('FlowDashboard validation deep links', () => {
  it('lands an option issue action on the map tab with the node panel open on its section', async () => {
    const user = userEvent.setup();
    const { stub: scrollIntoViewStub, restore } = installScrollStub();

    try {
      render(<FlowDashboard flows={[flow]} resources={[]} onFlowChange={vi.fn()} />);

      // The dangling option target is the fixture's single error; its action
      // resolves to the map's Opções section for that stage.
      const item = screen
        .getAllByRole('listitem')
        .find((candidate) => candidate.textContent?.includes('corrija o efeito indicado na opção 1'));
      expect(item).toBeDefined();
      await user.click(within(item as HTMLElement).getByRole('button', { name: /corrigir no mapa/i }));

      expect(screen.getByTestId('flow-map-canvas')).toBeInTheDocument();
      expect(screen.getByTestId('node-editor-panel')).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /texto da etapa/i })).toHaveValue('Como você está hoje?');
      expect(scrollIntoViewStub).toHaveBeenCalledWith({ block: 'nearest' });
    } finally {
      restore();
    }
  });
});
