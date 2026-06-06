import { ArrowLeft, ExternalLink, Play } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { routes } from '../../app/routes';
import { findFeaturedImageOption } from '../../content/resources/featuredImages';
import { Badge } from '../../design-system/components/Badge';
import { Card } from '../../design-system/components/Card';
import { Page } from '../../design-system/components/Page';
import type { EducationResource, EducationResourceBlock } from '../../domain/resources/types';
import { resolveEducationResourcesForPreview } from './educationResourcePreview';
import { resolveVideoEmbed } from './videoEmbeds';

export function ResourceDetailScreen() {
  const { resourceId } = useParams();
  const { resources, isPreviewingDrafts } = resolveEducationResourcesForPreview();
  const resource = resources.find((item) => item.id === resourceId) ?? resources[0];
  const featuredImage = resolveFeaturedImage(resource);

  return (
    <Page width="narrow" className="gap-stack-md">
      {isPreviewingDrafts ? (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 font-body-md text-yellow-900">
          Essa é uma versão de teste. O conteúdo não está salvo no site oficial.
        </div>
      ) : null}

      <Link to={routes.education} className="inline-flex items-center gap-2 font-label-md text-primary">
        <ArrowLeft size={18} />
        Estudos
      </Link>

      <header className="flex flex-col gap-stack-sm">
        <div className="flex flex-wrap gap-2">
          <Badge tone="secondary">{resource.source}</Badge>
          <Badge>Material educativo</Badge>
        </div>
        <h1 className="font-headline-lg text-on-surface">{resource.title}</h1>
        <p className="font-body-lg text-on-surface-variant">{resource.description}</p>
      </header>

      {featuredImage ? (
        <div className="h-56 w-full overflow-hidden rounded-2xl border border-outline-variant/20 bg-surface-container-low">
          <img alt={featuredImage.alt} className="h-full w-full object-cover" src={featuredImage.src} />
        </div>
      ) : null}

      <section className="flex flex-col gap-stack-md">
        {resource.body?.map((block) => (
          <ResourceBodyBlock key={block.id} block={block} source={resource.source} />
        ))}
      </section>
    </Page>
  );
}

function resolveFeaturedImage(resource: EducationResource) {
  if (!resource.featuredImage) return null;

  if (resource.featuredImage.kind === 'external') {
    return {
      src: resource.featuredImage.imageUrl,
      alt: resource.featuredImage.alt ?? '',
    };
  }

  const option = findFeaturedImageOption(resource.featuredImage.imageId);
  return option ? { src: option.src, alt: option.alt } : null;
}

function ResourceBodyBlock({ block, source }: { block: EducationResourceBlock; source: string }) {
  if (block.kind === 'heading') {
    return <h2 className="font-headline-md text-on-surface">{block.text}</h2>;
  }

  if (block.kind === 'paragraph') {
    return (
      <Card className="p-6">
        {block.title ? <h2 className="mb-2 font-headline-sm text-on-surface">{block.title}</h2> : null}
        <p className="font-body-lg text-on-surface-variant">{block.text}</p>
      </Card>
    );
  }

  if (block.kind === 'list') {
    return (
      <Card className="p-6">
        {block.title ? <h2 className="mb-2 font-headline-sm text-on-surface">{block.title}</h2> : null}
        <ul className="list-disc space-y-2 pl-5 font-body-lg text-on-surface-variant">
          {block.items
            ?.filter((item) => item.trim())
            .map((item, index) => (
              <li key={`${block.id}-${index}`}>{item}</li>
            ))}
        </ul>
      </Card>
    );
  }

  if (block.kind === 'image' && block.imageUrl) {
    return (
      <div className="overflow-hidden rounded-2xl border border-outline-variant/20 bg-surface-container-low">
        <img alt={block.alt ?? ''} className="h-auto w-full object-cover" src={block.imageUrl} />
      </div>
    );
  }

  if (block.kind === 'video' && block.url) {
    const video = resolveVideoEmbed(block.url);

    if (video.kind === 'youtube') {
      return (
        <Card className="overflow-hidden p-0">
          <iframe
            className="aspect-video w-full"
            src={video.embedUrl}
            title={block.title ?? 'Vídeo'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
          <div className="p-5">
            {block.title ? <h2 className="font-headline-sm text-on-surface">{block.title}</h2> : null}
            {block.description ? <p className="font-body-md text-on-surface-variant">{block.description}</p> : null}
          </div>
        </Card>
      );
    }

    return (
      <a
        className="flex items-center gap-4 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5 transition-colors hover:bg-surface-container"
        href={video.url}
        rel="noreferrer"
        target="_blank"
      >
        <div className="flex h-16 w-20 shrink-0 items-center justify-center rounded-xl bg-inverse-surface text-inverse-on-surface">
          <Play size={28} />
        </div>
        <div className="flex-1">
          {block.title ? <h2 className="font-headline-sm text-on-surface">{block.title}</h2> : null}
          <span className="mt-1 inline-flex items-center gap-1 font-label-md text-primary">
            Abrir vídeo externo
            <ExternalLink size={14} />
          </span>
        </div>
      </a>
    );
  }

  if (block.kind === 'sourceLink' && block.url) {
    return (
      <Card className="p-5">
        <p className="font-body-md text-on-surface-variant">Fonte do material</p>
        <p className="font-headline-sm text-on-surface">{source}</p>
        <a
          className="mt-2 inline-flex items-center gap-2 font-label-md text-primary"
          href={block.url}
          rel="noreferrer"
          target="_blank"
        >
          {block.label ?? 'Acessar fonte original'}
          <ExternalLink size={16} />
        </a>
      </Card>
    );
  }

  return null;
}
