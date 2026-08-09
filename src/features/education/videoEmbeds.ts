import { getYouTubeEmbedUrl } from '../../domain/media/youtube';

export type ResolvedVideoEmbed = { kind: 'youtube'; embedUrl: string } | { kind: 'link'; url: string };

export function resolveVideoEmbed(url: string): ResolvedVideoEmbed {
  const embedUrl = getYouTubeEmbedUrl(url);

  if (embedUrl) {
    return { kind: 'youtube', embedUrl };
  }

  return { kind: 'link', url };
}
