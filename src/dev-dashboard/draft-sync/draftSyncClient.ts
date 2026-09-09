import { isContentDraft, type ContentDraft } from './contentDraft';
import type { PublishedContentPayload } from '../../app/content/publishedContent';

export const draftSyncDefaults = {
  url: 'http://127.0.0.1:4319',
  urlStorageKey: 'bemtevi:draft-sync:url',
  tokenStorageKey: 'bemtevi:draft-sync:token',
} as const;

export const DRAFT_SYNC_MAX_RESPONSE_BYTES = 6 * 1024 * 1024;

export type DraftSyncErrorCode =
  | 'invalid_payload'
  | 'unauthorized'
  | 'stale_generation'
  | 'revision_conflict'
  | 'token_expired'
  | 'uncertain_outcome'
  | 'unavailable';

export class DraftSyncError extends Error {
  constructor(
    public readonly code: DraftSyncErrorCode,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'DraftSyncError';
  }
}

export interface DraftListOptions {
  cursor?: string;
  limit?: number;
}

export interface DraftListResult {
  drafts: ContentDraft[];
  nextCursor: string | null;
}

export interface CreateDraftInput {
  baseRevision: number | null;
  basePayload: PublishedContentPayload;
  candidate: PublishedContentPayload;
  idempotencyKey: string;
}

export interface UpdateDraftInput {
  draftId: string;
  expectedGeneration: number;
  candidate: PublishedContentPayload;
  idempotencyKey: string;
}

export interface DraftDiff {
  draftId: string;
  generation: number;
  candidateDigest: string;
  baseDigest: string;
  changes: unknown[];
  summary?: Record<string, unknown>;
}

export interface DraftSyncClientOptions {
  token?: string;
  fetchImpl?: typeof fetch;
  maxResponseBytes?: number;
}

export async function pairDraftSync(baseUrl: string, code: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  let response: Response;
  try {
    response = await fetchImpl(`${normalizeDraftSyncUrl(baseUrl)}/v1/pair`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code.trim() }),
    });
  } catch {
    throw new DraftSyncError('unavailable', 'A API local de rascunhos não está disponível.');
  }
  const body = await readJson(response, DRAFT_SYNC_MAX_RESPONSE_BYTES);
  if (!response.ok) throw mapError(response.status, body);
  if (!isRecord(body) || typeof body.token !== 'string' || !body.token) {
    throw new DraftSyncError('invalid_payload', 'A API local não confirmou o pareamento.');
  }
  return body.token;
}

/** Computes the digest format used when sending a candidate back to DraftStore. */
export async function digestContent(value: unknown): Promise<string> {
  const serialized = stableSerialize(value);
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new DraftSyncError('unavailable', 'Este navegador não oferece o cálculo seguro do digest.');
  const bytes = new TextEncoder().encode(serialized);
  const hash = await subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function normalizeDraftSyncUrl(value: string): string {
  const normalized = value.trim().replace(/\/+$/, '') || draftSyncDefaults.url;
  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    throw new DraftSyncError('unavailable', 'O endereço da sincronização local é inválido.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new DraftSyncError('unavailable', 'A sincronização local usa apenas HTTP ou HTTPS.');
  }
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
    throw new DraftSyncError('unavailable', 'A sincronização do dashboard só pode usar a conexão deste computador.');
  }
  return url.toString().replace(/\/$/, '');
}

export class DraftSyncClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly fetchImpl: typeof fetch;
  private readonly maxResponseBytes: number;

  constructor(baseUrl: string = draftSyncDefaults.url, options: DraftSyncClientOptions = {}) {
    this.baseUrl = normalizeDraftSyncUrl(baseUrl);
    this.token = options.token?.trim() ?? '';
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.maxResponseBytes = options.maxResponseBytes ?? DRAFT_SYNC_MAX_RESPONSE_BYTES;
  }

  listDrafts(options: DraftListOptions = {}): Promise<DraftListResult> {
    const limit = Math.max(1, Math.min(100, Math.floor(options.limit ?? 20)));
    const query = new URLSearchParams({ limit: String(limit) });
    if (options.cursor) query.set('cursor', options.cursor);
    return this.request(`/v1/drafts?${query.toString()}`, parseDraftList);
  }

  getDraft(draftId: string, generation?: number): Promise<ContentDraft> {
    const id = encodeDraftId(draftId);
    const query = generation === undefined ? '' : `?generation=${encodeURIComponent(String(generation))}`;
    return this.request(`/v1/drafts/${id}${query}`, parseDraftResponse);
  }

  createDraft(input: CreateDraftInput): Promise<ContentDraft> {
    return this.request('/v1/drafts', parseDraftResponse, {
      method: 'POST',
      body: JSON.stringify(input),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  updateDraft(input: UpdateDraftInput): Promise<ContentDraft> {
    return this.request(`/v1/drafts/${encodeDraftId(input.draftId)}`, parseDraftResponse, {
      method: 'PUT',
      body: JSON.stringify({
        expectedGeneration: input.expectedGeneration,
        candidate: input.candidate,
        idempotencyKey: input.idempotencyKey,
      }),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  getDraftDiff(draftId: string, generation?: number): Promise<DraftDiff> {
    const query = generation === undefined ? '' : `?generation=${encodeURIComponent(String(generation))}`;
    return this.request(`/v1/drafts/${encodeDraftId(draftId)}/diff${query}`, parseDraftDiff);
  }

  private async request<T>(path: string, parse: (value: unknown) => T, init: RequestInit = {}): Promise<T> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          Accept: 'application/json',
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
          ...init.headers,
        },
      });
    } catch {
      throw new DraftSyncError('unavailable', 'A conexão local de rascunhos não está disponível.');
    }

    const body = await readJson(response, this.maxResponseBytes);
    if (!response.ok) throw mapError(response.status, body);
    try {
      return parse(body);
    } catch {
      throw new DraftSyncError('invalid_payload', 'A conexão local devolveu um rascunho incompatível.');
    }
  }
}

function encodeDraftId(value: string): string {
  const id = value.trim();
  if (!id) throw new DraftSyncError('invalid_payload', 'Informe o identificador do rascunho.');
  return encodeURIComponent(id);
}

async function readJson(response: Response, maxBytes: number): Promise<unknown> {
  const contentLength = response.headers.get('content-length');
  if (contentLength && Number(contentLength) > maxBytes) {
    throw new DraftSyncError('invalid_payload', 'A resposta da sincronização excedeu o limite permitido.');
  }
  let text: string;
  try {
    text = await response.text();
  } catch {
    throw new DraftSyncError('unavailable', 'Não foi possível ler a resposta da sincronização local.');
  }
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new DraftSyncError('invalid_payload', 'A resposta da sincronização excedeu o limite permitido.');
  }
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new DraftSyncError('invalid_payload', 'A conexão local devolveu uma resposta inválida.');
  }
}

function parseDraftResponse(value: unknown): ContentDraft {
  const candidate = isRecord(value) && 'draft' in value ? value.draft : value;
  if (!isContentDraft(candidate)) throw new Error('invalid_draft');
  return candidate;
}

function parseDraftList(value: unknown): DraftListResult {
  if (!isRecord(value) || !Array.isArray(value.drafts)) throw new Error('invalid_list');
  const drafts = value.drafts.map(parseDraftResponse);
  return { drafts, nextCursor: typeof value.nextCursor === 'string' ? value.nextCursor : null };
}

function parseDraftDiff(value: unknown): DraftDiff {
  const candidate = isRecord(value) && 'diff' in value ? value.diff : value;
  if (!isRecord(candidate)) throw new Error('invalid_diff');
  if (
    typeof candidate.draftId !== 'string' ||
    typeof candidate.generation !== 'number' ||
    !Number.isSafeInteger(candidate.generation) ||
    typeof candidate.candidateDigest !== 'string' ||
    typeof candidate.baseDigest !== 'string' ||
    !Array.isArray(candidate.changes)
  )
    throw new Error('invalid_diff');
  return candidate as unknown as DraftDiff;
}

function mapError(status: number, body: unknown): DraftSyncError {
  const errorBody = isRecord(body) && isRecord(body.error) ? body.error : body;
  const code = isRecord(errorBody) && typeof errorBody.code === 'string' ? errorBody.code : undefined;
  const knownCodes: DraftSyncErrorCode[] = [
    'invalid_payload',
    'unauthorized',
    'stale_generation',
    'revision_conflict',
    'token_expired',
    'uncertain_outcome',
    'unavailable',
  ];
  const mapped = knownCodes.includes(code as DraftSyncErrorCode)
    ? (code as DraftSyncErrorCode)
    : status === 401
      ? 'unauthorized'
      : status === 409
        ? 'revision_conflict'
        : 'unavailable';
  const messages: Record<DraftSyncErrorCode, string> = {
    invalid_payload: 'O rascunho não passou pela validação de conteúdo.',
    unauthorized: 'A conexão local não está autorizada. Conecte o assistente novamente.',
    stale_generation: 'Este rascunho foi alterado em outra sessão. Carregue a geração mais recente antes de editar.',
    revision_conflict: 'A publicação mudou desde a base deste rascunho. Revise o conflito antes de continuar.',
    token_expired: 'A autorização desta operação expirou. Prepare a publicação novamente.',
    uncertain_outcome: 'O resultado da operação é incerto. Consulte o rascunho antes de tentar novamente.',
    unavailable: 'Não foi possível concluir a sincronização local.',
  };
  return new DraftSyncError(mapped, messages[mapped], status);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}
