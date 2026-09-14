import JSZip from 'jszip';
import { MAX_OPERATIONS_ENVELOPE_BYTES, type ErrorCode } from '@bemtevi/content-core';
import {
  MAX_ARCHIVE_UNCOMPRESSED_BYTES,
  checkInflatedEntry,
  preflightCentralDirectory,
  type ZipPreflightEntry,
} from './zipBounds';

/**
 * Editorial archive parser (doc 14 file contract, task AI-FILE-01).
 *
 * Accepts either a plain `operations.json` envelope (<= 8 MiB) or a ZIP whose
 * roots are exactly `operations.json` (required), an optional identical
 * `manifest.json` and the referenced `images/` files only. Every other root —
 * including an export's `context.json`/`instructions.md` — is an unsupported
 * root and rejects the whole import. Central-directory preflight runs before
 * JSZip; actual extraction is bounded afterwards. Parsing never mutates caller
 * state and never interprets context content as operations.
 */

export type ArchiveSource = { kind: 'json'; text: string } | { kind: 'zip'; bytes: Uint8Array };

export interface ParsedEditorialArchive {
  /** Raw (still unresolved) envelope JSON object. */
  envelopeRaw: Record<string, unknown>;
  /** Optional manifest; must be identical to the envelope bindings. */
  manifest: Record<string, unknown> | null;
  /** ZIP `images/` files by normalized path; empty for plain JSON sources. */
  imageFiles: ReadonlyMap<string, Uint8Array>;
  /** `imagePath` values referenced by uploaded image values in the envelope. */
  referencedImagePaths: ReadonlySet<string>;
}

export type ArchiveParseResult =
  | { ok: true; data: ParsedEditorialArchive }
  | { ok: false; error: { code: ErrorCode; message: string } };

function fail(code: ErrorCode, message: string): ArchiveParseResult {
  return { ok: false, error: { code, message } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Collects `imagePath` references from uploaded image values; rejects archive paths anywhere else.
 * For plain JSON sources (no `images/` folder can exist) `imagePath` itself is rejected: doc 14
 * permits it only in ZIP imports.
 */
function collectImageReferences(
  value: unknown,
  references: Set<string>,
  insideUploaded: boolean,
  path: string,
  rejectReferences: boolean,
): string | null {
  if (typeof value === 'string') {
    if (insideUploaded && path.endsWith('.imagePath')) {
      if (rejectReferences) {
        return '"imagePath" só é aceito em imports ZIP com a pasta images/: use "base64" em fontes JSON.';
      }
      if (!/^images\/[^/]+\.[a-z0-9]+$/.test(value)) {
        return `"imagePath" inválido: ${value}`;
      }
      references.add(value);
      return null;
    }
    if (value.startsWith('images/')) {
      return `Caminho de arquivo só é aceito em "imagePath" de imagem enviada: ${value}`;
    }
    return null;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const issue = collectImageReferences(value[i], references, insideUploaded, `${path}[${i}]`, rejectReferences);
      if (issue !== null) return issue;
    }
    return null;
  }
  if (isRecord(value)) {
    const uploaded = value['kind'] === 'uploaded';
    for (const [key, item] of Object.entries(value)) {
      if (key === 'imagePath' && !uploaded) {
        return `"imagePath" só é aceito em imagens enviadas (kind: "uploaded").`;
      }
      const issue = collectImageReferences(item, references, uploaded, `${path}.${key}`, rejectReferences);
      if (issue !== null) return issue;
    }
  }
  return null;
}

async function inflateZip(source: Uint8Array): Promise<ArchiveParseResult> {
  const preflight = preflightCentralDirectory(source);
  if (preflight.ok === false) {
    return fail('invalid_input', `Arquivo ZIP rejeitado (${preflight.error.code}): ${preflight.error.message}`);
  }
  const entries: ZipPreflightEntry[] = preflight.entries;
  const fileEntries = entries.filter((entry) => !entry.isDirectory);
  const directoryEntries = entries.length - fileEntries.length;
  if (
    directoryEntries > 1 ||
    (directoryEntries === 1 && !entries.some((entry) => entry.isDirectory && entry.name === 'images'))
  ) {
    return fail('invalid_input', 'O ZIP só pode conter a entrada de diretório opcional images/.');
  }
  const names = new Set(fileEntries.map((entry) => entry.name));
  if (!names.has('operations.json')) {
    return fail(
      'invalid_input',
      'O ZIP deve conter operations.json na raiz. context.json não é aceito como operações.',
    );
  }
  const unsupportedRoots = [...names].filter(
    (name) => name !== 'operations.json' && name !== 'manifest.json' && !name.startsWith('images/'),
  );
  if (unsupportedRoots.length > 0) {
    return fail('invalid_input', `Raízes não suportadas no ZIP: ${unsupportedRoots.join(', ')}`);
  }
  for (const name of names) {
    if (name.startsWith('images/') && name.includes('/', 'images/'.length)) {
      return fail('invalid_input', `Subpastas dentro de images/ não são aceitas: ${name}`);
    }
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(source, { checkCRC32: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'erro desconhecido';
    return fail('invalid_input', `Arquivo ZIP corrompido: ${message}`);
  }

  const imageFiles = new Map<string, Uint8Array>();
  let envelopeRaw: unknown = null;
  let manifest: unknown = null;
  let totalUncompressed = 0;
  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const handle = zip.file(entry.name);
    if (handle === null) return fail('invalid_input', `Entrada ausente no ZIP: ${entry.name}`);
    let bytes: Uint8Array;
    try {
      bytes = await handle.async('uint8array');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'erro desconhecido';
      return fail('invalid_input', `Falha ao ler ${entry.name}: ${message}`);
    }
    const boundError = checkInflatedEntry(entry, bytes.byteLength);
    if (boundError !== null) return fail('invalid_input', boundError.message);
    totalUncompressed += bytes.byteLength;
    if (totalUncompressed > MAX_ARCHIVE_UNCOMPRESSED_BYTES) {
      return fail('invalid_input', 'O total descomprimido do ZIP excede 12 MiB.');
    }
    if (entry.name === 'operations.json' || entry.name === 'manifest.json') {
      let parsed: unknown;
      try {
        parsed = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
      } catch {
        return fail('invalid_input', `${entry.name} não é JSON válido.`);
      }
      if (entry.name === 'operations.json') envelopeRaw = parsed;
      else manifest = parsed;
    } else imageFiles.set(entry.name, bytes);
  }
  if (!isRecord(envelopeRaw)) return fail('invalid_input', 'operations.json deve ser um objeto JSON.');
  if (manifest !== null && !isRecord(manifest)) return fail('invalid_input', 'manifest.json deve ser um objeto JSON.');

  const references = new Set<string>();
  const referenceIssue = collectImageReferences(envelopeRaw, references, false, '', false);
  if (referenceIssue !== null) return fail('invalid_input', referenceIssue);
  if (manifest !== null) {
    const manifestIssue = collectImageReferences(manifest, references, false, '', false);
    if (manifestIssue !== null) return fail('invalid_input', manifestIssue);
  }
  for (const reference of references) {
    if (!imageFiles.has(reference)) {
      return fail('invalid_input', `Imagem referenciada ausente no ZIP: ${reference}`);
    }
  }
  for (const name of imageFiles.keys()) {
    if (!references.has(name)) {
      return fail('invalid_input', `Arquivo de imagem não referenciado nas operações: ${name}`);
    }
  }
  return {
    ok: true,
    data: {
      envelopeRaw: envelopeRaw as Record<string, unknown>,
      manifest: manifest as Record<string, unknown> | null,
      imageFiles,
      referencedImagePaths: references,
    },
  };
}

/** Parses a candidate import archive. Throws nothing; failures are domain errors. */
export async function parseEditorialArchive(source: ArchiveSource): Promise<ArchiveParseResult> {
  if (source.kind === 'json') {
    const encoder = new TextEncoder();
    if (encoder.encode(source.text).byteLength > MAX_OPERATIONS_ENVELOPE_BYTES) {
      return fail('invalid_operations', 'O envelope de operações excede 8 MiB.');
    }
    let envelopeRaw: unknown;
    try {
      envelopeRaw = JSON.parse(source.text) as unknown;
    } catch {
      return fail('invalid_operations', 'operations.json não é JSON válido.');
    }
    if (!isRecord(envelopeRaw)) return fail('invalid_operations', 'operations.json deve ser um objeto JSON.');
    const references = new Set<string>();
    const referenceIssue = collectImageReferences(envelopeRaw, references, false, '', true);
    if (referenceIssue !== null) return fail('invalid_input', referenceIssue);
    return {
      ok: true,
      data: { envelopeRaw, manifest: null, imageFiles: new Map(), referencedImagePaths: references },
    };
  }
  return inflateZip(source.bytes);
}
