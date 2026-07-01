import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OnboardingScreen } from '../OnboardingScreen';

describe('OnboardingScreen', () => {
  it('does not offer skip on the first onboarding screen', () => {
    render(<OnboardingScreen onContinue={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /pular/i })).not.toBeInTheDocument();
  });

  it('requires users to accept the final test-version and sharing acknowledgements before starting', async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();

    render(<OnboardingScreen onContinue={onContinue} />);

    await user.click(screen.getByRole('button', { name: /continuar/i }));
    await user.click(screen.getByRole('button', { name: /continuar/i }));
    await user.click(screen.getByRole('button', { name: /continuar/i }));

    const startButton = screen.getByRole('button', { name: /começar/i });
    expect(startButton).toBeDisabled();

    await user.click(screen.getByLabelText(/conteúdo é apenas orientativo/i));
    await user.click(screen.getByLabelText(/não vou compartilhar o acesso/i));

    expect(startButton).toBeEnabled();

    await user.click(startButton);

    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
