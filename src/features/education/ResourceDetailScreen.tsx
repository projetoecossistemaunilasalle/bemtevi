import { ArrowLeft, ExternalLink, Play } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { routes } from '../../app/routes';
import { usePublishedContent } from '../../app/content/PublishedContentContext';
import { findFeaturedImageOption } from '../../content/resources/featuredImages';
import { Badge } from '../../design-system/components/Badge';
import { Card } from '../../design-system/components/Card';
import { Page } from '../../design-system/components/Page';
import type { EducationResource, EducationResourceBlock } from '../../domain/resources/types';
import { resolveEducationResourcesForPreview } from './educationResourcePreview';
import { resolveVideoEmbed } from './videoEmbeds';
import { SourceCitationsView } from './SourceCitationsView';
import { isLegacySourceBlock, parseSourceCitations } from './sourceFormatter';

export function ResourceDetailScreen() {
  const { resourceId } = useParams();
  const { content } = usePublishedContent();
  const { resources, changedResourceIds } = resolveEducationResourcesForPreview(content);
  const resource = resources.find((item) => item.id === resourceId) ?? resources[0];
  const isPreviewingResource = changedResourceIds.includes(resource.id);
  const featuredImage = resolveFeaturedImage(resource);
  const resourceTags = resource.tags.map((tag) => tag.trim()).filter(Boolean);
  const legacySourceBlock = resource.body?.find((block) => isLegacySourceBlock(block) && block.text?.trim());
  const citationSource = legacySourceBlock?.text ?? resource.source;
  const parsedCitations = parseSourceCitations(citationSource);
  const isShortSource =
    parsedCitations.length === 1 && citationSource.trim().length <= 35 && !citationSource.includes(';');

  return (
    <Page width="narrow" className="gap-stack-md">
      {isPreviewingResource ? (
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
          {isShortSource ? <Badge tone="secondary">{resource.source}</Badge> : null}
          {resourceTags.map((tag, index) => (
            <Badge key={`${tag}-${index}`}>{tag}</Badge>
          ))}
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
        {resource.body
          ?.filter((block) => !isLegacySourceBlock(block))
          .map((block) => (
            <ResourceBodyBlock key={block.id} block={block} source={resource.source} />
          ))}
      </section>

      {!isShortSource && citationSource ? <SourceCitationsView sourceText={citationSource} /> : null}
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

  if (resource.featuredImage.kind === 'uploaded') {
    return {
      src: resource.featuredImage.dataUrl,
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
          {block.title || block.description ? (
            <div className="p-5">
              {block.title ? <h2 className="font-headline-sm text-on-surface">{block.title}</h2> : null}
              {block.description ? <p className="font-body-md text-on-surface-variant">{block.description}</p> : null}
            </div>
          ) : null}
          <iframe
            className="aspect-video w-full"
            src={video.embedUrl}
            title={block.title ?? 'Vídeo'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
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

  if (block.kind === 'sourceLink') {
    const textToRender = block.label || source;
    return (
      <Card className="p-5 flex flex-col gap-2">
        <p className="font-body-md text-on-surface-variant font-medium">Fonte do material</p>
        <SourceCitationsView sourceText={textToRender} variant="inline" />
        {block.url ? (
          <a
            className="mt-1 inline-flex items-center gap-2 font-label-md text-primary hover:underline"
            href={block.url}
            rel="noreferrer"
            target="_blank"
          >
            Acessar fonte original
            <ExternalLink size={16} />
          </a>
        ) : null}
      </Card>
    );
  }

  if (block.kind === 'link' && block.url) {
    const linkLabel = block.label?.trim() || block.title?.trim() || 'Acessar link';
    return (
      <a
        className="inline-flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-5 py-3.5 font-label-lg font-semibold text-primary transition-all hover:bg-primary/10 hover:border-primary/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary self-start"
        href={block.url}
        rel="noreferrer"
        target="_blank"
      >
        <span>{linkLabel}</span>
        <ExternalLink size={18} className="shrink-0" />
      </a>
    );
  }

  return null;
}
