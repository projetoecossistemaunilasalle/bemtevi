import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InstagramEmbed } from '../InstagramEmbed';
import { loadInstagramEmbedScript, resetInstagramScriptPromiseForTests } from '../instagramScriptLoader';

describe('InstagramEmbed', () => {
  beforeEach(() => {
    resetInstagramScriptPromiseForTests();
    document.querySelectorAll('script[src*="instagram.com"]').forEach((s) => s.remove());
    delete window.instgrm;
  });

  afterEach(() => {
    resetInstagramScriptPromiseForTests();
    document.querySelectorAll('script[src*="instagram.com"]').forEach((s) => s.remove());
    delete window.instgrm;
  });

  it('renders blockquote with instagram-media class and data-instgrm-permalink', () => {
    const url = 'https://www.instagram.com/p/DFxyz123/';
    render(<InstagramEmbed url={url} title="Post de Teste" />);

    const blockquote = document.querySelector('blockquote.instagram-media');
    expect(blockquote).toBeInTheDocument();
    expect(blockquote).toHaveAttribute('data-instgrm-permalink', url);
    expect(blockquote).toHaveAttribute('data-instgrm-version', '14');

    const link = screen.getByRole('link', { name: /abrir no instagram/i });
    expect(link).toHaveAttribute('href', url);
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('renders reels correctly', () => {
    const url = 'https://www.instagram.com/reel/C-xyz789/';
    render(<InstagramEmbed url={url} title="Reel de Teste" />);

    const blockquote = document.querySelector('blockquote.instagram-media');
    expect(blockquote).toBeInTheDocument();
    expect(blockquote).toHaveAttribute('data-instgrm-permalink', url);

    const link = screen.getByRole('link', { name: /abrir no instagram/i });
    expect(link).toHaveAttribute('href', url);
  });

  it('loads the embed.js script at most once across multiple calls and renders', async () => {
    const url1 = 'https://www.instagram.com/p/post1/';
    const url2 = 'https://www.instagram.com/p/post2/';

    render(
      <div>
        <InstagramEmbed url={url1} />
        <InstagramEmbed url={url2} />
      </div>,
    );

    const scripts = document.querySelectorAll('script[src="https://www.instagram.com/embed.js"]');
    expect(scripts).toHaveLength(1);

    // Call loader again directly, should still be 1
    await act(async () => {
      loadInstagramEmbedScript();
    });
    const scriptsAfter = document.querySelectorAll('script[src="https://www.instagram.com/embed.js"]');
    expect(scriptsAfter).toHaveLength(1);
  });

  it('calls window.instgrm.Embeds.process when script loads', async () => {
    const mockProcess = vi.fn();
    window.instgrm = {
      Embeds: {
        process: mockProcess,
      },
    };

    render(<InstagramEmbed url="https://www.instagram.com/p/DFxyz123/" />);

    // Allow promise microtask to resolve
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockProcess).toHaveBeenCalled();
  });

  it('displays a fallback card with "Abrir no Instagram" button when script fails to load', async () => {
    const url = 'https://www.instagram.com/p/DFxyz123/';
    render(<InstagramEmbed url={url} title="Post Que Falha" />);

    const script = document.querySelector<HTMLScriptElement>('script[src="https://www.instagram.com/embed.js"]');
    expect(script).toBeInTheDocument();

    // Trigger script error
    await act(async () => {
      script?.dispatchEvent(new Event('error'));
    });

    expect(screen.getByText(/Não foi possível carregar a publicação incorporada/i)).toBeInTheDocument();
    const fallbackLink = screen.getByRole('link', { name: /abrir no instagram/i });
    expect(fallbackLink).toHaveAttribute('href', url);
    expect(fallbackLink).toHaveAttribute('target', '_blank');
  });
});
