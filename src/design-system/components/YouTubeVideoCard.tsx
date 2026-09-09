import { Instagram, Youtube } from 'lucide-react';
import { getYouTubeEmbedUrl } from '../../domain/media/youtube';
import { resolveVideoEmbed } from '../../features/education/videoEmbeds';
import { InstagramEmbed } from './InstagramEmbed';

export function YouTubeVideoCard({ title, url, className = '' }: { title: string; url: string; className?: string }) {
  const resolved = resolveVideoEmbed(url);

  if (resolved.kind === 'youtube') {
    const embedUrl = getYouTubeEmbedUrl(url, true);
    if (!embedUrl) return null;

    const accessibleTitle = title.trim() || 'Vídeo do YouTube';

    return (
      <figure
        className={`overflow-hidden rounded-xl border border-outline-variant/50 bg-surface-container-lowest shadow-sm ${className}`}
      >
        <figcaption className="flex items-center gap-2 px-3 py-2.5 font-label-md text-on-surface">
          <Youtube className="h-5 w-5 shrink-0 text-[#c5221f]" aria-hidden="true" />
          <span>{accessibleTitle}</span>
        </figcaption>
        <div className="aspect-video w-full overflow-hidden bg-black">
          <iframe
            className="h-full w-full border-0"
            src={embedUrl}
            title={accessibleTitle}
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      </figure>
    );
  }

  if (resolved.kind === 'instagram') {
    const accessibleTitle = title.trim() || 'Publicação do Instagram';

    return (
      <figure
        className={`overflow-hidden rounded-xl border border-outline-variant/50 bg-surface-container-lowest shadow-sm ${className}`}
      >
        <figcaption className="flex items-center gap-2 px-3 py-2.5 font-label-md text-on-surface">
          <Instagram className="h-5 w-5 shrink-0 text-[#E4405F]" aria-hidden="true" />
          <span>{accessibleTitle}</span>
        </figcaption>
        <div className="flex w-full justify-center p-3">
          <InstagramEmbed url={resolved.url} title={accessibleTitle} />
        </div>
      </figure>
    );
  }

  return null;
}
