import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BreathingExercise } from '../BreathingExercise';

describe('BreathingExercise', () => {
  const play = vi.fn<() => Promise<void>>();
  const pause = vi.fn<() => void>();

  beforeEach(() => {
    play.mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(play);
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(pause);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    play.mockReset();
    pause.mockReset();
  });

  it('keeps ambient sound opt-in and starts it with the exercise', () => {
    render(<BreathingExercise />);

    const soundButton = screen.getByRole('button', { name: 'Ativar som ambiente' });
    expect(soundButton).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(soundButton);
    expect(play).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Som ambiente ativado' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Começar a respirar' }));
    expect(play).toHaveBeenCalledOnce();
  });

  it('stops and resets ambient sound when the exercise stops', () => {
    render(<BreathingExercise />);

    fireEvent.click(screen.getByRole('button', { name: 'Ativar som ambiente' }));
    fireEvent.click(screen.getByRole('button', { name: 'Começar a respirar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Parar' }));

    expect(pause).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Começar a respirar' })).toBeInTheDocument();
  });

  it('falls back to the silent exercise when playback is blocked', async () => {
    play.mockRejectedValueOnce(new Error('playback blocked'));
    render(<BreathingExercise />);

    fireEvent.click(screen.getByRole('button', { name: 'Começar a respirar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ativar som ambiente' }));

    expect(
      await screen.findByText('Não foi possível reproduzir o som neste dispositivo. O exercício continua sem áudio.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ativar som ambiente' })).toHaveAttribute('aria-pressed', 'false');
  });
});
