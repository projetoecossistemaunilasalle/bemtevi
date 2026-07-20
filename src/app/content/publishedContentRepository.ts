import {
  PUBLISHED_CONTENT_SCHEMA_VERSION,
  parsePublishedContentRow,
  validatePublicationPayload,
  PublishedContentValidationError,
  type PublishedContentPayload,
  type PublishedContentRow,
  type PublishedContentSnapshot,
} from './publishedContent';
import type { Database } from '../neon/database';
import { defaultNeonClient, type BemTeViNeonClient } from '../neon/client';

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

export interface PublishContentInput {
  payload: PublishedContentPayload;
  expectedRevision: number | null;
  publisherId: string;
}

export interface PublishedContentRepository {
  loadPublishedContent(): Promise<PublishedContentSnapshot | null>;
  publishContent(input: PublishContentInput): Promise<PublishedContentSnapshot>;
}

interface DataApiError {
  code?: string;
  message: string;
}

type PublishedContentInsert = Database['public']['Tables']['published_content']['Insert'];
type PublishedContentUpdate = Database['public']['Tables']['published_content']['Update'];

export interface PublishedContentGateway {
  readCurrent(): Promise<{ data: PublishedContentRow | null; error: DataApiError | null }>;
  insertCurrent(row: PublishedContentInsert): Promise<{ data: PublishedContentRow | null; error: DataApiError | null }>;
  updateCurrent(
    expectedRevision: number,
    row: PublishedContentUpdate,
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

function mapDataApiError(error: DataApiError): PublishedContentRepositoryError {
  if (error.code === '42501' || error.code === 'PGRST301' || indicatesMissingAuth(error)) {
    return new PublishedContentRepositoryError('unauthorized', 'Acesso não autorizado ao conteúdo publicado.');
  }
  if (error.code === '23505') {
    return new PublishedContentRepositoryError('conflict', 'Conflito de revisão ao publicar o conteúdo.');
  }
  return new PublishedContentRepositoryError('unavailable', 'Não foi possível concluir a operação no momento.');
}

function mapThrownError(error: unknown): PublishedContentRepositoryError {
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
        throw mapThrownError(error);
      }
    },

    async publishContent(input) {
      let payload: PublishedContentPayload;
      try {
        payload = validatePublicationPayload(input.payload);
      } catch (error) {
        if (error instanceof PublishedContentValidationError) {
          throw new PublishedContentRepositoryError('invalid_payload', 'O payload publicado é inválido.');
        }
        throw error;
      }

      const nextRevision = input.expectedRevision === null ? 1 : input.expectedRevision + 1;
      const write = {
        schema_version: PUBLISHED_CONTENT_SCHEMA_VERSION,
        revision: nextRevision,
        payload,
        published_at: new Date().toISOString(),
        published_by: input.publisherId,
      };

      try {
        const result =
          input.expectedRevision === null
            ? await gateway.insertCurrent({ id: 'current', ...write })
            : await gateway.updateCurrent(input.expectedRevision, { ...write });

        if (result.error) throw mapDataApiError(result.error);
        if (result.data === null) {
          throw new PublishedContentRepositoryError('conflict', 'Conflito de revisão ao publicar o conteúdo.');
        }
        return parseRow(result.data);
      } catch (error) {
        if (error instanceof PublishedContentRepositoryError) throw error;
        throw mapThrownError(error);
      }
    },
  };
}

function createNotConfiguredRepository(): PublishedContentRepository {
  const fail = (): never => {
    throw new PublishedContentRepositoryError('not_configured', 'O cliente Neon não está configurado.');
  };
  return {
    loadPublishedContent: fail,
    publishContent: fail,
  };
}

export const defaultPublishedContentRepository: PublishedContentRepository =
  defaultNeonClient === null
    ? createNotConfiguredRepository()
    : createPublishedContentRepository(createNeonPublishedContentGateway(defaultNeonClient));
