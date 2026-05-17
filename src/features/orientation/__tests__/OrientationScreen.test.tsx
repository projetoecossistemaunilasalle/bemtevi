import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { OrientationScreen } from '../OrientationScreen';

describe('OrientationScreen', () => {
  it('renders guided orientation without free-text submission', () => {
    render(
      <MemoryRouter>
        <OrientationScreen />
      </MemoryRouter>,
    );

    expect(screen.queryByText('Orientação sem cadastro')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Orientação guiada' })).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Digite ou escolha uma opção')).toBeInTheDocument();
    expect(screen.queryByText('Opções disponíveis')).not.toBeInTheDocument();
    expect(screen.queryByText('Sobrecarga na escola')).not.toBeInTheDocument();
  });

  it('advances the flow immediately when the user clicks a bubble', () => {
    render(
      <MemoryRouter>
        <OrientationScreen />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('option', { name: 'Muitas tarefas ao mesmo tempo' }));

    expect(screen.getByPlaceholderText('Digite ou escolha uma opção')).toHaveValue('');
    expect(
      screen.getByText('Quando tudo parece urgente, ajuda separar o que precisa de atenção agora do que pode esperar.'),
    ).toBeInTheDocument();
  });

  it('exposes the conversation as an accessible log with sender context', () => {
    render(
      <MemoryRouter>
        <OrientationScreen />
      </MemoryRouter>,
    );

    expect(screen.getByRole('log', { name: 'Histórico da orientação guiada' })).toBeInTheDocument();
    expect(screen.getAllByText('SeCuida')).toHaveLength(2);
  });

  it('starts SRQ-20 through chatbot autocomplete from JSON flow content', () => {
    render(
      <MemoryRouter>
        <OrientationScreen />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText('Digite ou escolha uma opção'), {
      target: { value: 'SRQ-20' },
    });

    fireEvent.click(screen.getByRole('option', { name: 'Quero responder o SRQ-20' }));

    expect(screen.getByText(/Este é o SRQ-20/i)).toBeInTheDocument();
    expect(screen.getByText(/Antes de começar/i)).toBeInTheDocument();
  });

  it('does not render a questionnaire-specific screen entry', () => {
    render(
      <MemoryRouter>
        <OrientationScreen />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('link', { name: /SRQ-20/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Responder SRQ-20/i })).not.toBeInTheDocument();
  });

  it('keeps the composer fixed as a chat input above the page navigation', () => {
    render(
      <MemoryRouter>
        <OrientationScreen />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('orientation-composer')).toHaveClass('fixed');
    expect(screen.getByRole('button', { name: 'Enviar opção selecionada' })).toHaveAttribute('data-icon', 'send');
  });

  it('only enables send when the input exactly matches an available option', () => {
    render(
      <MemoryRouter>
        <OrientationScreen />
      </MemoryRouter>,
    );

    const input = screen.getByPlaceholderText('Digite ou escolha uma opção');
    const sendButton = screen.getByRole('button', { name: 'Enviar opção selecionada' });

    expect(sendButton).toBeDisabled();

    fireEvent.change(input, { target: { value: 'qualquer coisa' } });
    expect(sendButton).toBeDisabled();

    fireEvent.change(input, { target: { value: 'Dificuldade para descansar' } });
    expect(sendButton).toBeEnabled();
  });

  it('shows matching options in an autocomplete overlay above the input', () => {
    render(
      <MemoryRouter>
        <OrientationScreen />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText('Digite ou escolha uma opção'), {
      target: { value: 'descansar' },
    });

    expect(screen.getByRole('listbox', { name: 'Sugestões de resposta' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Dificuldade para descansar' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Muitas tarefas ao mesmo tempo' })).not.toBeInTheDocument();
  });

  it('hides suggestions when input exactly matches an option label', () => {
    render(
      <MemoryRouter>
        <OrientationScreen />
      </MemoryRouter>,
    );

    const input = screen.getByPlaceholderText('Digite ou escolha uma opção');

    // Initially, node_option pills are visible
    expect(screen.getByRole('option', { name: 'Muitas tarefas ao mesmo tempo' })).toBeInTheDocument();

    // Type an exact match
    fireEvent.change(input, { target: { value: 'Muitas tarefas ao mesmo tempo' } });

    // Suggestions should be hidden
    expect(screen.queryByRole('listbox', { name: 'Sugestões de resposta' })).not.toBeInTheDocument();
  });

  it('shows suggestions when trailing space breaks strict match but send stays enabled', () => {
    render(
      <MemoryRouter>
        <OrientationScreen />
      </MemoryRouter>,
    );

    const input = screen.getByPlaceholderText('Digite ou escolha uma opção');
    const sendButton = screen.getByRole('button', { name: 'Enviar opção selecionada' });

    // Type exact match — suggestions hidden, send enabled
    fireEvent.change(input, { target: { value: 'Dificuldade para descansar' } });
    expect(screen.queryByRole('listbox', { name: 'Sugestões de resposta' })).not.toBeInTheDocument();
    expect(sendButton).toBeEnabled();

    // Add trailing space — strict match breaks, suggestions reappear, send stays enabled
    fireEvent.change(input, { target: { value: 'Dificuldade para descansar ' } });
    expect(screen.getByRole('listbox', { name: 'Sugestões de resposta' })).toBeInTheDocument();
    expect(sendButton).toBeEnabled();
  });
});
