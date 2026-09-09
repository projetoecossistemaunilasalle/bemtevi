import { parseInstagramUrl } from '../../domain/media/instagram';
import { getYouTubeEmbedUrl } from '../../domain/media/youtube';

export type ResolvedVideoEmbed =
  | { kind: 'youtube'; embedUrl: string }
  | { kind: 'instagram'; url: string; permalink: string }
  | { kind: 'link'; url: string };

export function resolveVideoEmbed(url: string): ResolvedVideoEmbed {
  const embedUrl = getYouTubeEmbedUrl(url);

  if (embedUrl) {
    return { kind: 'youtube', embedUrl };
  }

  const instagram = parseInstagramUrl(url);
  if (instagram) {
    return { kind: 'instagram', url: instagram.permalink, permalink: instagram.permalink };
  }

  return { kind: 'link', url };
}
