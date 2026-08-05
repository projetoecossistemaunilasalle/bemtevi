import type { Database } from '../neon/database';
import { defaultNeonClient, type BemTeViNeonClient } from '../neon/client';
import { PAGE_VIEW_ROUTES, type PageViewRoute } from '../../domain/analytics/pageViews';

export interface PageViewCount {
  date: string;
  route: PageViewRoute;
  count: number;
}

export type PageViewRepositoryErrorCode = 'not_configured' | 'unauthorized' | 'invalid_data' | 'unavailable';

export class PageViewRepositoryError extends Error {
  constructor(
    public readonly code: PageViewRepositoryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PageViewRepositoryError';
  }
}

export interface PageViewRepository {
  recordPageView(route: PageViewRoute): Promise<void>;
  loadPageViewCounts(startDate: string): Promise<PageViewCount[]>;
}

interface DataApiError {
  code?: string;
  message: string;
}

type PageViewCountRow = Database['public']['Tables']['page_view_counts']['Row'];

export interface PageViewGateway {
  increment(route: PageViewRoute): Promise<{ error: DataApiError | null }>;
  listFrom(startDate: string): Promise<{ data: unknown; error: DataApiError | null }>;
}

const allowedRoutes = new Set<string>(PAGE_VIEW_ROUTES);
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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

function mapError(error: unknown): PageViewRepositoryError {
  if (error instanceof PageViewRepositoryError) return error;

  const dataApiError = toDataApiError(error);
  if (dataApiError?.code === '42501' || dataApiError?.code === 'PGRST301' || indicatesMissingAuth(error)) {
    return new PageViewRepositoryError('unauthorized', 'Acesso não autorizado às estatísticas.');
  }

  return new PageViewRepositoryError('unavailable', 'Não foi possível acessar as estatísticas no momento.');
}

function parseCount(value: unknown): number | null {
  const count = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  return typeof count === 'number' && Number.isSafeInteger(count) && count >= 0 ? count : null;
}

function parseRow(value: unknown): PageViewCount {
  if (value === null || typeof value !== 'object') {
    throw new PageViewRepositoryError('invalid_data', 'As estatísticas recebidas são inválidas.');
  }

  const row = value as Partial<PageViewCountRow>;
  const count = parseCount(row.view_count);
  if (
    typeof row.view_date !== 'string' ||
    !ISO_DATE_PATTERN.test(row.view_date) ||
    typeof row.route !== 'string' ||
    !allowedRoutes.has(row.route) ||
    count === null
  ) {
    throw new PageViewRepositoryError('invalid_data', 'As estatísticas recebidas são inválidas.');
  }

  return {
    date: row.view_date,
    route: row.route as PageViewRoute,
    count,
  };
}

export function createNeonPageViewGateway(client: BemTeViNeonClient): PageViewGateway {
  return {
    async increment(route) {
      const { error } = await client.rpc('record_page_view', { p_route: route });
      return { error: toDataApiError(error) };
    },

    async listFrom(startDate) {
      const { data, error } = await client.rpc('get_page_view_counts', {
        p_start_date: startDate,
      });
      return { data, error: toDataApiError(error) };
    },
  };
}

export function createPageViewRepository(gateway: PageViewGateway): PageViewRepository {
  return {
    async recordPageView(route) {
      try {
        const { error } = await gateway.increment(route);
        if (error) throw error;
      } catch (error) {
        throw mapError(error);
      }
    },

    async loadPageViewCounts(startDate) {
      if (!ISO_DATE_PATTERN.test(startDate)) {
        throw new PageViewRepositoryError('invalid_data', 'A data inicial das estatísticas é inválida.');
      }

      try {
        const { data, error } = await gateway.listFrom(startDate);
        if (error) throw error;
        if (!Array.isArray(data)) {
          throw new PageViewRepositoryError('invalid_data', 'As estatísticas recebidas são inválidas.');
        }
        return data.map(parseRow);
      } catch (error) {
        throw mapError(error);
      }
    },
  };
}

function createNotConfiguredRepository(): PageViewRepository {
  const fail = (): never => {
    throw new PageViewRepositoryError('not_configured', 'O cliente Neon não está configurado.');
  };

  return {
    async recordPageView() {
      fail();
    },
    async loadPageViewCounts() {
      return fail();
    },
  };
}

export const defaultPageViewRepository: PageViewRepository =
  import.meta.env.MODE === 'test' || defaultNeonClient === null
    ? createNotConfiguredRepository()
    : createPageViewRepository(createNeonPageViewGateway(defaultNeonClient));
