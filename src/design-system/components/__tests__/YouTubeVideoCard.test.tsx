import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { YouTubeVideoCard } from '../YouTubeVideoCard';

describe('YouTubeVideoCard', () => {
  it('renders a YouTube iframe for YouTube URLs', () => {
    render(<YouTubeVideoCard title="Exercício de Respiração" url="https://www.youtube.com/watch?v=abcdef12345" />);

    const iframe = screen.getByTitle('Exercício de Respiração');
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/abcdef12345');
    expect(screen.getByText('Exercício de Respiração')).toBeInTheDocument();
  });

  it('renders an Instagram embed for Instagram post URLs', () => {
    render(<YouTubeVideoCard title="Dica de Acolhimento" url="https://www.instagram.com/p/DFxyz123/" />);

    const blockquote = document.querySelector('blockquote.instagram-media');
    expect(blockquote).toBeInTheDocument();
    expect(blockquote).toHaveAttribute('data-instgrm-permalink', 'https://www.instagram.com/p/DFxyz123/');
    expect(screen.getByText('Dica de Acolhimento')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /abrir no instagram/i })).toHaveAttribute(
      'href',
      'https://www.instagram.com/p/DFxyz123/',
    );
  });

  it('renders an Instagram embed for Instagram Reel URLs', () => {
    render(<YouTubeVideoCard title="Reel Prático" url="https://www.instagram.com/reel/C-xyz789/" />);

    const blockquote = document.querySelector('blockquote.instagram-media');
    expect(blockquote).toBeInTheDocument();
    expect(blockquote).toHaveAttribute('data-instgrm-permalink', 'https://www.instagram.com/reel/C-xyz789/');
  });

  it('returns null for unknown URLs', () => {
    const { container } = render(<YouTubeVideoCard title="Link Desconhecido" url="https://example.com/video" />);

    expect(container.firstChild).toBeNull();
  });
});
