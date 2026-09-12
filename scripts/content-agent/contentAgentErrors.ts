import { DraftStoreError } from './draftStore';
import { SCOPES, toolArgumentKeys, type Scope } from './protocolInput';

export type JsonRecord = Record<string, unknown>;

export type ContentAgentErrorCode =
  | 'invalid_payload'
  | 'unauthorized'
  | 'stale_generation'
  | 'revision_conflict'
  | 'token_expired'
  | 'uncertain_outcome'
  | 'unavailable';

export class ContentAgentError extends Error {
  constructor(
    public readonly code: ContentAgentErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ContentAgentError';
  }
}

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0)
    throw new ContentAgentError('invalid_payload', `${label} é obrigatório.`);
  return value.trim();
}

export function requiredPositiveInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new ContentAgentError('invalid_payload', `${label} precisa ser um inteiro positivo.`);
  }
  return value;
}

export function parseRevision(value: unknown): number | null {
  if (value === null) return null;
  return requiredPositiveInteger(value, 'expectedRevision');
}

export function parseScope(value: unknown): Scope {
  if (typeof value !== 'string' || !SCOPES.includes(value as Scope)) {
    throw new ContentAgentError('invalid_payload', 'O escopo informado não é suportado.');
  }
  return value as Scope;
}

export function parseCursor(value: unknown): number {
  if (value === undefined) return 0;
  if (typeof value !== 'string' || !/^\d+$/.test(value))
    throw new ContentAgentError('invalid_payload', 'Cursor inválido.');
  const offset = Number(value);
  if (!Number.isSafeInteger(offset)) throw new ContentAgentError('invalid_payload', 'Cursor inválido.');
  return offset;
}

export function validateToolArguments(name: string, args: JsonRecord): void {
  const allowed = toolArgumentKeys[name];
  if (!allowed) throw new ContentAgentError('invalid_payload', `Ferramenta desconhecida: ${name}.`);
  const unknown = Object.keys(args).filter((key) => !allowed.has(key));
  if (unknown.length > 0) {
    throw new ContentAgentError('invalid_payload', `Argumentos desconhecidos: ${unknown.join(', ')}.`);
  }
  if (name === 'create_draft' || name === 'update_draft') {
    const variants = Number(Object.hasOwn(args, 'candidate')) + Number(Object.hasOwn(args, 'operations'));
    if (variants !== 1) {
      throw new ContentAgentError('invalid_payload', 'Informe exatamente um entre candidate e operations.');
    }
  }
  if (['get_flow', 'get_material'].includes(name) && args.revision !== undefined) {
    requiredPositiveInteger(args.revision, 'revision');
  }
  if (name === 'create_draft') {
    if (!Object.hasOwn(args, 'baseRevision')) {
      throw new ContentAgentError('invalid_payload', 'baseRevision é obrigatório.');
    }
    parseRevision(args.baseRevision);
  }
  if (['create_draft', 'update_draft'].includes(name) && args.idempotencyKey !== undefined) {
    const key = requiredString(args.idempotencyKey, 'idempotencyKey');
    if (key.length > 200) {
      throw new ContentAgentError('invalid_payload', 'idempotencyKey deve ter no máximo 200 caracteres.');
    }
  }
  if (
    name === 'get_draft_diff' &&
    args.against !== undefined &&
    !['base', 'published'].includes(String(args.against))
  ) {
    throw new ContentAgentError('invalid_payload', 'against precisa ser "base" ou "published".');
  }
}

export function mapContentAgentError(error: unknown): ContentAgentError {
  if (error instanceof ContentAgentError) return error;
  if (error instanceof DraftStoreError) return new ContentAgentError(error.code, error.message);
  return new ContentAgentError('unavailable', 'Não foi possível concluir a operação.');
}
