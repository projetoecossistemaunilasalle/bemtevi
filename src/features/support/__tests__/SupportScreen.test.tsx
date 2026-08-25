import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SupportScreen } from '../SupportScreen';

describe('SupportScreen', () => {
  it('renders immediate support contacts with phone links', () => {
    render(<SupportScreen />);

    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();

    const phoneLinks = screen.getAllByRole('link', { name: /ligar agora/i });
    expect(phoneLinks.length).toBeGreaterThan(0);
    phoneLinks.forEach((link) => {
      expect(link).toHaveAttribute('href', expect.stringContaining('tel:'));
    });
  });

  it('renders the breathing exercise control', () => {
    render(<SupportScreen />);

    expect(screen.getByRole('button', { name: /começar a respirar/i })).toBeInTheDocument();
  });
});
