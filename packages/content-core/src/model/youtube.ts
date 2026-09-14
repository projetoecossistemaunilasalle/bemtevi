export function parseYouTubeVideoId(value: string): string | null {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, '').toLocaleLowerCase('en-US');

    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      if (url.pathname === '/watch') return normalizeYouTubeId(url.searchParams.get('v'));

      const [route, videoId] = url.pathname.split('/').filter(Boolean);
      if (route === 'embed' || route === 'shorts' || route === 'live') {
        return normalizeYouTubeId(videoId);
      }
    }

    if (host === 'youtu.be') {
      return normalizeYouTubeId(url.pathname.split('/').filter(Boolean)[0]);
    }
  } catch {
    return null;
  }

  return null;
}

export function getYouTubeEmbedUrl(value: string, privacyEnhanced = false): string | null {
  const videoId = parseYouTubeVideoId(value);
  if (!videoId) return null;

  const host = privacyEnhanced ? 'www.youtube-nocookie.com' : 'www.youtube.com';
  return `https://${host}/embed/${videoId}`;
}

function normalizeYouTubeId(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  return /^[A-Za-z0-9_-]{6,}$/.test(trimmed) ? trimmed : null;
}
