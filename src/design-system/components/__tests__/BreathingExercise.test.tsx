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

  it('starts ambient sound when starting the exercise with sound enabled', () => {
    render(<BreathingExercise />);

    const soundButton = screen.getByRole('button', { name: 'Som ambiente ativado' });
    expect(soundButton).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Começar a respirar' }));
    expect(play).toHaveBeenCalledOnce();
  });

  it('allows disabling ambient sound before starting', () => {
    render(<BreathingExercise />);

    const soundButton = screen.getByRole('button', { name: 'Som ambiente ativado' });
    fireEvent.click(soundButton);
    expect(screen.getByRole('button', { name: 'Ativar som ambiente' })).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByRole('button', { name: 'Começar a respirar' }));
    expect(play).not.toHaveBeenCalled();
  });

  it('stops and resets ambient sound when the exercise stops', () => {
    render(<BreathingExercise />);

    fireEvent.click(screen.getByRole('button', { name: 'Começar a respirar' }));
    expect(play).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: 'Parar' }));

    expect(pause).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Começar a respirar' })).toBeInTheDocument();
  });

  it('toggles ambient sound on and off during active exercise', () => {
    render(<BreathingExercise />);

    fireEvent.click(screen.getByRole('button', { name: 'Começar a respirar' }));
    expect(play).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: 'Som ambiente ativado' }));
    expect(pause).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: 'Ativar som ambiente' }));
    expect(play).toHaveBeenCalledTimes(2);
  });

  it('falls back to the silent exercise when playback is blocked', async () => {
    play.mockRejectedValueOnce(new Error('playback blocked'));
    render(<BreathingExercise />);

    fireEvent.click(screen.getByRole('button', { name: 'Começar a respirar' }));

    expect(
      await screen.findByText('Não foi possível reproduzir o som neste dispositivo. O exercício continua sem áudio.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ativar som ambiente' })).toHaveAttribute('aria-pressed', 'false');
  });
});
