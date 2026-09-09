export interface ParsedInstagramMedia {
  type: 'post' | 'reel';
  id: string;
  permalink: string;
}

export function parseInstagramUrl(value: string): ParsedInstagramMedia | null {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, '').toLocaleLowerCase('en-US');

    if (host !== 'instagram.com' && host !== 'm.instagram.com') {
      return null;
    }

    const segments = url.pathname.split('/').filter(Boolean);
    if (segments.length < 2) {
      return null;
    }

    const [route, id] = segments;
    const normalizedId = normalizeInstagramId(id);
    if (!normalizedId) {
      return null;
    }

    if (route === 'p') {
      return {
        type: 'post',
        id: normalizedId,
        permalink: `https://www.instagram.com/p/${normalizedId}/`,
      };
    }

    if (route === 'reel' || route === 'reels') {
      return {
        type: 'reel',
        id: normalizedId,
        permalink: `https://www.instagram.com/reel/${normalizedId}/`,
      };
    }

    return null;
  } catch {
    return null;
  }
}

function normalizeInstagramId(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return /^[A-Za-z0-9_-]{3,}$/.test(trimmed) ? trimmed : null;
}
