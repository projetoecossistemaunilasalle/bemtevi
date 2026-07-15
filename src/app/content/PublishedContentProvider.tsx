import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  type PublishedContentPayload,
  type PublishedContentSnapshot,
  PublishedContentValidationError,
} from './publishedContent';
import { getBundledContent } from './bundledContent';
import {
  defaultPublishedContentRepository,
  type PublishedContentRepository,
  type PublishedContentRepositoryError,
} from './publishedContentRepository';
import { PublishedContentContext, type PublishedContentContextValue } from './PublishedContentContext';

type LoadError = PublishedContentRepositoryError | PublishedContentValidationError | null;

export interface PublishedContentProviderProps {
  children: ReactNode;
  repository?: PublishedContentRepository;
}

export function PublishedContentProvider({
  children,
  repository = defaultPublishedContentRepository,
}: PublishedContentProviderProps) {
  const [content, setContent] = useState<PublishedContentPayload>(() => getBundledContent());
  const [snapshot, setSnapshot] = useState<PublishedContentSnapshot | null>(null);
  const [source, setSource] = useState<'bundled' | 'database'>('bundled');
  const [status, setStatus] = useState<'loading' | 'ready' | 'fallback'>('loading');
  const [loadError, setLoadError] = useState<LoadError>(null);

  const active = useRef(true);
  const snapshotRef = useRef<PublishedContentSnapshot | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await repository.loadPublishedContent();
      if (!active.current) return;
      if (next) {
        snapshotRef.current = next;
        setContent(next.payload);
        setSnapshot(next);
        setSource('database');
      }
      setStatus('ready');
      setLoadError(null);
    } catch (error) {
      if (!active.current) return;
      setStatus('fallback');
      setLoadError(error as PublishedContentRepositoryError | PublishedContentValidationError);
    }
  }, [repository]);

  const publish = useCallback(
    async (payload: PublishedContentPayload, publisherId: string): Promise<PublishedContentSnapshot> => {
      const result = await repository.publishContent({
        payload,
        expectedRevision: snapshotRef.current?.revision ?? null,
        publisherId,
      });
      if (!active.current) return result;
      snapshotRef.current = result;
      setContent(result.payload);
      setSnapshot(result);
      setSource('database');
      setStatus('ready');
      setLoadError(null);
      return result;
    },
    [repository],
  );

  useEffect(() => {
    active.current = true;
    // Load published content on mount; the actual setState happens after the async refresh resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const handleFocus = () => {
      void refresh();
    };
    window.addEventListener('focus', handleFocus);
    return () => {
      active.current = false;
      window.removeEventListener('focus', handleFocus);
    };
  }, [refresh]);

  const value = useMemo<PublishedContentContextValue>(
    () => ({ content, snapshot, source, status, loadError, refresh, publish }),
    [content, snapshot, source, status, loadError, refresh, publish],
  );

  return <PublishedContentContext.Provider value={value}>{children}</PublishedContentContext.Provider>;
}
