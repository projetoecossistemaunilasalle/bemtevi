import { createContext, useContext } from 'react';
import type { PublishedContentPayload, PublishedContentSnapshot } from './publishedContent';
import { PublishedContentValidationError } from './publishedContent';
import type { PublishedContentRepositoryError } from './publishedContentRepository';

export type PublishedContentSource = 'bundled' | 'database';
export type PublishedContentStatus = 'loading' | 'ready' | 'fallback';

export interface PublishedContentContextValue {
  content: PublishedContentPayload;
  snapshot: PublishedContentSnapshot | null;
  source: PublishedContentSource;
  status: PublishedContentStatus;
  loadError: PublishedContentRepositoryError | PublishedContentValidationError | null;
  refresh(): Promise<void>;
  publish(
    payload: PublishedContentPayload,
    publisherId: string,
    expectedRevision?: number | null,
  ): Promise<PublishedContentSnapshot>;
}

export const PublishedContentContext = createContext<PublishedContentContextValue | null>(null);

export function usePublishedContent(): PublishedContentContextValue {
  const ctx = useContext(PublishedContentContext);
  if (!ctx) {
    throw new Error('usePublishedContent must be used within a PublishedContentProvider');
  }
  return ctx;
}
