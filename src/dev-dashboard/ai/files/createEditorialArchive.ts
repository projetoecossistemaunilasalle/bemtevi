import JSZip from 'jszip';
import { sha256Bytes, type EditExport } from '@bemtevi/content-core';
import { buildArchiveInstructions } from './archiveInstructions';
import type { ExportSelection } from './exportRepository';

/**
 * Editorial export archive builder (doc 14 file contract, task AI-FILE-01).
 *
 * Roots: `manifest.json`, `context.json`, `instructions.md`, optional
 * `images/`. Context is the whole payload for a `null` selection, otherwise
 * `{ scope, items }` of the selected records only. Embedded images found in
 * the context are replaced by `images/<sha256-of-bytes>.<ext>` and their
 * existing bytes are included; external/catalog assets are never downloaded.
 * The context is read-only reference material and is never re-imported.
 */

export interface EditorialArchiveFile {
  name: string;
  data: Uint8Array;
}

export interface EditorialArchiveBuild {
  zipData: Uint8Array;
  fileName: string;
  manifest: ArchiveManifest;
  context: Record<string, unknown>;
  imageCount: number;
  instructions: string;
}

export interface ArchiveManifest {
  schemaVersion: '2.0.0';
  exportId: string;
  baseGeneration: number;
  baseDigest: string;
  expiresAt: string;
  selection: ExportSelection | null;
}

const IMAGE_MIME_EXTENSIONS: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

const DATA_URL_RE = /^data:(image\/[a-z0-9.+-]+);base64,([a-zA-Z0-9+/=]+)$/;

function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export { decodeBase64, encodeBase64 };

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  return sha256Bytes(bytes);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function buildContext(exportRecord: EditExport): Record<string, unknown> {
  const selection = exportRecord.selection;
  if (selection === null) {
    return { ...exportRecord.basePayload } as Record<string, unknown>;
  }
  const collection = exportRecord.basePayload[selection.scope];
  const items: Array<Record<string, unknown>> = [];
  for (const id of selection.ids) {
    const item = collection.find((candidate) => candidate['id'] === id);
    if (item !== undefined && isRecord(item)) items.push(item);
  }
  return { scope: selection.scope, items };
}

interface EmbeddedImage {
  path: string;
  bytes: Uint8Array;
}

/**
 * Replaces embedded `data:image/...;base64,...` values in the context with
 * `images/<sha256>.<ext>` paths, collecting each referenced image's existing
 * bytes. Unknown image MIME types are left untouched (they are grandfathered
 * context, never introduced by returned operations).
 */
async function extractEmbeddedImages(context: Record<string, unknown>): Promise<{
  context: Record<string, unknown>;
  images: Map<string, EmbeddedImage>;
}> {
  const images = new Map<string, EmbeddedImage>();
  const pending: Array<{ value: unknown; key: string | number | null; parent: Record<string, unknown> | unknown[] }> = [
    { value: context, key: null, parent: [] as unknown[] },
  ];
  while (pending.length > 0) {
    const current = pending.pop()!;
    const value = current.value;
    if (typeof value === 'string') {
      const match = DATA_URL_RE.exec(value);
      if (match === null) continue;
      const extension = IMAGE_MIME_EXTENSIONS[match[1]!];
      if (extension === undefined) continue;
      const bytes = decodeBase64(match[2]!);
      const hex = await sha256Hex(bytes);
      const path = `images/${hex}.${extension}`;
      const existing = images.get(hex);
      if (existing === undefined) images.set(hex, { path, bytes });
      if (current.key !== null) {
        (current.parent as Record<string, unknown>)[current.key] = path;
      }
      continue;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => pending.push({ value: item, key: index, parent: value }));
      continue;
    }
    if (typeof value === 'object' && value !== null) {
      for (const [key, item] of Object.entries(value)) {
        pending.push({ value: item, key, parent: value as Record<string, unknown> });
      }
    }
  }
  return { context, images };
}

export function buildManifest(exportRecord: EditExport): ArchiveManifest {
  return {
    schemaVersion: '2.0.0',
    exportId: exportRecord.exportId,
    baseGeneration: exportRecord.baseGeneration,
    baseDigest: exportRecord.baseDigest,
    expiresAt: exportRecord.expiresAt,
    selection: exportRecord.selection === null ? null : { ...exportRecord.selection },
  };
}

function archiveFileName(exportId: string, now: Date): string {
  const date = now.toISOString().slice(0, 10);
  const time = now.toISOString().slice(11, 19).replace(/:/g, '-');
  return `bemtevi-edicao-${date}-${time}-${exportId.slice(0, 8)}.zip`;
}

/** Builds the durable editorial export archive for one server-captured export. */
export async function createEditorialArchive(
  exportRecord: EditExport,
  options: { now?: Date } = {},
): Promise<EditorialArchiveBuild> {
  const manifest = buildManifest(exportRecord);
  const rawContext = buildContext(exportRecord);
  const { context, images } = await extractEmbeddedImages(rawContext);
  const instructions = buildArchiveInstructions(exportRecord.exportId, exportRecord.expiresAt, exportRecord.selection);

  const zip = new JSZip();
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('context.json', JSON.stringify(context, null, 2));
  zip.file('instructions.md', instructions);
  for (const image of images.values()) {
    zip.file(image.path, image.bytes);
  }
  const zipData = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  return {
    zipData,
    fileName: archiveFileName(exportRecord.exportId, options.now ?? new Date()),
    manifest,
    context: context as Record<string, unknown>,
    imageCount: images.size,
    instructions,
  };
}
