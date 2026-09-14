/**
 * Shared tool-layer helpers (doc 04 "Tool Input And Output Catalog" / doc 14
 * frozen contracts). Private to the MCP-02 tool subtree: in-band RPC envelope
 * unwrapping, frozen error surfacing, ContentValidation projection, data-URL
 * scrubbing, pagination and the 256 KiB output budget (counting both the text
 * and structuredContent copies of the serialized result).
 */

import type { ContentValidation, Counter, DraftHead, Scope, SemanticConflict } from '@bemtevi/content-core';
import { EDITORIAL_SCOPES, isImageDataUrl } from '@bemtevi/content-core';
import { EDITORIAL_ERROR_CODES, type EditorialError, type TransportCallResult } from '../client/errors';

/** Error surfaced by tool results: frozen code plus PT-BR message (doc 14 allows structured extras). */
export interface ToolError extends EditorialError {
  conflicts?: SemanticConflict[];
}

export type ToolOutcome<T> = { ok: true; data: T } | { ok: false; error: ToolError };

export const OUTPUT_BUDGET_BYTES = 256 * 1024;
export const EMBEDDED_IMAGE_PLACEHOLDER = '[embedded image omitted]';
export const MAX_PROJECTED_ISSUES = 20;
export const ISSUE_CODE_MAX = 120;
export const ISSUE_MESSAGE_MAX = 300;
export const ISSUE_PATH_MAX = 200;

const PT_BR_FALLBACKS: Record<string, string> = {
  unauthorized: 'A conexão não tem permissão para esta ação.',
  invalid_capability: 'A conexão é inválida, expirou ou foi revogada.',
  invalid_input: 'Entrada inválida para esta ferramenta.',
  invalid_operations: 'A estrutura das operações é inválida.',
  invalid_image: 'A imagem informada é inválida.',
  stale_generation: 'O rascunho mudou desde a leitura. Atualize o contexto.',
  rebase_required: 'A base em cache não está disponível. Chame get_editor_context novamente.',
  merge_conflict: 'A mesclagem semântica tem conflitos não resolvidos.',
  retry_required: 'Muitas mudanças concorrentes. Releia o contexto e tente de novo.',
  rate_limited: 'Muitas chamadas em pouco tempo. Aguarde antes de tentar de novo.',
  response_too_large: 'A resposta desta chamada é grande demais para ser representada.',
  unavailable: 'A operação falhou por problema de rede. Releia o contexto.',
  draft_unavailable: 'O rascunho compartilhado não está disponível.',
};

export function fallbackMessage(code: string): string {
  return PT_BR_FALLBACKS[code] ?? 'A operação falhou.';
}

export function isFrozenErrorCode(code: string): boolean {
  return (EDITORIAL_ERROR_CODES as readonly string[]).includes(code);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function toolOk<T>(data: T): ToolOutcome<T> {
  return { ok: true, data };
}

export function toolFail(
  code: EditorialError['code'],
  message?: string,
  conflicts?: SemanticConflict[],
): ToolOutcome<never> {
  return { ok: false, error: { code, message: message ?? fallbackMessage(code), ...(conflicts ? { conflicts } : {}) } };
}

/**
 * Unwraps a transport outcome into the in-band Result envelope. Successful
 * HTTP responses carry `{ok:true,data:X}` or `{ok:false,error:{code,...}}`
 * inside `data`; transport/HTTP failures arrive as `error` already mapped to
 * fixed editorial codes. Only frozen optional fields are surfaced (never SQL
 * messages or request bodies).
 */
export function unwrapRpcOutcome(outcome: TransportCallResult<unknown>): ToolOutcome<unknown> {
  if (outcome.error !== undefined) return { ok: false, error: outcome.error };
  const envelope = outcome.data;
  if (isRecord(envelope) && envelope.ok === true) return { ok: true, data: envelope.data };
  if (isRecord(envelope) && envelope.ok === false && isRecord(envelope.error)) {
    const rawCode = envelope.error.code;
    if (typeof rawCode === 'string' && isFrozenErrorCode(rawCode)) {
      const message =
        typeof envelope.error.message === 'string' && envelope.error.message.length > 0
          ? envelope.error.message
          : fallbackMessage(rawCode);
      return { ok: false, error: { code: rawCode as EditorialError['code'], message } };
    }
  }
  return toolFail('unavailable', 'A operação retornou uma resposta inválida.');
}

/** Truncates a string to `max` UTF-16 code units. */
export function truncateText(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max);
}

/**
 * Deep clone that replaces every embedded image data URL with the fixed
 * placeholder; catalog IDs and external URLs are preserved.
 */
export function scrubDataUrls(value: unknown): unknown {
  if (typeof value === 'string') return isImageDataUrl(value) ? EMBEDDED_IMAGE_PLACEHOLDER : value;
  if (Array.isArray(value)) return value.map((item) => scrubDataUrls(item));
  if (isRecord(value)) {
    const next: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) next[key] = scrubDataUrls(entry);
    return next;
  }
  return value;
}

/** Projects the complete validation report to at most 20 bounded issues (doc 04). */
export function projectValidation(validation: ContentValidation): ContentValidation {
  const projected = validation.issues.slice(0, MAX_PROJECTED_ISSUES).map((issue) => ({
    code: truncateText(issue.code, ISSUE_CODE_MAX),
    level: issue.level,
    message: truncateText(issue.message, ISSUE_MESSAGE_MAX),
    ...(issue.path ? { path: truncateText(issue.path, ISSUE_PATH_MAX) } : {}),
  }));
  const omitted = validation.issues.length - projected.length;
  if (omitted > 0) {
    projected.push({
      code: 'output_truncated',
      level: 'warning',
      message: `Relatório completo tem ${validation.issues.length} problemas; ${omitted} omitido(s) na resposta.`,
    });
  }
  return { valid: validation.valid, issues: projected };
}

/** Serialized UTF-8 byte length of a value. */
export function utf8ByteLength(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

/** True when the doubled representation (text + structuredContent) fits 256 KiB. */
export function fitsOutputBudget(result: unknown): boolean {
  return utf8ByteLength(result) * 2 <= OUTPUT_BUDGET_BYTES;
}

/** Scope guard for the five-scope enum (doc 14). */
export function isScope(value: string): value is Scope {
  return (EDITORIAL_SCOPES as readonly string[]).includes(value);
}

/** Scope collection of a payload (the five scopes only, in payload order). */
export function scopeCollection(payload: unknown, scope: Scope): Array<Record<string, unknown>> {
  if (!isRecord(payload) || !Array.isArray(payload[scope])) return [];
  return payload[scope].filter(isRecord);
}

/** Item label: title, then name, then id, truncated to 160 characters (doc 04). */
export function itemLabel(item: Record<string, unknown>): string {
  const source = [item.title, item.name, item.id].find((value) => typeof value === 'string' && value.length > 0);
  return truncateText(typeof source === 'string' ? source : '', 160);
}

export interface Page<T> {
  items: T[];
  nextOffset: number | null;
}

/** Slices one page; `nextOffset` points after the last returned item (null when exhausted). */
export function paginate<T>(items: readonly T[], offset: number, limit: number): Page<T> {
  const start = Math.min(offset, items.length);
  const end = Math.min(start + limit, items.length);
  const page = items.slice(start, end);
  const nextOffset = end < items.length ? end : null;
  return { items: page, nextOffset };
}

/** Slices one page of paged JSON text (UTF-16 code units, doc 04 get_item). */
export function pageText(text: string, offset: number, limit: number): { jsonText: string; nextOffset: number | null } {
  const start = Math.min(offset, text.length);
  const end = Math.min(start + limit, text.length);
  return { jsonText: text.slice(start, end), nextOffset: end < text.length ? end : null };
}

/** Structural check for a wire DraftHead (doc 14). */
export function isDraftHead(value: unknown): value is DraftHead {
  return (
    isRecord(value) &&
    value.id === 'current' &&
    typeof value.schemaVersion === 'string' &&
    isNonNegativeSafeInteger(value.baseRevision) &&
    isPositiveSafeInteger(value.generation) &&
    typeof value.digest === 'string' &&
    typeof value.updatedAt === 'string' &&
    isRecord(value.lastActor)
  );
}

/** Projects a draft row to its head (payload/canonical text never leak). */
export function headOf(draft: {
  id: string;
  schemaVersion: string;
  baseRevision: Counter;
  generation: Counter;
  digest: string;
  updatedAt: string;
  lastActor: { kind: string; principalUserId: string; connectionId: string | null };
}): DraftHead {
  return {
    id: 'current',
    schemaVersion: draft.schemaVersion as DraftHead['schemaVersion'],
    baseRevision: draft.baseRevision,
    generation: draft.generation,
    digest: draft.digest,
    updatedAt: draft.updatedAt,
    lastActor: draft.lastActor as DraftHead['lastActor'],
  };
}

export function scopeCounts(payload: unknown): Record<Scope, number> {
  const counts = {} as Record<Scope, number>;
  for (const scope of EDITORIAL_SCOPES) counts[scope] = scopeCollection(payload, scope).length;
  return counts;
}

export function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;
}

export function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
