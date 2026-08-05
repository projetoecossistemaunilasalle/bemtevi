import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OnboardingScreen } from '../OnboardingScreen';

describe('OnboardingScreen', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('explains what is and is not stored without absolute privacy claims', () => {
    render(<OnboardingScreen onContinue={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(screen.queryByText(/Nada do que você faz aqui é salvo/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/nenhum dado é salvo/i)).not.toBeInTheDocument();
    expect(screen.getByText(/suas respostas e conversas não são salvas/i)).toBeInTheDocument();
    expect(screen.getByText(/o navegador guarda apenas uma preferência não sensível/i)).toBeInTheDocument();
  });
});
