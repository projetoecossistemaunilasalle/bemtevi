import type { EducationResourceFeaturedImage } from '../model/resources';
import type { ImageSlot, ImageValue } from '../contracts/operations';
import { decodeStrictBase64, parseImageDataUrl } from '../images/base64';
import { inspectImage } from '../images/inspectImage';
import { isRecordInput } from './jsonChecks';

/**
 * Specialized image contract (dossier 14, "Image Mapping"). Only
 * `set_material_image` reaches these functions; generic operations never
 * mutate a retained image slot.
 */

export type MaterialRecord = Record<string, unknown>;

export function validateUploadedImage(image: Extract<ImageValue, { kind: 'uploaded' }>): string | null {
  const bytes = decodeStrictBase64(image.base64);
  if (bytes === null) return 'base64 enviado não é canônico.';
  const inspected = inspectImage(bytes, image.mime);
  if (inspected.ok === false) return `imagem enviada rejeitada: ${inspected.message}`;
  return null;
}

function dataUrlFor(image: Extract<ImageValue, { kind: 'uploaded' }>): string {
  return `data:${image.mime};base64,${image.base64}`;
}

function checkLegacyAlt(image: ImageValue): string | null {
  if ((image.kind === 'uploaded' || image.kind === 'external') && image.alt !== '') {
    return 'o slot legado não tem campo "alt": use alt: "" e informe texto acessível via destaque ou corpo.';
  }
  return null;
}

/** Applies a `set_material_image` image value to one slot of a material record. Returns an error message or null. */
export function applyMaterialImage(material: MaterialRecord, slot: ImageSlot, image: ImageValue): string | null {
  if (slot.kind === 'featured') {
    if (image.kind === 'remove') {
      delete material.featuredImage;
      return null;
    }
    if (image.kind === 'uploaded') {
      const issue = validateUploadedImage(image);
      if (issue !== null) return issue;
      const featured: EducationResourceFeaturedImage = {
        kind: 'uploaded',
        dataUrl: dataUrlFor(image),
        alt: image.alt,
        fileName: image.fileName,
      };
      material.featuredImage = featured;
      return null;
    }
    if (image.kind === 'catalog') {
      material.featuredImage = { kind: 'catalog', imageId: image.imageId };
      return null;
    }
    material.featuredImage = { kind: 'external', imageUrl: image.url, alt: image.alt };
    return null;
  }

  if (slot.kind === 'legacy') {
    const altIssue = checkLegacyAlt(image);
    if (altIssue !== null) return altIssue;
    if (image.kind === 'remove') {
      delete material.imageUrl;
      delete material.imageFileName;
      return null;
    }
    if (image.kind === 'uploaded') {
      const issue = validateUploadedImage(image);
      if (issue !== null) return issue;
      material.imageUrl = dataUrlFor(image);
      material.imageFileName = image.fileName;
      return null;
    }
    if (image.kind === 'catalog') return 'imagem de catálogo é exclusiva do slot de destaque.';
    material.imageUrl = image.url;
    delete material.imageFileName;
    return null;
  }

  const body = material.body;
  if (!Array.isArray(body)) return 'o material não tem um corpo (body) onde o bloco exista.';
  const block = body.find((item) => isRecordInput(item) && item.id === slot.blockId);
  if (!isRecordInput(block)) return `bloco de corpo "${slot.blockId}" não existe.`;
  if (block.kind !== 'image') return `bloco de corpo "${slot.blockId}" precisa ter kind "image".`;
  if (image.kind === 'remove') {
    delete block.imageUrl;
    delete block.imageFileName;
    delete block.alt;
    return null;
  }
  if (image.kind === 'catalog') return 'imagem de catálogo é exclusiva do slot de destaque.';
  if (image.kind === 'uploaded') {
    const issue = validateUploadedImage(image);
    if (issue !== null) return issue;
    block.imageUrl = dataUrlFor(image);
    block.imageFileName = image.fileName;
    block.alt = image.alt;
    return null;
  }
  block.imageUrl = image.url;
  block.alt = image.alt;
  delete block.imageFileName;
  return null;
}

/** Parses an `uploaded` image back out of a payload data URL (used by encoding). */
export function uploadedFromDataUrl(
  dataUrl: string,
  fileName: string,
  alt: string,
): Extract<ImageValue, { kind: 'uploaded' }> | null {
  const parsed = parseImageDataUrl(dataUrl);
  if (parsed === null) return null;
  if (parsed.mime !== 'image/png' && parsed.mime !== 'image/jpeg' && parsed.mime !== 'image/webp') return null;
  return { kind: 'uploaded', mime: parsed.mime, base64: parsed.base64, fileName, alt };
}
