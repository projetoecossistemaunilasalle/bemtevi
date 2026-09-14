import {
  parsePublishedContentRow,
  PublishedContentValidationError,
  type PublishedContentRow,
  type PublishedContentSnapshot,
} from './publishedContent';
import type { Database } from '../neon/database';
import { defaultNeonClient, type BemTeViNeonClient } from '../neon/client';

/**
 * Read-only repository for the published content (INTEGRATION-02). The former
 * direct `publishContent` write path was MOVED into the temporary
 * `src/dev-dashboard/publishing/legacyPublication.ts` adapter, reachable only
 * from the legacy (`v2Enabled=false`) dashboard branch during coexistence.
 * V2 publication goes exclusively through the guarded
 * `DraftRepository.prepare()` + `DraftRepository.publish()` protocol.
 */

export type PublishedContentRepositoryErrorCode =
  | 'not_configured'
  | 'unauthorized'
  | 'conflict'
  | 'invalid_payload'
  | 'unavailable';

export class PublishedContentRepositoryError extends Error {
  constructor(
    public readonly code: PublishedContentRepositoryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PublishedContentRepositoryError';
  }
}

export interface PublishedContentRepository {
  loadPublishedContent(): Promise<PublishedContentSnapshot | null>;
}

interface DataApiError {
  code?: string;
  message: string;
}

type PublishedContentInsert = Database['public']['Tables']['published_content']['Insert'];

export interface PublishedContentGateway {
  readCurrent(): Promise<{ data: PublishedContentRow | null; error: DataApiError | null }>;
  insertCurrent(row: PublishedContentInsert): Promise<{ data: PublishedContentRow | null; error: DataApiError | null }>;
  updateCurrent(
    expectedRevision: number,
    row: Partial<PublishedContentInsert>,
  ): Promise<{ data: PublishedContentRow | null; error: DataApiError | null }>;
}

function toDataApiError(error: unknown): DataApiError | null {
  if (error == null) return null;
  if (typeof error === 'object') {
    const candidate = error as { code?: string | null; message?: string };
    return {
      code: typeof candidate.code === 'string' ? candidate.code : undefined,
      message: typeof candidate.message === 'string' ? candidate.message : 'Erro desconhecido.',
    };
  }
  return { message: String(error) };
}

function indicatesMissingAuth(error: unknown): boolean {
  const name = (error as { name?: unknown })?.name;
  const message = (error as { message?: unknown })?.message;
  const haystack = `${typeof name === 'string' ? name : ''} ${typeof message === 'string' ? message : ''}`;
  return name === 'AuthRequiredError' || /auth.?required|missing auth|token/i.test(haystack);
}

export function mapDataApiError(error: DataApiError): PublishedContentRepositoryError {
  if (error.code === '42501' || error.code === 'PGRST301' || indicatesMissingAuth(error)) {
    return new PublishedContentRepositoryError('unauthorized', 'Acesso não autorizado ao conteúdo publicado.');
  }
  if (error.code === '23505') {
    return new PublishedContentRepositoryError('conflict', 'Conflito de revisão ao publicar o conteúdo.');
  }
  return new PublishedContentRepositoryError('unavailable', 'Não foi possível concluir a operação no momento.');
}

export function mapThrownRepositoryError(error: unknown): PublishedContentRepositoryError {
  if (error instanceof PublishedContentRepositoryError) return error;
  if (indicatesMissingAuth(error)) {
    return new PublishedContentRepositoryError('unauthorized', 'Acesso não autorizado ao conteúdo publicado.');
  }
  return new PublishedContentRepositoryError('unavailable', 'Não foi possível concluir a operação no momento.');
}

function parseRow(row: PublishedContentRow): PublishedContentSnapshot {
  try {
    return parsePublishedContentRow(row);
  } catch (error) {
    if (error instanceof PublishedContentValidationError) {
      throw new PublishedContentRepositoryError(
        'invalid_payload',
        'O conteúdo publicado está corrompido ou incompatível.',
      );
    }
    throw error;
  }
}

export function createNeonPublishedContentGateway(client: BemTeViNeonClient): PublishedContentGateway {
  return {
    async readCurrent() {
      const { data, error } = await client.from('published_content').select('*').eq('id', 'current').maybeSingle();
      return {
        data: (data as PublishedContentRow | null) ?? null,
        error: toDataApiError(error),
      };
    },
    async insertCurrent(row) {
      const { data, error } = await client.from('published_content').insert(row).select('*').single();
      return {
        data: (data as PublishedContentRow | null) ?? null,
        error: toDataApiError(error),
      };
    },
    async updateCurrent(expectedRevision, row) {
      const { data, error } = await client
        .from('published_content')
        .update(row)
        .eq('id', 'current')
        .eq('revision', expectedRevision)
        .select('*')
        .maybeSingle();
      return {
        data: (data as PublishedContentRow | null) ?? null,
        error: toDataApiError(error),
      };
    },
  };
}

export function createPublishedContentRepository(gateway: PublishedContentGateway): PublishedContentRepository {
  return {
    async loadPublishedContent() {
      try {
        const { data, error } = await gateway.readCurrent();
        if (error) throw mapDataApiError(error);
        if (data === null) return null;
        return parseRow(data);
      } catch (error) {
        if (error instanceof PublishedContentRepositoryError) throw error;
        throw mapThrownRepositoryError(error);
      }
    },
  };
}

function createNotConfiguredRepository(): PublishedContentRepository {
  return {
    loadPublishedContent() {
      throw new PublishedContentRepositoryError('not_configured', 'O cliente Neon não está configurado.');
    },
  };
}

export const defaultPublishedContentRepository: PublishedContentRepository =
  defaultNeonClient === null
    ? createNotConfiguredRepository()
    : createPublishedContentRepository(createNeonPublishedContentGateway(defaultNeonClient));
