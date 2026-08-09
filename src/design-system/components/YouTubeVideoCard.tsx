import { Youtube } from 'lucide-react';
import { getYouTubeEmbedUrl } from '../../domain/media/youtube';

export function YouTubeVideoCard({ title, url, className = '' }: { title: string; url: string; className?: string }) {
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
