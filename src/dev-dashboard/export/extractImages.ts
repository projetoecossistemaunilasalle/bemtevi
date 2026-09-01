import type { DashboardDraftContent } from './exportBundle';
import type { GuidedFlow } from '../../domain/flow-engine/types';
import type { EducationResource, EducationResourceBlock } from '../../domain/resources/types';
import { parseImageDataUrl } from '../components/fileUpload';

export interface ExtractedImage {
  name: string;
  data: Uint8Array;
  mimeType: string;
}

export interface ExtractImagesResult {
  json: DashboardDraftContent;
  images: ExtractedImage[];
}

const mimeToExt: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
  'image/avif': 'avif',
};

function extFromMime(mime: string): string {
  return mimeToExt[mime] || 'bin';
}

function isDataUrl(value: string | undefined): value is string {
  return typeof value === 'string' && value.trimStart().startsWith('data:');
}

function safePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_') || 'item';
}

function imageFileName(
  resourceId: string,
  purpose: string,
  blockId: string | null,
  fileName: string | undefined,
  mimeType: string,
): string {
  const ext = extFromMime(mimeType);
  const safeFileName = fileName ? fileName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '_') : '';
  const base = blockId
    ? `${resourceId}-block-${blockId}${safeFileName ? `-${safeFileName}` : ''}`
    : `${resourceId}-${purpose}${safeFileName ? `-${safeFileName}` : ''}`;
  return `images/${base}.${ext}`;
}

function flowVisualFileName(flowId: string, nodeId: string, visualId: string, mimeType: string): string {
  return `images/flow-${safePathSegment(flowId)}-node-${safePathSegment(nodeId)}-visual-${safePathSegment(visualId)}.${extFromMime(mimeType)}`;
}

function replaceDataUrlsInFlow(flow: GuidedFlow, images: ExtractedImage[]): GuidedFlow {
  let nextNodes: GuidedFlow['nodes'] | undefined;

  Object.entries(flow.nodes).forEach(([nodeKey, node]) => {
    if (!node.visuals?.length) return;

    const visuals = node.visuals.map((visual) => {
      if (!isDataUrl(visual.src)) return visual;

      const parsed = parseImageDataUrl(visual.src);
      if (!parsed) return visual;

      const name = flowVisualFileName(flow.id, node.id, visual.id, parsed.mimeType);
      images.push({ name, data: parsed.data, mimeType: parsed.mimeType });
      return { ...visual, src: `./${name}` };
    });

    if (visuals.some((visual, index) => visual !== node.visuals?.[index])) {
      nextNodes ??= { ...flow.nodes };
      nextNodes[nodeKey] = { ...node, visuals };
    }
  });

  return nextNodes ? { ...flow, nodes: nextNodes } : flow;
}

function replaceDataUrlInBlock(
  block: EducationResourceBlock,
  resourceId: string,
  images: ExtractedImage[],
): EducationResourceBlock {
  if (block.kind !== 'image' || !isDataUrl(block.imageUrl)) return block;

  const parsed = parseImageDataUrl(block.imageUrl);
  if (!parsed) return block;

  const name = imageFileName(resourceId, 'block', block.id, block.imageFileName, parsed.mimeType);
  images.push({ name, data: parsed.data, mimeType: parsed.mimeType });

  return {
    ...block,
    imageUrl: `./${name}`,
  };
}

function replaceDataUrlsInResource(resource: EducationResource, images: ExtractedImage[]): EducationResource {
  let next = resource;

  // Library thumbnail imageUrl
  if (isDataUrl(resource.imageUrl)) {
    const parsed = parseImageDataUrl(resource.imageUrl);
    if (parsed) {
      const name = imageFileName(resource.id, 'thumbnail', null, resource.imageFileName, parsed.mimeType);
      images.push({ name, data: parsed.data, mimeType: parsed.mimeType });
      next = { ...next, imageUrl: `./${name}` };
    }
  }

  // Featured image (uploaded kind)
  if (next.featuredImage?.kind === 'uploaded' && isDataUrl(next.featuredImage.dataUrl)) {
    const parsed = parseImageDataUrl(next.featuredImage.dataUrl);
    if (parsed) {
      const name = imageFileName(resource.id, 'featured', null, next.featuredImage.fileName, parsed.mimeType);
      images.push({ name, data: parsed.data, mimeType: parsed.mimeType });
      next = {
        ...next,
        featuredImage: { ...next.featuredImage, dataUrl: `./${name}` },
      };
    }
  }

  // Body blocks
  if (next.body) {
    const newBody = next.body.map((block) => replaceDataUrlInBlock(block, resource.id, images));
    if (newBody !== next.body) {
      next = { ...next, body: newBody };
    }
  }

  return next;
}

export function extractImagesFromDrafts(drafts: DashboardDraftContent): ExtractImagesResult {
  const images: ExtractedImage[] = [];

  const json: DashboardDraftContent = {
    ...drafts,
    flows: drafts.flows.map((flow) => replaceDataUrlsInFlow(flow, images)),
    educationMaterials: drafts.educationMaterials.map((resource) => replaceDataUrlsInResource(resource, images)),
  };

  return { json, images };
}
