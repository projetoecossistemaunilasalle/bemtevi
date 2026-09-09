import { describe, expect, it } from 'vitest';
import { parseInstagramUrl } from '../instagram';

describe('parseInstagramUrl', () => {
  it('identifies standard post URLs (/p/)', () => {
    expect(parseInstagramUrl('https://www.instagram.com/p/DFxyz123/')).toEqual({
      type: 'post',
      id: 'DFxyz123',
      permalink: 'https://www.instagram.com/p/DFxyz123/',
    });
  });

  it('identifies post URLs without trailing slash', () => {
    expect(parseInstagramUrl('https://www.instagram.com/p/DFxyz123')).toEqual({
      type: 'post',
      id: 'DFxyz123',
      permalink: 'https://www.instagram.com/p/DFxyz123/',
    });
  });

  it('identifies post URLs with query parameters', () => {
    expect(
      parseInstagramUrl('https://www.instagram.com/p/DFxyz123/?utm_source=ig_web_copy_link&igsh=MzRlODBiNWFlZA=='),
    ).toEqual({
      type: 'post',
      id: 'DFxyz123',
      permalink: 'https://www.instagram.com/p/DFxyz123/',
    });
  });

  it('identifies reel URLs (/reel/)', () => {
    expect(parseInstagramUrl('https://www.instagram.com/reel/C-xyz789/')).toEqual({
      type: 'reel',
      id: 'C-xyz789',
      permalink: 'https://www.instagram.com/reel/C-xyz789/',
    });
  });

  it('identifies reel URLs without trailing slash', () => {
    expect(parseInstagramUrl('https://www.instagram.com/reel/C-xyz789')).toEqual({
      type: 'reel',
      id: 'C-xyz789',
      permalink: 'https://www.instagram.com/reel/C-xyz789/',
    });
  });

  it('identifies /reels/ plural variation and normalizes to /reel/ permalink', () => {
    expect(parseInstagramUrl('https://www.instagram.com/reels/C-xyz789/')).toEqual({
      type: 'reel',
      id: 'C-xyz789',
      permalink: 'https://www.instagram.com/reel/C-xyz789/',
    });
  });

  it('supports domains without www and mobile subdomain', () => {
    expect(parseInstagramUrl('https://instagram.com/p/DFxyz123/')).toEqual({
      type: 'post',
      id: 'DFxyz123',
      permalink: 'https://www.instagram.com/p/DFxyz123/',
    });
    expect(parseInstagramUrl('https://m.instagram.com/reel/C-xyz789/')).toEqual({
      type: 'reel',
      id: 'C-xyz789',
      permalink: 'https://www.instagram.com/reel/C-xyz789/',
    });
  });

  it('returns null for non-Instagram URLs', () => {
    expect(parseInstagramUrl('https://www.youtube.com/watch?v=abcdef12345')).toBeNull();
    expect(parseInstagramUrl('https://example.com/p/DFxyz123/')).toBeNull();
  });

  it('returns null for profile URLs or other paths', () => {
    expect(parseInstagramUrl('https://www.instagram.com/usuario_unilasalle/')).toBeNull();
    expect(parseInstagramUrl('https://www.instagram.com/stories/usuario/123456789/')).toBeNull();
    expect(parseInstagramUrl('https://www.instagram.com/explore/tags/bemtevi/')).toBeNull();
  });

  it('returns null for invalid or malformed values', () => {
    expect(parseInstagramUrl('')).toBeNull();
    expect(parseInstagramUrl('not-a-url')).toBeNull();
    expect(parseInstagramUrl('https://www.instagram.com/p/')).toBeNull();
    expect(parseInstagramUrl('https://www.instagram.com/p/!!invalid!!/')).toBeNull();
  });
});
