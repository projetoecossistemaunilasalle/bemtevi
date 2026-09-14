import type { ImageSlot, ImageValue } from '../contracts/operations';
import { isFeaturedImageId } from '../model/featuredImageIds';
import {
  MAX_EXTERNAL_IMAGE_URL_LENGTH,
  MAX_IMAGE_ALT_LENGTH,
  MAX_IMAGE_FILE_NAME_LENGTH,
  MAX_UPLOADED_IMAGE_DECODED_BYTES,
  UPLOADED_IMAGE_MIMES,
} from './allowlists';
import { decodeStrictBase64 } from '../images/base64';
import { isRecordInput, isValidId } from './jsonChecks';

/** Parsing helpers for `ImageSlot` and `ImageValue` (dossier 14 image contract). */

export function parseImageSlot(value: unknown): ImageSlot | null {
  if (!isRecordInput(value)) return null;
  if (value.kind === 'featured' && extraKeys(value, ['kind']).length === 0) return { kind: 'featured' };
  if (value.kind === 'legacy' && extraKeys(value, ['kind']).length === 0) return { kind: 'legacy' };
  if (value.kind === 'body' && extraKeys(value, ['kind', 'blockId']).length === 0 && isValidId(value.blockId)) {
    return { kind: 'body', blockId: value.blockId };
  }
  return null;
}

function extraKeys(value: Record<string, unknown>, allowed: readonly string[]): string[] {
  return Object.keys(value).filter((key) => !allowed.includes(key));
}

const SEPARATOR_CHARS = /[\\/:*?"<>|]/;

function hasSeparatorOrControlChar(fileName: string): boolean {
  if (SEPARATOR_CHARS.test(fileName)) return true;
  return [...fileName].some((char) => (char.codePointAt(0) ?? 0) <= 0x1f);
}

function parseExternalUrl(url: unknown): string | null {
  if (typeof url !== 'string' || url.length === 0 || url.length > MAX_EXTERNAL_IMAGE_URL_LENGTH) return null;
  if (!url.startsWith('https://')) return null;
  const authority = url.slice(8).split(/[/?#]/)[0] ?? '';
  if (authority.length === 0 || authority.includes('@') || authority.includes(':')) return null;
  return url;
}

export function parseImageValue(value: unknown): { ok: true; value: ImageValue } | { ok: false; message: string } {
  if (!isRecordInput(value)) return { ok: false, message: 'valor de imagem deve ser um objeto.' };
  if (value.kind === 'remove') {
    return extraKeys(value, ['kind']).length === 0
      ? { ok: true, value: { kind: 'remove' } }
      : { ok: false, message: '"remove" não aceita campos extras.' };
  }
  if (value.kind === 'catalog') {
    if (extraKeys(value, ['kind', 'imageId']).length > 0) {
      return { ok: false, message: 'imagem de catálogo aceita apenas "imageId".' };
    }
    if (typeof value.imageId !== 'string' || !isFeaturedImageId(value.imageId)) {
      return { ok: false, message: 'imageId de catálogo desconhecido.' };
    }
    return { ok: true, value: { kind: 'catalog', imageId: value.imageId } };
  }
  if (value.kind === 'external') {
    if (extraKeys(value, ['kind', 'url', 'alt']).length > 0) {
      return { ok: false, message: 'imagem externa aceita apenas "url" e "alt".' };
    }
    const url = parseExternalUrl(value.url);
    if (url === null) {
      return { ok: false, message: 'URL externa deve ser HTTPS, sem credenciais, com até 2048 caracteres.' };
    }
    if (typeof value.alt !== 'string' || value.alt.length > MAX_IMAGE_ALT_LENGTH) {
      return { ok: false, message: '"alt" externo deve ser texto com até 500 caracteres.' };
    }
    return { ok: true, value: { kind: 'external', url, alt: value.alt } };
  }
  if (value.kind === 'uploaded') {
    return parseUploadedImage(value);
  }
  return { ok: false, message: `"kind" de imagem inválido: ${String(value.kind)}.` };
}

function parseUploadedImage(
  value: Record<string, unknown>,
): { ok: true; value: ImageValue } | { ok: false; message: string } {
  if (extraKeys(value, ['kind', 'mime', 'base64', 'fileName', 'alt']).length > 0) {
    return { ok: false, message: 'imagem enviada aceita apenas "mime", "base64", "fileName" e "alt".' };
  }
  if (!(UPLOADED_IMAGE_MIMES as readonly string[]).includes(value.mime as string)) {
    return { ok: false, message: 'formato enviado deve ser PNG, JPEG ou WebP.' };
  }
  if (typeof value.base64 !== 'string' || typeof value.fileName !== 'string' || typeof value.alt !== 'string') {
    return { ok: false, message: 'imagem enviada precisa de "base64", "fileName" e "alt" em texto.' };
  }
  const decoded = decodeStrictBase64(value.base64);
  if (decoded === null) return { ok: false, message: '"base64" não é base64 canônico com padding.' };
  if (decoded.byteLength > MAX_UPLOADED_IMAGE_DECODED_BYTES) {
    return { ok: false, message: 'imagem enviada excede 1 MiB decodificado.' };
  }
  if (value.fileName.length < 1 || value.fileName.length > MAX_IMAGE_FILE_NAME_LENGTH) {
    return { ok: false, message: '"fileName" deve ter de 1 a 120 caracteres.' };
  }
  if (hasSeparatorOrControlChar(value.fileName)) {
    return { ok: false, message: '"fileName" não pode conter separadores ou caracteres de controle.' };
  }
  if (value.alt.length > MAX_IMAGE_ALT_LENGTH) {
    return { ok: false, message: '"alt" deve ter até 500 caracteres.' };
  }
  return {
    ok: true,
    value: {
      kind: 'uploaded',
      mime: value.mime as 'image/png' | 'image/jpeg' | 'image/webp',
      base64: value.base64,
      fileName: value.fileName,
      alt: value.alt,
    },
  };
}
