import { useEffect, useState } from 'react';
import { ExternalLink, Instagram } from 'lucide-react';
import { loadInstagramEmbedScript } from './instagramScriptLoader';

export interface InstagramEmbedProps {
  url: string;
  title?: string;
  className?: string;
}

export function InstagramEmbed({ url, title, className = '' }: InstagramEmbedProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const loadError = failedUrl === url;

  useEffect(() => {
    let isCancelled = false;

    loadInstagramEmbedScript()
      .then(() => {
        if (isCancelled) return;
        window.instgrm?.Embeds?.process();
      })
      .catch(() => {
        if (isCancelled) return;
        setFailedUrl(url);
      });

    return () => {
      isCancelled = true;
    };
  }, [url]);

  if (loadError) {
    return (
      <div
        className={`mx-auto flex w-full max-w-[540px] min-w-0 flex-col items-center rounded-2xl border border-outline-variant/40 bg-surface-container-low p-6 text-center shadow-sm ${className}`}
      >
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#E4405F]/10 text-[#E4405F]">
          <Instagram className="h-6 w-6" aria-hidden="true" />
        </div>
        <p className="font-title-md text-on-surface">{title || 'Publicação do Instagram'}</p>
        <p className="mt-1 mb-5 font-body-sm text-on-surface-variant">
          Não foi possível carregar a publicação incorporada. Ela pode estar privada, ter sido removida ou o
          carregamento foi impedido.
        </p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#E4405F] px-5 py-2.5 font-label-lg text-white transition-opacity hover:opacity-90 active:opacity-95"
        >
          <Instagram className="h-4 w-4" aria-hidden="true" />
          <span>Abrir no Instagram</span>
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
        </a>
      </div>
    );
  }

  return (
    <div className={`mx-auto flex w-full max-w-[540px] min-w-0 flex-col items-center overflow-hidden ${className}`}>
      <blockquote
        className="instagram-media"
        data-instgrm-permalink={url}
        data-instgrm-version="14"
        style={{
          background: '#FFFFFF',
          border: '0',
          borderRadius: '12px',
          boxShadow: '0 0 1px 0 rgba(0,0,0,0.5), 0 1px 10px 0 rgba(0,0,0,0.15)',
          margin: '1px auto',
          maxWidth: '540px',
          minWidth: '280px',
          padding: '0',
          width: 'calc(100% - 2px)',
        }}
      >
        <div className="flex flex-col items-center justify-center p-6 text-center">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#E4405F]/10 text-[#E4405F]">
            <Instagram className="h-5 w-5" aria-hidden="true" />
          </div>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-label-lg text-primary hover:underline"
          >
            <span>Abrir no Instagram</span>
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      </blockquote>
    </div>
  );
}
