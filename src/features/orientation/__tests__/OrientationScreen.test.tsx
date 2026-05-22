import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

function startOrientationWithStarter(label = 'Quero entender como estou me sentindo') {
  fireEvent.click(screen.getByRole('button', { name: label }));
  advanceInitialLoad();
}

function routeFromNeutralToWorkStress() {
  fireEvent.click(screen.getByRole('option', { name: 'Parece mais sobre sobrecarga' }));
  advanceInitialLoad();
}

describe('OrientationScreen', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a welcoming pre-chat screen before the chatbot', () => {
    renderOrientation();

    expect(screen.getByRole('heading', { name: 'Antes de começar' })).toBeInTheDocument();
    expect(
      screen.getByText('Escolha um caminho para começar. O SeCuida vai te guiar com perguntas simples, no seu ritmo.'),
    ).toBeInTheDocument();
    expect(screen.getByText('O que você gostaria de fazer agora?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quero entender como estou me sentindo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quero falar sobre o que estou vivendo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quero encontrar um próximo passo de cuidado' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Preciso de um momento mais leve' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Outro' })).toBeInTheDocument();
    expect(screen.getByText('Este espaço é anônimo e não salva sua conversa.')).toBeInTheDocument();

    expect(screen.queryByRole('log', { name: 'Histórico da orientação guiada' })).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Digite ou escolha uma opção')).not.toBeInTheDocument();
  });

  it('renders guided orientation without free-text submission', () => {
    renderOrientation();

    expect(screen.queryByText('Orientação sem cadastro')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Orientação guiada' })).not.toBeInTheDocument();
    expect(screen.queryByText('Opções disponíveis')).not.toBeInTheDocument();
    expect(screen.queryByText('Sobrecarga na escola')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Digite ou escolha uma opção')).not.toBeInTheDocument();
  });

  it('advances the flow immediately when the user clicks a bubble', () => {
    renderOrientation();
    startOrientationWithStarter();
    routeFromNeutralToWorkStress();

    fireEvent.click(screen.getByRole('option', { name: 'Muitas tarefas ao mesmo tempo' }));
    advanceInitialLoad();

    expect(screen.getByPlaceholderText('Digite ou escolha uma opção')).toHaveValue('');
    expect(
      screen.getByText('Quando tudo parece urgente, ajuda separar o que precisa de atenção agora do que pode esperar.'),
    ).toBeInTheDocument();
  });

  it('exposes the conversation as an accessible log with sender context', () => {
    renderOrientation();
    startOrientationWithStarter();

    expect(screen.getByRole('log', { name: 'Histórico da orientação guiada' })).toBeInTheDocument();
    expect(screen.getAllByText('SeCuida')).toHaveLength(2);
  });

  it('starts SRQ-20 through chatbot autocomplete from JSON flow content', () => {
    renderOrientation();
    startOrientationWithStarter();

    fireEvent.change(screen.getByPlaceholderText('Digite ou escolha uma opção'), {
      target: { value: 'SRQ-20' },
    });

    fireEvent.click(screen.getByRole('option', { name: 'Quero responder o SRQ-20' }));
    advanceInitialLoad();

    expect(screen.getByText(/Este é o SRQ-20/i)).toBeInTheDocument();
    expect(screen.getByText(/Antes de começar/i)).toBeInTheDocument();
  });

  it('does not render a questionnaire-specific screen entry', () => {
    renderOrientation();

    expect(screen.queryByRole('link', { name: /SRQ-20/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Responder SRQ-20/i })).not.toBeInTheDocument();
  });

  it('keeps the composer fixed as a chat input above the page navigation after the intro', () => {
    renderOrientation();
    startOrientationWithStarter();

    expect(screen.getByTestId('orientation-composer')).toHaveClass('fixed');
    expect(screen.getByRole('button', { name: 'Enviar opção selecionada' })).toHaveAttribute('data-icon', 'send');
  });

  it('only enables send when the input exactly matches an available option', () => {
    renderOrientation();
    startOrientationWithStarter();
    routeFromNeutralToWorkStress();

    const input = screen.getByPlaceholderText('Digite ou escolha uma opção');
    const sendButton = screen.getByRole('button', { name: 'Enviar opção selecionada' });

    expect(sendButton).toBeDisabled();

    fireEvent.change(input, { target: { value: 'qualquer coisa' } });
    expect(sendButton).toBeDisabled();

    fireEvent.change(input, { target: { value: 'Dificuldade para descansar' } });
    expect(sendButton).toBeEnabled();
  });

  it('shows matching options in an autocomplete overlay above the input', () => {
    renderOrientation();
    startOrientationWithStarter();
    routeFromNeutralToWorkStress();

    fireEvent.change(screen.getByPlaceholderText('Digite ou escolha uma opção'), {
      target: { value: 'descansar' },
    });

    expect(screen.getByRole('listbox', { name: 'Sugestões de resposta' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Dificuldade para descansar' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Muitas tarefas ao mesmo tempo' })).not.toBeInTheDocument();
  });

  it('hides suggestions when input exactly matches an option label', () => {
    renderOrientation();
    startOrientationWithStarter();
    routeFromNeutralToWorkStress();

    const input = screen.getByPlaceholderText('Digite ou escolha uma opção');

    expect(screen.getByRole('option', { name: 'Muitas tarefas ao mesmo tempo' })).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'Muitas tarefas ao mesmo tempo' } });

    expect(screen.queryByRole('listbox', { name: 'Sugestões de resposta' })).not.toBeInTheDocument();
  });

  it('shows suggestions when trailing space breaks strict match but send stays enabled', () => {
    renderOrientation();
    startOrientationWithStarter();
    routeFromNeutralToWorkStress();

    const input = screen.getByPlaceholderText('Digite ou escolha uma opção');
    const sendButton = screen.getByRole('button', { name: 'Enviar opção selecionada' });

    fireEvent.change(input, { target: { value: 'Dificuldade para descansar' } });
    expect(screen.queryByRole('listbox', { name: 'Sugestões de resposta' })).not.toBeInTheDocument();
    expect(sendButton).toBeEnabled();

    fireEvent.change(input, { target: { value: 'Dificuldade para descansar ' } });
    expect(screen.getByRole('listbox', { name: 'Sugestões de resposta' })).toBeInTheDocument();
    expect(sendButton).toBeEnabled();
  });

  it('shows typing indicator before initial greeting appears', () => {
    renderOrientation();
    fireEvent.click(screen.getByRole('button', { name: 'Quero entender como estou me sentindo' }));

    expect(
      screen.queryByText('Vamos começar de um jeito simples, sem precisar fechar uma resposta agora.'),
    ).not.toBeInTheDocument();
    expect(screen.getByText('SeCuida')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Carregando conversa');

    advanceInitialLoad();

    expect(
      screen.getByText('Vamos começar de um jeito simples, sem precisar fechar uma resposta agora.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Parece mais sobre sobrecarga' })).toBeInTheDocument();
  });

  it('starts the chatbot after a starter and records the starter as a user message', () => {
    renderOrientation();

    fireEvent.click(screen.getByRole('button', { name: 'Quero falar sobre o que estou vivendo' }));

    expect(screen.queryByRole('heading', { name: 'Antes de começar' })).not.toBeInTheDocument();
    expect(screen.queryByText('Quero falar sobre o que estou vivendo')).not.toBeInTheDocument();
    expect(screen.getByText('SeCuida')).toBeInTheDocument();

    advanceInitialLoad();

    expect(screen.getByText('Quero falar sobre o que estou vivendo')).toBeInTheDocument();
    expect(screen.getByText('Podemos organizar isso por partes, sem pressa.')).toBeInTheDocument();
  });

  it('starts the default neutral flow from Outro without adding Outro as a conversation message', () => {
    renderOrientation();

    fireEvent.click(screen.getByRole('button', { name: 'Outro' }));
    advanceInitialLoad();

    expect(screen.queryByText(/^Outro$/)).not.toBeInTheDocument();
    expect(
      screen.getByText('Vamos começar de um jeito simples, sem precisar fechar uma resposta agora.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Parece mais sobre sobrecarga' })).toBeInTheDocument();
  });

  it('shows user message immediately and bot response after delay when selecting a node option', () => {
    renderOrientation();
    startOrientationWithStarter();
    routeFromNeutralToWorkStress();

    fireEvent.click(screen.getByRole('option', { name: 'Muitas tarefas ao mesmo tempo' }));

    expect(screen.getByText('Muitas tarefas ao mesmo tempo')).toBeInTheDocument();
    expect(
      screen.queryByText(
        'Quando tudo parece urgente, ajuda separar o que precisa de atenção agora do que pode esperar.',
      ),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('option')).not.toBeInTheDocument();

    advanceInitialLoad();

    expect(
      screen.getByText('Quando tudo parece urgente, ajuda separar o que precisa de atenção agora do que pode esperar.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Quero pensar em uma pausa curta' })).toBeInTheDocument();
  });

  it('disables input and send while revealing bot messages', () => {
    renderOrientation();
    startOrientationWithStarter();
    routeFromNeutralToWorkStress();

    fireEvent.click(screen.getByRole('option', { name: 'Muitas tarefas ao mesmo tempo' }));

    const input = screen.getByPlaceholderText('Digite ou escolha uma opção');
    const sendButton = screen.getByRole('button', { name: 'Enviar opção selecionada' });

    expect(input).toBeDisabled();
    expect(sendButton).toBeDisabled();

    advanceInitialLoad();

    expect(input).not.toBeDisabled();
    expect(sendButton).toBeDisabled();
  });

  it('starts the selected neutral orientation flow', () => {
    renderOrientation();
    startOrientationWithStarter('Quero encontrar um próximo passo de cuidado');

    expect(screen.getByText('Quero encontrar um próximo passo de cuidado')).toBeInTheDocument();
    expect(screen.getByText('Vamos escolher um próximo passo possível para agora.')).toBeInTheDocument();
    expect(screen.getByText('Que tipo de próximo passo parece mais útil?')).toBeInTheDocument();
  });

  it('shows neutral app-destination options', () => {
    renderOrientation();
    startOrientationWithStarter('Quero encontrar um próximo passo de cuidado');

    fireEvent.click(screen.getByRole('option', { name: 'Materiais, contatos ou apoio' }));
    advanceInitialLoad();

    expect(screen.getByRole('option', { name: 'Abrir materiais educativos' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Abrir contatos de apoio' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Abrir apoio agora' })).toBeInTheDocument();
  });

  it('routes from a neutral option into a specific guided flow', () => {
    renderOrientation();
    startOrientationWithStarter();

    fireEvent.click(screen.getByRole('option', { name: 'Parece mais sobre sobrecarga' }));
    advanceInitialLoad();

    expect(screen.getByText('Parece mais sobre sobrecarga')).toBeInTheDocument();
    expect(screen.getByText(/Vamos olhar para essa sobrecarga com calma/)).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Muitas tarefas ao mesmo tempo' })).toBeInTheDocument();
  });

  it('offers a calm next-step route after a regular flow result', () => {
    renderOrientation();
    startOrientationWithStarter();

    fireEvent.click(screen.getByRole('option', { name: 'Parece mais sobre sobrecarga' }));
    advanceInitialLoad();

    fireEvent.click(screen.getByRole('option', { name: 'Muitas tarefas ao mesmo tempo' }));
    advanceInitialLoad();

    fireEvent.click(screen.getByRole('option', { name: 'Quero pensar em uma pausa curta' }));
    advanceInitialLoad();

    expect(
      screen.getByText(
        'Experimente pausar por um minuto, soltar os ombros e escolher apenas uma ação pequena para agora.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Escolher o que fazer agora' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('option', { name: 'Escolher o que fazer agora' }));
    advanceInitialLoad();

    expect(
      screen.getByText('Antes de encerrar, você pode escolher com calma o que faz sentido agora.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Qual próximo passo você prefere?')).toBeInTheDocument();
  });
});
