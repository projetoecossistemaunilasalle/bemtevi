import type { ReactElement } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PublishedContentContext } from '../../../app/content/PublishedContentContext';
import { getBundledContent } from '../../../app/content/bundledContent';
import type { PublishedContentPayload } from '../../../app/content/publishedContent';

const mockedFlowRegistry = vi.hoisted(() => ({
  flows: [
    {
      id: 'orientation-understand-feelings',
      version: '1.0.0',
      locale: 'pt-BR',
      title: 'Entender como estou me sentindo',
      type: 'guided_conversation',
      purpose: 'orientation_entry',
      status: 'draft',
      entry: {
        nodeId: 'start',
        enteringPhrases: ['Quero entender como estou me sentindo'],
        transitionMessage: 'Vamos começar de um jeito simples.',
      },
      nodes: {
        start: {
          id: 'start',
          kind: 'choice',
          text: 'Escolha um começo.',
          options: [
            {
              id: 'fixture',
              label: 'Abrir fluxo pelo botão',
              next: 'handoff',
              effects: [{ kind: 'flow_start', flowId: 'fixture-flow' }],
            },
          ],
        },
        handoff: { id: 'handoff', kind: 'result', text: 'Vou abrir o fluxo de teste.' },
      },
    },
    {
      id: 'fixture-flow',
      version: '1.0.0',
      locale: 'pt-BR',
      title: 'Fluxo de teste',
      type: 'guided_conversation',
      status: 'draft',
      entry: {
        nodeId: 'start',
        enteringPhrases: ['Começar fluxo de teste'],
        transitionMessage: 'Primeira mensagem do fluxo de teste.',
      },
      nodes: {
        start: {
          id: 'start',
          kind: 'choice',
          text: 'O que você quer testar?',
          options: [{ id: 'continue', label: 'Continuar teste', next: 'done' }],
        },
        done: { id: 'done', kind: 'result', text: 'Fluxo de teste finalizado.' },
      },
    },
    {
      id: 'second-flow',
      version: '1.0.0',
      locale: 'pt-BR',
      title: 'Segundo fluxo',
      type: 'guided_conversation',
      status: 'draft',
      entry: {
        nodeId: 'start',
        enteringPhrases: ['Começar segundo fluxo'],
        transitionMessage: 'Primeira mensagem do segundo fluxo.',
      },
      nodes: {
        start: {
          id: 'start',
          kind: 'choice',
          text: 'Como deseja seguir?',
          options: [{ id: 'finish', label: 'Finalizar segundo fluxo', next: 'done' }],
        },
        done: { id: 'done', kind: 'result', text: 'Segundo fluxo finalizado.' },
      },
    },
  ],
}));

vi.mock('../../../content/flows/registry', () => ({
  flowRegistry: mockedFlowRegistry,
}));

import { OrientationScreen } from '../OrientationScreen';
import type { GuidedFlow } from '../../../domain/flow-engine/types';

const TYPING_DELAY_MS = 1200;

function buildContentValue(payload: PublishedContentPayload) {
  const snapshot = {
    schemaVersion: '1.0.0',
    revision: 1,
    payload,
    publishedAt: '2026-07-15T00:00:00.000Z',
    publishedBy: 'admin',
  } as const;
  return {
    content: payload,
    snapshot,
    source: 'bundled' as const,
    status: 'ready' as const,
    loadError: null,
    refresh: async () => {},
    publish: async () => snapshot,
  };
}

function renderWithContent(ui: ReactElement, payload: PublishedContentPayload) {
  return render(
    <PublishedContentContext.Provider value={buildContentValue(payload)}>{ui}</PublishedContentContext.Provider>,
  );
}

function renderOrientation() {
  const payload: PublishedContentPayload = {
    ...getBundledContent(),
    flows: mockedFlowRegistry.flows as GuidedFlow[],
  };
  renderWithContent(
    <MemoryRouter>
      <OrientationScreen />
    </MemoryRouter>,
    payload,
  );
}

function advanceInitialLoad() {
  act(() => {
    vi.advanceTimersByTime(TYPING_DELAY_MS);
  });
}

describe('OrientationScreen resume suggestions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows Retomar Fluxo de teste as a clickable empty-input suggestion after an interrupted flow is suspended', () => {
    renderOrientation();

    fireEvent.click(screen.getByRole('button', { name: 'Quero entender como estou me sentindo' }));
    advanceInitialLoad();

    const input = screen.getByPlaceholderText('Digite ou escolha uma opção');

    fireEvent.change(input, { target: { value: 'Começar fluxo' } });
    fireEvent.click(screen.getByRole('option', { name: 'Começar fluxo de teste' }));
    advanceInitialLoad();

    fireEvent.change(input, { target: { value: 'Começar segundo' } });
    fireEvent.click(screen.getByRole('option', { name: 'Começar segundo fluxo' }));
    advanceInitialLoad();

    fireEvent.click(screen.getByRole('option', { name: 'Finalizar segundo fluxo' }));
    advanceInitialLoad();

    const resumeButton = screen.getByRole('option', { name: 'Retomar Fluxo de teste' });

    expect(resumeButton).toBeInTheDocument();
    expect(resumeButton).toBeEnabled();
  });
});
