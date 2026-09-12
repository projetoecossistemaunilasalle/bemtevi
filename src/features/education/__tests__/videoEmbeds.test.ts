import { describe, expect, it } from 'vitest';

describe('resolveVideoEmbed', () => {
  it('converts YouTube watch URLs to embed URLs', async () => {
    const { resolveVideoEmbed } = await import('../videoEmbeds');

    expect(resolveVideoEmbed('https://www.youtube.com/watch?v=abcdef12345')).toEqual({
      kind: 'youtube',
      embedUrl: 'https://www.youtube.com/embed/abcdef12345',
    });
  });

  it('recognizes Instagram /p/ URLs', async () => {
    const { resolveVideoEmbed } = await import('../videoEmbeds');

    expect(resolveVideoEmbed('https://www.instagram.com/p/DFxyz123/')).toEqual({
      kind: 'instagram',
      url: 'https://www.instagram.com/p/DFxyz123/',
      permalink: 'https://www.instagram.com/p/DFxyz123/',
    });
  });

  it('recognizes Instagram /reel/ URLs', async () => {
    const { resolveVideoEmbed } = await import('../videoEmbeds');

    expect(resolveVideoEmbed('https://www.instagram.com/reel/C-xyz789/')).toEqual({
      kind: 'instagram',
      url: 'https://www.instagram.com/reel/C-xyz789/',
      permalink: 'https://www.instagram.com/reel/C-xyz789/',
    });
  });

  it('falls back to a link for generic or unknown video URLs', async () => {
    const { resolveVideoEmbed } = await import('../videoEmbeds');

    expect(resolveVideoEmbed('https://example.com/video')).toEqual({
      kind: 'link',
      url: 'https://example.com/video',
    });
  });
});
