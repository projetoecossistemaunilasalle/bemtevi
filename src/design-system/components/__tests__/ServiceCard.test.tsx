import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import type { ServiceDirectoryEntry } from '../../../domain/services/types';
import { ServiceCard } from '../ServiceCard';

const longNotes =
  'Atendimento psicossocial para adultos em sofrimento ou que apresentam transtornos mentais graves e persistentes. Atende demanda espontânea e encaminhamentos da rede, com equipe multidisciplinar.';

function buildService(patch: Partial<ServiceDirectoryEntry> = {}): ServiceDirectoryEntry {
  return {
    id: 'test-service',
    name: 'CAPS Teste',
    type: 'CAPS',
    badgeTone: 'primary',
    city: 'Canoas',
    state: 'RS',
    address: 'Av. Teste, 1 - Centro, Canoas - RS',
    phoneDisplay: '(51) 1234-5678',
    phoneHref: 'tel:5112345678',
    review: { status: 'pending_review', reviewedBy: null, reviewedAt: null, notes: '' },
    ...patch,
  };
}

afterEach(() => {
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollHeight;
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientHeight;
});

describe('ServiceCard', () => {
  it('hides the toggle when the note fits within the clamped height', () => {
    render(<ServiceCard service={buildService({ notes: 'Mediante agendamento prévio.' })} />);

    expect(screen.queryByRole('button', { name: /ver mais/i })).not.toBeInTheDocument();
    expect(screen.getByText('Mediante agendamento prévio.')).toBeInTheDocument();
  });

  it('shows the toggle and expands the note when it overflows', async () => {
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      get: () => 200,
    });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get: () => 60,
    });
    const user = userEvent.setup();
    render(<ServiceCard service={buildService({ notes: longNotes })} />);

    const toggle = screen.getByRole('button', { name: /ver mais/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText(longNotes)).toBeInTheDocument();

    await user.click(toggle);

    expect(screen.getByRole('button', { name: /ver menos/i })).toHaveAttribute('aria-expanded', 'true');
  });

  it('renders the city chip and the call action', () => {
    render(<ServiceCard service={buildService()} />);

    expect(screen.getByText('Canoas - RS')).toBeInTheDocument();
    expect(screen.getAllByRole('link').some((link) => link.getAttribute('href') === 'tel:5112345678')).toBe(true);
  });
});
