import { MAX_ID_CODE_POINTS, MAX_JSON_DEPTH, PROTOTYPE_KEYS } from './allowlists';
import type { JsonValue } from '../contracts/operations';
import type { EditorialError, ErrorCode } from '../contracts/errors';

export type JsonRecordInput = Record<string, unknown>;

/**
 * Failure variant used by the operation parsers. The `message` field is an
 * internal detail for tests/clients; wire responses expose only the frozen
 * optional `EditorialError` fields.
 */
export type OperationFailure = EditorialError & { message: string };
export type OpResult<T> = { ok: true; data: T } | { ok: false; error: OperationFailure };

export function isRecordInput(value: unknown): value is JsonRecordInput {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function ok<T>(data: T): OpResult<T> {
  return { ok: true, data };
}

export function fail(code: ErrorCode, message: string): OpResult<never> {
  return { ok: false, error: { code, message } };
}

export function isValidId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && [...value].length <= MAX_ID_CODE_POINTS;
}

export function isSafeCounter(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 9007199254740991;
}

export function isFiniteSafeInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

export function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

/**
 * Validates that a parsed value is pure JSON: finite numbers only, depth at
 * most 150, and no prototype-polluting keys anywhere in the tree.
 */
export function assertJsonLike(value: unknown, path: string, depth = 0): string | null {
  if (depth > MAX_JSON_DEPTH) return `${path}: profundidade de JSON excede o limite de ${MAX_JSON_DEPTH}.`;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? null : `${path}: número não finito não é permitido.`;
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const issue = assertJsonLike(value[index], `${path}[${index}]`, depth + 1);
      if (issue !== null) return issue;
    }
    return null;
  }
  if (!isRecordInput(value)) return `${path}: valor não é JSON.`;
  for (const key of Object.keys(value)) {
    if ((PROTOTYPE_KEYS as readonly string[]).includes(key)) {
      return `${path}: chave reservada "${key}" não é permitida.`;
    }
    const issue = assertJsonLike(value[key], path ? `${path}.${key}` : key, depth + 1);
    if (issue !== null) return issue;
  }
  return null;
}

export function isJsonRecord(value: JsonRecordInput): value is { [key: string]: JsonValue } {
  return assertJsonLike(value, '') === null;
}

/** Byte/JSON equality using canonical JSON serialization semantics. */
export function jsonEquals(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
