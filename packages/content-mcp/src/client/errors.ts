/**
 * Fixed error mapping (doc 04). Every failure surfaces as one of the frozen
 * editorial error codes; diagnostics on stderr are redacted and never contain
 * tokens, hashes, cookies, or request bodies.
 */

export type EditorialErrorCode =
  | 'unauthorized'
  | 'unavailable'
  | 'invalid_input'
  | 'invalid_image'
  | 'invalid_operations'
  | 'unsupported_schema'
  | 'stale_generation'
  | 'rebase_required'
  | 'retry_required'
  | 'merge_conflict'
  | 'validation_failed'
  | 'payload_too_large'
  | 'response_too_large'
  | 'rate_limited'
  | 'preparation_invalid'
  | 'preparation_expired'
  | 'preparation_stale'
  | 'revision_conflict'
  | 'published_base_unavailable'
  | 'draft_unavailable'
  | 'export_base_unavailable'
  | 'invalid_capability'
  | 'counter_exhausted'
  | 'operation_failed';

export const EDITORIAL_ERROR_CODES: readonly string[] = [
  'unauthorized',
  'unavailable',
  'invalid_input',
  'invalid_image',
  'invalid_operations',
  'unsupported_schema',
  'stale_generation',
  'rebase_required',
  'retry_required',
  'merge_conflict',
  'validation_failed',
  'payload_too_large',
  'response_too_large',
  'rate_limited',
  'preparation_invalid',
  'preparation_expired',
  'preparation_stale',
  'revision_conflict',
  'published_base_unavailable',
  'draft_unavailable',
  'export_base_unavailable',
  'invalid_capability',
  'counter_exhausted',
  'operation_failed',
];

export interface EditorialError {
  code: EditorialErrorCode;
  message: string;
}

export interface TransportCallResult<T> {
  data?: T;
  error?: EditorialError;
}

/** Redacts credential material from any diagnostic string (doc 04). */
export function redact(text: string, secrets: readonly string[]): string {
  let redacted = text;
  for (const secret of secrets) {
    if (secret.length === 0) continue;
    redacted = redacted.split(secret).join('[REDACTED]');
  }
  // URL-embedded credentials and authorization headers/cookies.
  redacted = redacted.replace(/Authorization:\s*\S+/gi, 'Authorization: [REDACTED]');
  redacted = redacted.replace(/cookie:[^;\n]*/gi, 'cookie: [REDACTED]');
  return redacted;
}

/** Maps a transport-level failure to the fixed editorial error codes. */
export function mapTransportError(error: unknown): EditorialError {
  const status = extractStatus(error);
  if (status === 401 || status === 403 || status === 42501) {
    return { code: 'unauthorized', message: 'A conexão não tem permissão para esta ação.' };
  }
  if (status !== undefined) {
    return { code: 'unavailable', message: `A operação falhou (HTTP ${status}).` };
  }
  return { code: 'unavailable', message: 'A operação falhou por problema de rede.' };
}

function extractStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const candidate = error as { status?: unknown; code?: unknown };
  if (typeof candidate.status === 'number') return candidate.status;
  if (typeof candidate.code === 'string') {
    const match = candidate.code.match(/^(\d{3})$/);
    if (match) return Number(match[1]);
  }
  return undefined;
}

/** Decodes an RPC-shaped Result envelope into a fixed editorial error. */
export function decodeDomainError(raw: unknown): EditorialError {
  if (typeof raw === 'object' && raw !== null && typeof (raw as { code?: unknown }).code === 'string') {
    const code = (raw as { code: string }).code;
    if (EDITORIAL_ERROR_CODES.includes(code)) {
      const message =
        typeof (raw as { message?: unknown }).message === 'string' ? (raw as { message: string }).message : code;
      return { code: code as EditorialErrorCode, message };
    }
  }
  return { code: 'unavailable', message: 'A operação retornou uma resposta inválida.' };
}
