import type { JsonValue } from '../contracts/operations';
import type { PublishedContentPayload } from '../model/publishedContent';

export type ValueSlot = { present: false } | { present: true; value: JsonValue };
export type PathSegment = { kind: 'field'; key: string } | { kind: 'record'; id: string } | { kind: 'order' };
export type ContentPath = PathSegment[];
export interface SemanticChange {
  id: string;
  path: ContentPath;
  kind: 'added' | 'removed' | 'edited' | 'moved';
  before: ValueSlot;
  after: ValueSlot;
  recordLabel?: string;
}
export interface SemanticConflict {
  id: string;
  path: ContentPath;
  base: ValueSlot;
  local: ValueSlot;
  remote: ValueSlot;
}
export type ConflictDecisions = Record<string, ValueSlot>;
export type ComparisonResult<T> = { ok: true; value: T } | { ok: false; code: 'invalid_input' | 'comparison_failed' };
export type SemanticMerge =
  | { kind: 'complete'; candidate: PublishedContentPayload; conflicts: SemanticConflict[] }
  | { kind: 'incomplete'; candidate: PublishedContentPayload; conflicts: SemanticConflict[] };

export const absent: ValueSlot = { present: false };
export const collections = new Set([
  'flows',
  'educationMaterials',
  'educationGroups',
  'contacts',
  'locations',
  'options',
  'body',
]);
export const object = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
export const slot = (v: JsonValue | undefined): ValueSlot => (v === undefined ? absent : { present: true, value: v });
export const field = (key: string): PathSegment => ({ kind: 'field', key });
export const value = (s: ValueSlot) => (s.present ? s.value : undefined);

// Unlike the legacy normalizer, array order and null are significant.
export function contentIdentity(input: unknown): string {
  if (input === undefined) return 'missing';
  if (Array.isArray(input)) return `[${input.map(contentIdentity).join(',')}]`;
  if (object(input))
    return `{${Object.keys(input)
      .filter((key) => input[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${contentIdentity(input[key])}`)
      .join(',')}}`;
  return JSON.stringify(input);
}
export function fingerprint(input: unknown): string {
  const text = contentIdentity(input);
  let a = 0x811c9dc5,
    b = 0x9e3779b9;
  for (let i = 0; i < text.length; i++) {
    a = Math.imul(a ^ text.charCodeAt(i), 16777619);
    b = Math.imul(b ^ text.charCodeAt(i), 2246822519);
  }
  return `${text.length}:${a >>> 0}:${b >>> 0}`;
}
export const equal = (a: ValueSlot, b: ValueSlot) =>
  a.present === b.present && contentIdentity(value(a)) === contentIdentity(value(b));
export const keyed = (path: ContentPath) => {
  const last = path.at(-1);
  return last?.kind === 'field' && collections.has(last.key);
};
export const mapById = (entries: JsonValue[]) => new Map(entries.map((entry) => [(entry as { id: string }).id, entry]));
export const idsOf = (entries: JsonValue[]) => entries.map((entry) => (entry as { id: string }).id);
