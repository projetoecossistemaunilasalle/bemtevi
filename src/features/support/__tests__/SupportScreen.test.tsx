import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SupportScreen } from '../SupportScreen';

describe('SupportScreen', () => {
  it('renders immediate support contacts with phone links', () => {
    render(<SupportScreen />);

    expect(screen.getByRole('heading', { name: /você não está sozinho/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /cvv/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /samu/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /disque saúde/i })).toBeInTheDocument();

    const phoneLinks = screen.getAllByRole('link', { name: /ligar agora/i });
    expect(phoneLinks).toHaveLength(3);
    phoneLinks.forEach((link) => {
      expect(link).toHaveAttribute('href', expect.stringContaining('tel:'));
    });
    expect(phoneLinks[0]).toHaveAttribute('href', 'tel:188');
    expect(phoneLinks[2]).toHaveAttribute('href', 'tel:136');
  });

  it('renders the breathing exercise control', () => {
    render(<SupportScreen />);

    expect(screen.getByRole('button', { name: /começar a respirar/i })).toBeInTheDocument();
  });
});
