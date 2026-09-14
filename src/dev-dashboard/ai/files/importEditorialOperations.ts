import {
  applyOperations,
  parseOperationsEnvelope,
  sha256Text,
  sameContent,
  compareContent,
  inspectContent,
  type ContentValidationIssue,
  type EditorialEnvelope,
  type EditExport,
  type ErrorCode,
  type EditorialOperation,
  type PublishedContentPayload,
  type SemanticChange,
} from '@bemtevi/content-core';
import type { ParsedEditorialArchive } from './parseEditorialArchive';

/**
 * Import orchestration for returned editorial operations (doc 14, task
 * AI-FILE-01). The owner base is always the durable server-captured export:
 * the envelope's exportId, baseGeneration and baseDigest are checked against
 * the retrieved owner export and expiry is checked on every attempt. The
 * latest draft is NEVER substituted. The candidate, semantic diff and
 * validation issues are returned to the caller; nothing here mutates caller
 * state, persists anything, or applies a partial batch.
 */

export interface EditorialImportOutcome {
  candidate: PublishedContentPayload;
  changes: SemanticChange[];
  issues: ContentValidationIssue[];
  operationsCount: number;
}

export interface ImportOptions {
  /** Injectable clock; defaults to the current time (ISO string comparison). */
  now?: () => Date;
}

export type EditorialImportResult =
  | { ok: true; data: EditorialImportOutcome }
  | { ok: false; error: { code: ErrorCode; message: string } };

function fail(code: ErrorCode, message: string): EditorialImportResult {
  return { ok: false, error: { code, message } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Resolves ZIP `imagePath` references of uploaded image values into canonical
 * uploaded `base64` values (core semantics). Any other archive-path usage was
 * already rejected during parsing.
 */
function resolveImagePaths(
  envelopeRaw: Record<string, unknown>,
  imageFiles: ReadonlyMap<string, Uint8Array>,
): Record<string, unknown> {
  const resolve = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(resolve);
    if (!isRecord(value)) return value;
    const resolved: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (key === 'imagePath' && value['kind'] === 'uploaded') {
        const bytes = imageFiles.get(item as string);
        if (bytes === undefined) {
          throw new Error(`Imagem referenciada ausente no ZIP: ${String(item)}`);
        }
        resolved['base64'] = encodeImageBytes(bytes);
        continue;
      }
      resolved[key] = resolve(item);
    }
    return resolved;
  };
  return resolve(envelopeRaw) as Record<string, unknown>;
}

function encodeImageBytes(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function checkManifest(manifest: Record<string, unknown> | null, envelope: Record<string, unknown>): string | null {
  if (manifest === null) return null;
  const bindings: Array<[string, string]> = [
    ['exportId', 'exportId'],
    ['baseDigest', 'baseDigest'],
  ];
  for (const [manifestKey, envelopeKey] of bindings) {
    if (manifest[manifestKey] !== envelope[envelopeKey]) {
      return `manifest.json difere de operations.json em "${manifestKey}".`;
    }
  }
  if (manifest['baseGeneration'] !== envelope['baseGeneration']) {
    return 'manifest.json difere de operations.json em "baseGeneration".';
  }
  if (manifest['schemaVersion'] !== '2.0.0') {
    return 'manifest.json precisa usar schemaVersion "2.0.0".';
  }
  return null;
}

function checkSelectionRules(
  selection: { scope: string; ids: string[] } | null,
  operations: EditorialOperation[],
): string | null {
  if (selection === null) return null;
  const allowed = new Set(selection.ids);
  for (const operation of operations) {
    if (operation.op === 'add' || operation.op === 'reorder' || operation.op === 'set_default_group_order') {
      return `A operação "${operation.op}" não é aceita em exportações parciais (escopo ${selection.scope}).`;
    }
    const targetId = operation.op === 'set_material_image' ? operation.materialId : operation.id;
    if (targetId !== '' && !allowed.has(targetId)) {
      return `A operação em "${targetId}" está fora da seleção da exportação (${selection.scope}).`;
    }
  }
  return null;
}

/** Runs the full import pipeline: base verification, bindings, apply, diff and issues. */
export async function importEditorialOperations(
  parsed: ParsedEditorialArchive,
  ownerExport: EditExport,
  options: ImportOptions = {},
): Promise<EditorialImportResult> {
  const now = options.now ?? (() => new Date());
  if (ownerExport.expiresAt <= now().toISOString()) {
    return fail('export_base_unavailable', 'A exportação expirou. Exporte o conteúdo novamente no painel.');
  }

  const canonicalDigest = await sha256Text(ownerExport.canonicalPayload);
  if (canonicalDigest !== ownerExport.baseDigest) {
    return fail('export_base_unavailable', 'A base capturada na exportação não confere com o digest registrado.');
  }
  let canonicalPayload: unknown;
  try {
    canonicalPayload = JSON.parse(ownerExport.canonicalPayload) as unknown;
  } catch {
    return fail('export_base_unavailable', 'A base capturada na exportação não é JSON válido.');
  }
  if (!sameContent(canonicalPayload as PublishedContentPayload, ownerExport.basePayload)) {
    return fail('export_base_unavailable', 'A base capturada na exportação difere do payload registrado.');
  }

  const manifestIssue = checkManifest(parsed.manifest, parsed.envelopeRaw);
  if (manifestIssue !== null) return fail('invalid_input', manifestIssue);

  const canonicalEnvelopeRaw = resolveImagePaths(parsed.envelopeRaw, parsed.imageFiles);
  const envelopeResult = parseOperationsEnvelope(canonicalEnvelopeRaw);
  if (envelopeResult.ok === false) {
    return { ok: false, error: envelopeResult.error };
  }
  const envelope: EditorialEnvelope = envelopeResult.data;

  if (envelope.exportId !== ownerExport.exportId) {
    return fail('export_base_unavailable', 'O exportId do arquivo não corresponde à exportação recuperada.');
  }
  if (envelope.baseGeneration !== ownerExport.baseGeneration || envelope.baseDigest !== ownerExport.baseDigest) {
    return fail(
      'export_base_unavailable',
      'O arquivo foi gerado sobre outra base (geração/digest). Exporte novamente.',
    );
  }

  const selectionIssue = checkSelectionRules(ownerExport.selection, envelope.operations);
  if (selectionIssue !== null) return fail('invalid_operations', selectionIssue);

  const applied = applyOperations(ownerExport.basePayload, envelope.operations);
  if (applied.ok === false) return { ok: false, error: applied.error };

  const candidate = applied.data;
  let changes: SemanticChange[] = [];
  const comparison = compareContent(ownerExport.basePayload, candidate);
  if (comparison.ok === true) changes = comparison.value;
  const inspection = inspectContent(candidate);
  return {
    ok: true,
    data: {
      candidate,
      changes,
      issues: inspection.validation.issues,
      operationsCount: envelope.operations.length,
    },
  };
}
