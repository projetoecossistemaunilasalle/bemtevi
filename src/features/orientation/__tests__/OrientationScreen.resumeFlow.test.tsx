import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

const TYPING_DELAY_MS = 1200;

function renderOrientation() {
  render(
    <MemoryRouter>
      <OrientationScreen />
    </MemoryRouter>,
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
