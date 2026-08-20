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
  const refreshSequenceRef = useRef(0);

  const refreshLatest = useCallback(async (): Promise<PublishedContentSnapshot | null> => {
    const refreshSequence = ++refreshSequenceRef.current;
    try {
      const next = await repository.loadPublishedContent();
      if (!active.current || refreshSequence !== refreshSequenceRef.current) return null;
      if (next === null) {
        setStatus('ready');
        setLoadError(null);
        return null;
      }
      if (next && (snapshotRef.current === null || next.revision >= snapshotRef.current.revision)) {
        snapshotRef.current = next;
        setContent(next.payload);
        setSnapshot(next);
        setSource('database');
      }
      setStatus('ready');
      setLoadError(null);
      return snapshotRef.current;
    } catch (error) {
      if (!active.current || refreshSequence !== refreshSequenceRef.current) return null;
      setStatus('fallback');
      setLoadError(error as PublishedContentRepositoryError | PublishedContentValidationError);
      return null;
    }
  }, [repository]);

  const refresh = useCallback(async () => {
    await refreshLatest();
  }, [refreshLatest]);

  const publish = useCallback(
    async (
      payload: PublishedContentPayload,
      publisherId: string,
      expectedRevision = snapshotRef.current?.revision ?? null,
    ): Promise<PublishedContentSnapshot> => {
      const result = await repository.publishContent({
        payload,
        expectedRevision,
        publisherId,
      });
      if (!active.current) return result;
      refreshSequenceRef.current += 1;
      if (snapshotRef.current === null || result.revision >= snapshotRef.current.revision) {
        snapshotRef.current = result;
        setContent(result.payload);
        setSnapshot(result);
        setSource('database');
      }
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
    () => ({ content, snapshot, source, status, loadError, refresh, refreshLatest, publish }),
    [content, snapshot, source, status, loadError, refresh, refreshLatest, publish],
  );

  return <PublishedContentContext.Provider value={value}>{children}</PublishedContentContext.Provider>;
}
