export const PAGE_VIEW_ROUTES = [
  '/',
  '/orientacao',
  '/apoio',
  '/contatos',
  '/educacao',
  '/educacao/:resourceId',
] as const;

export type PageViewRoute = (typeof PAGE_VIEW_ROUTES)[number];

export const pageViewRouteLabels: Record<PageViewRoute, string> = {
  '/': 'Início',
  '/orientacao': 'Orientação',
  '/apoio': 'Apoio imediato',
  '/contatos': 'Rede de apoio',
  '/educacao': 'Biblioteca',
  '/educacao/:resourceId': 'Detalhe de material',
};

const exactRoutes = new Set<PageViewRoute>(PAGE_VIEW_ROUTES.slice(0, -1));

export function normalizePageViewRoute(pathname: string): PageViewRoute | null {
  const normalizedPath = pathname === '/' ? pathname : pathname.replace(/\/+$/, '');

  if (exactRoutes.has(normalizedPath as PageViewRoute)) {
    return normalizedPath as PageViewRoute;
  }

  if (/^\/educacao\/[^/]+$/.test(normalizedPath)) {
    return '/educacao/:resourceId';
  }

  return null;
}
