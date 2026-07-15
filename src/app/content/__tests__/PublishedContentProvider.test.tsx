import { useEffect } from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PUBLISHED_CONTENT_SCHEMA_VERSION,
  type PublishedContentPayload,
  type PublishedContentSnapshot,
} from '../publishedContent';
import { getBundledContent } from '../bundledContent';
import { PublishedContentRepositoryError } from '../publishedContentRepository';
import type { PublishedContentRepository } from '../publishedContentRepository';
import { usePublishedContent, type PublishedContentContextValue } from '../PublishedContentContext';
import { PublishedContentProvider } from '../PublishedContentProvider';

function makeSnapshot(payload: PublishedContentPayload, revision: number): PublishedContentSnapshot {
  return {
    schemaVersion: PUBLISHED_CONTENT_SCHEMA_VERSION,
    revision,
    payload,
    publishedAt: '2026-01-01T00:00:00.000Z',
    publishedBy: 'admin-id',
  };
}

function dbPayload(firstContactName: string): PublishedContentPayload {
  const base = getBundledContent();
  return {
    ...base,
    contacts: base.contacts.map((contact, index) => (index === 0 ? { ...contact, name: firstContactName } : contact)),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createFakeRepository(overrides: Partial<PublishedContentRepository> = {}): PublishedContentRepository {
  return {
    loadPublishedContent: vi.fn(),
    publishContent: vi.fn(),
    ...overrides,
  };
}

let latest: PublishedContentContextValue | null = null;

function Probe() {
  const ctx = usePublishedContent();
  useEffect(() => {
    latest = ctx;
  });
  return (
    <div>
      <span data-testid="source">{ctx.source}</span>
      <span data-testid="status">{ctx.status}</span>
      <span data-testid="revision">{ctx.snapshot?.revision ?? ''}</span>
      <span data-testid="contact">{ctx.content.contacts[0]?.name ?? ''}</span>
      <span data-testid="load-error">{ctx.loadError ? ctx.loadError.message : ''}</span>
    </div>
  );
}

beforeEach(() => {
  latest = null;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PublishedContentProvider', () => {
  it('starts with bundled content and replaces it with a valid database snapshot', async () => {
    const load = deferred<PublishedContentSnapshot | null>();
    const repository = createFakeRepository({ loadPublishedContent: vi.fn(() => load.promise) });
    const bundledFirst = getBundledContent().contacts[0]?.name ?? '';

    render(
      <PublishedContentProvider repository={repository}>
        <Probe />
      </PublishedContentProvider>,
    );

    expect(screen.getByTestId('source')).toHaveTextContent('bundled');
    expect(screen.getByTestId('status')).toHaveTextContent('loading');
    expect(screen.getByTestId('contact')).toHaveTextContent(bundledFirst);

    load.resolve(makeSnapshot(dbPayload('DB Contact'), 4));

    expect(await screen.findByTestId('source')).toHaveTextContent('database');
    expect(await screen.findByTestId('status')).toHaveTextContent('ready');
    expect(screen.getByTestId('revision')).toHaveTextContent('4');
    expect(screen.getByTestId('contact')).toHaveTextContent('DB Contact');
  });

  it('keeps bundled content when the table is empty', async () => {
    const repository = createFakeRepository({ loadPublishedContent: vi.fn().mockResolvedValue(null) });
    const bundledFirst = getBundledContent().contacts[0]?.name ?? '';

    render(
      <PublishedContentProvider repository={repository}>
        <Probe />
      </PublishedContentProvider>,
    );

    expect(await screen.findByTestId('source')).toHaveTextContent('bundled');
    expect(screen.getByTestId('status')).toHaveTextContent('ready');
    expect(screen.getByTestId('revision')).toHaveTextContent('');
    expect(screen.getByTestId('contact')).toHaveTextContent(bundledFirst);
  });

  it('keeps bundled content and exposes fallback status when loading fails', async () => {
    const error = new PublishedContentRepositoryError('unavailable', 'indisponível');
    const repository = createFakeRepository({ loadPublishedContent: vi.fn().mockRejectedValue(error) });
    const bundledFirst = getBundledContent().contacts[0]?.name ?? '';

    render(
      <PublishedContentProvider repository={repository}>
        <Probe />
      </PublishedContentProvider>,
    );

    expect(await screen.findByTestId('status')).toHaveTextContent('fallback');
    expect(screen.getByTestId('source')).toHaveTextContent('bundled');
    expect(screen.getByTestId('contact')).toHaveTextContent(bundledFirst);
    expect(screen.getByTestId('load-error')).toHaveTextContent('indisponível');
  });

  it('refreshes published content when the window regains focus', async () => {
    const repository = createFakeRepository({
      loadPublishedContent: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(makeSnapshot(dbPayload('Focus Contact'), 7)),
    });

    render(
      <PublishedContentProvider repository={repository}>
        <Probe />
      </PublishedContentProvider>,
    );

    expect(await screen.findByTestId('source')).toHaveTextContent('bundled');
    expect(repository.loadPublishedContent).toHaveBeenCalledTimes(1);

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(await screen.findByTestId('source')).toHaveTextContent('database');
    expect(screen.getByTestId('contact')).toHaveTextContent('Focus Contact');
    expect(screen.getByTestId('revision')).toHaveTextContent('7');
    expect(repository.loadPublishedContent).toHaveBeenCalledTimes(2);
  });

  it('publishes with the current revision and replaces content in memory', async () => {
    const nextPayload = dbPayload('Next Contact');
    const repository = createFakeRepository({
      loadPublishedContent: vi.fn().mockResolvedValue(makeSnapshot(dbPayload('DB Contact'), 4)),
      publishContent: vi.fn().mockResolvedValue(makeSnapshot(nextPayload, 5)),
    });

    render(
      <PublishedContentProvider repository={repository}>
        <Probe />
      </PublishedContentProvider>,
    );

    expect(await screen.findByTestId('source')).toHaveTextContent('database');

    await act(async () => {
      await latest!.publish(nextPayload, 'admin-id');
    });

    expect(repository.publishContent).toHaveBeenCalledWith({
      payload: nextPayload,
      expectedRevision: 4,
      publisherId: 'admin-id',
    });
    expect(screen.getByTestId('contact')).toHaveTextContent('Next Contact');
    expect(screen.getByTestId('source')).toHaveTextContent('database');
    expect(screen.getByTestId('status')).toHaveTextContent('ready');
    expect(screen.getByTestId('revision')).toHaveTextContent('5');
    expect(screen.getByTestId('load-error')).toHaveTextContent('');
  });

  it('does not replace content when publication fails', async () => {
    const error = new PublishedContentRepositoryError('conflict', 'conflito de revisão');
    const nextPayload = dbPayload('Next Contact');
    const repository = createFakeRepository({
      loadPublishedContent: vi.fn().mockResolvedValue(makeSnapshot(dbPayload('DB Contact'), 4)),
      publishContent: vi.fn().mockRejectedValue(error),
    });

    render(
      <PublishedContentProvider repository={repository}>
        <Probe />
      </PublishedContentProvider>,
    );

    expect(await screen.findByTestId('source')).toHaveTextContent('database');

    await expect(latest!.publish(nextPayload, 'admin-id')).rejects.toThrow('conflito de revisão');

    expect(repository.publishContent).toHaveBeenCalledWith({
      payload: nextPayload,
      expectedRevision: 4,
      publisherId: 'admin-id',
    });
    expect(screen.getByTestId('contact')).toHaveTextContent('DB Contact');
    expect(screen.getByTestId('source')).toHaveTextContent('database');
    expect(screen.getByTestId('status')).toHaveTextContent('ready');
    expect(screen.getByTestId('revision')).toHaveTextContent('4');
  });
});
