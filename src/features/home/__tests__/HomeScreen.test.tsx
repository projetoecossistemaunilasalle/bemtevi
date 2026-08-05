import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { HomeScreen } from '../HomeScreen';

function renderHome() {
  return render(
    <MemoryRouter>
      <HomeScreen />
    </MemoryRouter>,
  );
}

describe('HomeScreen onboarding', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('shows onboarding on the first visit and marks it seen when skipped', async () => {
    renderHome();

    expect(document.querySelector('[data-onboarding-screen]')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Pular' }));

    expect(window.localStorage.getItem('bemtevi:onboarding-seen')).toBe('true');
    await waitFor(() => {
      expect(document.querySelector('[data-onboarding-screen]')).not.toBeInTheDocument();
    });
  });

  it('marks onboarding seen when completed and does not show it on a later visit', async () => {
    const firstVisit = renderHome();

    for (let step = 0; step < 3; step += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    }
    fireEvent.click(screen.getByRole('button', { name: 'Começar' }));

    expect(window.localStorage.getItem('bemtevi:onboarding-seen')).toBe('true');

    firstVisit.unmount();
    renderHome();

    await waitFor(() => {
      expect(document.querySelector('[data-onboarding-screen]')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { name: 'Como você está hoje?' })).toBeInTheDocument();
  });
});
