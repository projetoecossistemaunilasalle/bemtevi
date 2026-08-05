import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { normalizePageViewRoute } from '../../domain/analytics/pageViews';
import { defaultPageViewRepository, type PageViewRepository } from './pageViewRepository';

export function PageViewTracker({
  repository = defaultPageViewRepository,
  enabled = import.meta.env.PROD && import.meta.env.VITE_ENABLE_PAGE_ANALYTICS === 'true',
}: {
  repository?: PageViewRepository;
  enabled?: boolean;
}) {
  const { pathname } = useLocation();
  const lastRecordedPath = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (lastRecordedPath.current === pathname) return;
    lastRecordedPath.current = pathname;

    const route = normalizePageViewRoute(pathname);
    if (route === null) return;

    void repository.recordPageView(route).catch(() => undefined);
  }, [enabled, pathname, repository]);

  return null;
}
