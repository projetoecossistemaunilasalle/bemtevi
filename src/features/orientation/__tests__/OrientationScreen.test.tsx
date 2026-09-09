import type { ReactElement } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PublishedContentContext } from '../../../app/content/PublishedContentContext';
import { getBundledContent } from '../../../app/content/bundledContent';
import type { PublishedContentPayload } from '../../../app/content/publishedContent';

const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

import { OrientationScreen } from '../OrientationScreen';

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
    source: 'database' as const,
    status: 'ready' as const,
    loadError: null,
    refresh: async () => {},
    publish: async () => snapshot,
  };
}

function renderWithContent(ui: ReactElement, payload: PublishedContentPayload = getBundledContent()) {
  return render(
    <PublishedContentContext.Provider value={buildContentValue(payload)}>{ui}</PublishedContentContext.Provider>,
  );
}

function buildDatabaseFlowsPayload(transitionMessage: string): PublishedContentPayload {
  const bundled = getBundledContent();
  const flows = bundled.flows.map((flow) =>
    flow.id === 'orientation-understand-feelings' ? { ...flow, entry: { ...flow.entry, transitionMessage } } : flow,
  );
  return { ...bundled, flows };
}

function renderOrientation(payload: PublishedContentPayload = getBundledContent()) {
  return renderWithContent(
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

function startOrientationWithStarter(label = 'Quero entender como estou me sentindo') {
  fireEvent.click(screen.getByRole('button', { name: label }));
  advanceInitialLoad();
}

describe('OrientationScreen', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a welcoming pre-chat screen before the chatbot', () => {
    renderOrientation();

    expect(screen.getByRole('heading', { name: 'Antes de começar' })).toBeInTheDocument();
    expect(
      screen.getByText('Escolha um caminho para começar. O BemTeVi vai te guiar com perguntas simples, no seu ritmo.'),
    ).toBeInTheDocument();
    expect(screen.getByText('O que você gostaria de fazer agora?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quero entender como estou me sentindo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quero organizar o que estou vivendo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quero encontrar um próximo passo de cuidado' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Preciso de um momento mais leve' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Outro' })).not.toBeInTheDocument();
    expect(screen.getByText('Este espaço não pede sua identificação e não salva sua conversa.')).toBeInTheDocument();

    expect(screen.queryByRole('log', { name: 'Histórico da orientação guiada' })).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Digite ou escolha uma opção')).not.toBeInTheDocument();
  });

  it('keeps orientation answers in memory instead of browser storage', () => {
    renderOrientation();
    startOrientationWithStarter();

    fireEvent.click(screen.getByRole('option', { name: 'Tenho me sentido sobrecarregado(a).' }));
    advanceInitialLoad();
    fireEvent.click(screen.getByRole('option', { name: 'Sinto que tenho coisas demais para resolver.' }));

    expect(window.localStorage).toHaveLength(0);
    expect(window.sessionStorage).toHaveLength(0);
  });

  it('keeps questionnaire answers and scores in memory instead of browser storage', () => {
    renderOrientation();
    startOrientationWithStarter();

    fireEvent.change(screen.getByPlaceholderText('Digite ou escolha uma opção'), {
      target: { value: 'SRQ-20' },
    });
    fireEvent.click(screen.getByRole('option', { name: 'Quero responder o SRQ-20' }));
    advanceInitialLoad();
    fireEvent.click(screen.getByRole('option', { name: 'Quero responder' }));
    advanceInitialLoad();
    fireEvent.click(screen.getByRole('option', { name: 'Continuar' }));
    advanceInitialLoad();
    fireEvent.click(screen.getByRole('option', { name: 'Sim' }));

    expect(window.localStorage).toHaveLength(0);
    expect(window.sessionStorage).toHaveLength(0);
  });

  it('advances the flow immediately when the user clicks a bubble', () => {
    renderOrientation();
    startOrientationWithStarter();

    fireEvent.click(screen.getByRole('option', { name: 'Tenho me sentido sobrecarregado(a).' }));
    advanceInitialLoad();

    fireEvent.click(screen.getByRole('option', { name: 'Sinto que tenho coisas demais para resolver.' }));
    advanceInitialLoad();

    expect(screen.getByPlaceholderText('Digite ou escolha uma opção')).toHaveValue('');
    expect(screen.getByText(/O vídeo abaixo apresenta uma forma simples/)).toBeInTheDocument();
  });

  it('exposes the conversation as an accessible log with sender context', () => {
    renderOrientation();
    startOrientationWithStarter();

    const log = screen.getByRole('log', { name: 'Histórico da orientação guiada' });
    expect(log).toBeInTheDocument();
    expect(screen.getByText('Quero entender como estou me sentindo')).toBeInTheDocument();
    expect(screen.getByText('O que mais se aproxima do seu momento agora?')).toBeInTheDocument();
  });

  it('shows typing indicator and disables composer while the bot is answering', () => {
    renderOrientation();
    fireEvent.click(screen.getByRole('button', { name: 'Quero entender como estou me sentindo' }));

    expect(screen.getByText('Carregando conversa')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Digite ou escolha uma opção')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Enviar opção selecionada' })).toBeDisabled();

    advanceInitialLoad();

    expect(screen.queryByText('Carregando conversa')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Digite ou escolha uma opção')).toBeEnabled();
  });

  it('scrolls the chat window to the bottom when visible messages update', () => {
    renderOrientation();
    const scrollToMock = vi.fn();
    const logElement = document.createElement('div');
    logElement.setAttribute('role', 'log');
    logElement.setAttribute('aria-label', 'Histórico da orientação guiada');
    Object.defineProperty(logElement, 'scrollHeight', { value: 1200, configurable: true });
    Object.defineProperty(logElement, 'scrollTop', { value: 0, writable: true, configurable: true });
    logElement.scrollTo = scrollToMock;

    startOrientationWithStarter();

    expect(screen.getByRole('log', { name: 'Histórico da orientação guiada' })).toBeInTheDocument();
  });

  it('supports full keyboard navigation through options and composer', () => {
    renderOrientation();
    startOrientationWithStarter();

    const input = screen.getByPlaceholderText('Digite ou escolha uma opção');
    fireEvent.change(input, { target: { value: 'sobrecarregado' } });

    const option = screen.getByRole('option', { name: 'Tenho me sentido sobrecarregado(a).' });
    expect(option).toBeInTheDocument();

    fireEvent.click(option);
    advanceInitialLoad();

    expect(screen.getByText(/Quando muitas demandas se acumulam/)).toBeInTheDocument();
  });

  it('shows the document visual where the organization flow requests it', () => {
    renderOrientation();
    startOrientationWithStarter('Quero organizar o que estou vivendo');

    fireEvent.click(
      screen.getByRole('option', { name: 'Preciso decidir o que fazer primeiro diante de várias situações.' }),
    );
    advanceInitialLoad();

    expect(
      screen.getByRole('img', {
        name: 'Recurso visual para decidir se algo precisa ser resolvido hoje, pode ser planejado, precisa aguardar ou pode ficar em espera.',
      }),
    ).toBeInTheDocument();
  });

  it('shows the organization starter transition message', () => {
    renderOrientation();
    startOrientationWithStarter('Quero organizar o que estou vivendo');

    expect(
      screen.getByText(
        'Às vezes, sabemos como estamos nos sentindo, mas ainda precisamos encontrar uma forma de lidar com aquilo que está acontecendo.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('O que mais se aproxima do que você está vivendo?')).toBeInTheDocument();
  });

  it('shows the next-care starter transition message', () => {
    renderOrientation();
    startOrientationWithStarter('Quero encontrar um próximo passo de cuidado');

    expect(
      screen.getByText(
        'Nem sempre o próximo passo precisa ser grande. Às vezes, uma ação pequena e possível já pode ajudar a começar a cuidar do que você precisa agora.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Que tipo de próximo passo parece mais útil?')).toBeInTheDocument();
  });

  it('shows the document visual for the support network step', () => {
    renderOrientation();
    startOrientationWithStarter('Quero encontrar um próximo passo de cuidado');

    fireEvent.click(screen.getByRole('option', { name: 'Quero buscar apoio de alguém.' }));
    advanceInitialLoad();

    expect(
      screen.getByRole('img', { name: 'Recurso visual para identificar pessoas e formas de apoio na rede pessoal.' }),
    ).toBeInTheDocument();
  });

  it('shows the document visual for a difficult conversation', () => {
    renderOrientation();
    startOrientationWithStarter('Quero organizar o que estou vivendo');

    fireEvent.click(
      screen.getByRole('option', { name: 'Preciso lidar com uma conversa ou situação difícil com alguém.' }),
    );
    advanceInitialLoad();

    expect(screen.getByRole('img', { name: 'Recurso visual para preparar uma conversa difícil.' })).toBeInTheDocument();
  });

  it('shows the document visual for a calm practice', () => {
    renderOrientation();
    startOrientationWithStarter('Preciso de um momento mais leve');

    fireEvent.click(screen.getByRole('option', { name: 'Quero fazer uma prática rápida.' }));
    advanceInitialLoad();

    fireEvent.click(screen.getByRole('option', { name: 'Respiração Borboleta.' }));
    advanceInitialLoad();

    expect(screen.getByRole('img', { name: 'Passo a passo da Respiração Borboleta.' })).toBeInTheDocument();
  });

  it('renders interactive breathing exercise for short pause (b2-pausa-curta)', () => {
    renderOrientation();
    startOrientationWithStarter('Quero entender como estou me sentindo');

    fireEvent.click(screen.getByRole('option', { name: 'Tenho me sentido cansado(a) e preciso descansar.' }));
    advanceInitialLoad();

    fireEvent.click(screen.getByRole('option', { name: 'Fazer uma pausa curta.' }));
    advanceInitialLoad();

    expect(screen.getByRole('button', { name: 'Começar a respirar' })).toBeInTheDocument();
    expect(
      screen.getByText('Uma pausa curta pode ajudar a interromper, por alguns instantes, o ritmo das demandas.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Técnica de respiração seguindo figuras geométricas')).not.toBeInTheDocument();
  });

  it('renders interactive breathing exercise for irritation (c4-irritacao)', () => {
    renderOrientation();
    startOrientationWithStarter('Quero entender como estou me sentindo');

    fireEvent.click(screen.getByRole('option', { name: 'Tenho percebido emoções difíceis de lidar.' }));
    advanceInitialLoad();

    fireEvent.click(screen.getByRole('option', { name: 'Tenho ficado irritado(a) ou impaciente.' }));
    advanceInitialLoad();

    expect(screen.getByRole('button', { name: 'Começar a respirar' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'A irritabilidade pode aparecer quando os limites foram ultrapassados por muito tempo. Faça uma pausa e realize respirações lentas.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Respiração geométrica')).not.toBeInTheDocument();
  });

  it('continues SRQ-20 after Q17 yes and navigates to apoio only after the final result', () => {
    renderOrientation();

    startOrientationWithStarter();

    fireEvent.change(screen.getByPlaceholderText('Digite ou escolha uma opção'), {
      target: { value: 'SRQ-20' },
    });
    fireEvent.click(screen.getByRole('option', { name: 'Quero responder o SRQ-20' }));
    advanceInitialLoad();

    fireEvent.click(screen.getByRole('option', { name: 'Quero responder' }));
    advanceInitialLoad();

    fireEvent.click(screen.getByRole('option', { name: 'Continuar' }));
    advanceInitialLoad();

    for (let question = 1; question <= 16; question++) {
      fireEvent.click(screen.getByRole('option', { name: 'Não' }));
      advanceInitialLoad();
    }

    fireEvent.click(screen.getByRole('option', { name: 'Sim' }));
    advanceInitialLoad();

    expect(screen.getByText(/Sente-se cansado/i)).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalledWith('/apoio');

    fireEvent.click(screen.getByRole('option', { name: 'Não' }));
    advanceInitialLoad();
    fireEvent.click(screen.getByRole('option', { name: 'Não' }));
    advanceInitialLoad();
    fireEvent.click(screen.getByRole('option', { name: 'Não' }));
    advanceInitialLoad();

    expect(screen.getByText(/Obrigado por responder com sinceridade/i)).toBeInTheDocument();
    expect(mockNavigate).toHaveBeenCalledWith('/apoio');
  });

  it('uses database flows for a newly started orientation conversation', () => {
    const payload = buildDatabaseFlowsPayload('Mensagem inicial vinda do banco de dados.');
    renderOrientation(payload);

    fireEvent.click(screen.getByRole('button', { name: 'Quero entender como estou me sentindo' }));
    advanceInitialLoad();

    expect(screen.getByText('Mensagem inicial vinda do banco de dados.')).toBeInTheDocument();
    expect(
      screen.queryByText(
        'Vamos começar de um jeito simples. Você não precisa ter uma resposta pronta. Escolha a opção que mais se aproxima de como você está neste momento.',
      ),
    ).not.toBeInTheDocument();
  });

  it('keeps an already-started orientation on its original flow snapshot after provider refresh', () => {
    const payloadA = buildDatabaseFlowsPayload('Mensagem do banco A.');
    const { rerender } = renderOrientation(payloadA);

    fireEvent.click(screen.getByRole('button', { name: 'Quero entender como estou me sentindo' }));
    advanceInitialLoad();

    expect(screen.getByText('Mensagem do banco A.')).toBeInTheDocument();

    const payloadB = buildDatabaseFlowsPayload('Mensagem do banco B.');
    rerender(
      <PublishedContentContext.Provider value={buildContentValue(payloadB)}>
        <MemoryRouter>
          <OrientationScreen />
        </MemoryRouter>
      </PublishedContentContext.Provider>,
    );

    expect(screen.getByText('Mensagem do banco A.')).toBeInTheDocument();
    expect(screen.queryByText('Mensagem do banco B.')).not.toBeInTheDocument();
  });
});
