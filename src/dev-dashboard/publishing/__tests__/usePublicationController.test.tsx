import { act, renderHook } from '@testing-library/react';
import { sha256Text, type ContentDraft, type PublishedContentPayload, type Result } from '@bemtevi/content-core';
import { describe, expect, it, vi } from 'vitest';
import type { DraftRepository } from '../../drafts/draftRepository';
import { AdminAuthContext, type AdminAuthContextValue } from '../../../app/auth/AdminAuthContext';
import {
  PublishedContentContext,
  type PublishedContentContextValue,
} from '../../../app/content/PublishedContentContext';
import { encodePublishToken, usePublicationController } from '../usePublicationController';

/**
 * V2 publication protocol tests (doc 16 "Publication And File Actions"):
 * flush gate, exact clean generation/live revision re-check before prepare,
 * fresh UUID/token (hash over the decoded 32 bytes), single explicit
 * `Publicar`, replay-once on a lost response, post-publish refreshes, and the
 * read-only kill flag. No error path may touch the legacy direct adapter.
 */

const PRINCIPAL = 'admin-id';
let preparationSeq = 0;
function resetPreparationSeq(): void {
  preparationSeq = 0;
}

function draftOf(payload: PublishedContentPayload, generation: number, baseRevision: number): ContentDraft {
  return {
    id: 'current',
    schemaVersion: '1.0.0',
    baseRevision,
    generation,
    digest: 'a'.repeat(64),
    updatedAt: '2026-09-01T00:00:00Z',
    lastActor: { kind: 'admin', principalUserId: PRINCIPAL, connectionId: null },
    status: 'active',
    payload,
    canonicalPayload: JSON.stringify(payload),
    createdAt: '2026-01-01T00:00:00Z',
    createdBy: PRINCIPAL,
  };
}

function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}
function err<T = never>(code: string): Result<T> {
  return { ok: false, error: { code } as never };
}

const payload: PublishedContentPayload = {
  flows: [],
  educationMaterials: [],
  educationGroups: [],
  contacts: [],
  locations: [],
  defaultGroupOrder: 0,
};

function fakeRepository() {
  return {
    load: vi.fn<(input?: undefined) => Promise<Result<ContentDraft>>>(),
    head: vi.fn(),
    mutate: vi.fn(),
    prepare: vi.fn(),
    publish: vi.fn(),
  } as unknown as DraftRepository &
    Record<'load' | 'head' | 'mutate' | 'prepare' | 'publish', ReturnType<typeof vi.fn>>;
}

const authValue: AdminAuthContextValue = {
  status: 'authenticated',
  account: { id: PRINCIPAL, email: 'admin@bemtevi.test' },
  login: vi.fn(),
  logout: vi.fn(),
  refresh: vi.fn(),
};

function publishedValue(overrides: Partial<PublishedContentContextValue> = {}): PublishedContentContextValue {
  return {
    content: payload,
    snapshot: null,
    source: 'database',
    status: 'ready',
    loadError: null,
    refresh: vi.fn(),
    refreshLatest: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

async function renderController(options: {
  repository: ReturnType<typeof fakeRepository>;
  readOnly?: boolean;
  flush?: () => Promise<boolean>;
  published?: Partial<PublishedContentContextValue>;
}) {
  const flush = options.flush ?? vi.fn().mockResolvedValue(true);
  const refreshDraft = vi.fn().mockResolvedValue(undefined);
  const onPublished = vi.fn();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AdminAuthContext.Provider value={authValue}>
      <PublishedContentContext.Provider value={publishedValue(options.published)}>
        {children}
      </PublishedContentContext.Provider>
    </AdminAuthContext.Provider>
  );
  const hook = renderHook(
    () =>
      usePublicationController({
        repository: options.repository,
        flush,
        refreshDraft,
        onPublished,
        readOnly: options.readOnly ?? false,
        secretBytes: () => new Uint8Array(32).fill(7),
        preparationId: () => `prep-uuid-${(preparationSeq += 1)}`,
      }),
    { wrapper },
  );
  return { ...hook, flush, refreshDraft, onPublished };
}

describe('usePublicationController (V2 prepare/publish protocol)', () => {
  it('computes the canonical 43-char base64url publish token', () => {
    const token = encodePublishToken(new Uint8Array(32).fill(1));
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(token).not.toContain('=');
  });

  it('opens the review only after a successful flush and captures head + live revision', async () => {
    const repository = fakeRepository();
    const draft = draftOf(payload, 6, 4);
    repository.load.mockResolvedValue(ok(draft));
    const refreshLatest = vi.fn().mockResolvedValue({ revision: 4, payload });
    const { result } = await renderController({ repository, published: { refreshLatest } });

    await act(async () => {
      await result.current.openReview();
    });

    expect(result.current.phase).toBe('review');
    expect(result.current.preview?.draft.generation).toBe(6);
    expect(result.current.preview?.liveRevision).toBe(4);
  });

  it('cancels the review when the flush fails (dirty/offline)', async () => {
    const repository = fakeRepository();
    repository.load.mockResolvedValue(ok(draftOf(payload, 6, 4)));
    const { result } = await renderController({ repository, flush: vi.fn().mockResolvedValue(false) });

    await act(async () => {
      await result.current.openReview();
    });

    expect(result.current.phase).toBe('error');
    expect(repository.load).not.toHaveBeenCalled();
    expect(result.current.preview).toBeNull();
  });

  it('cancels the review when the draft has validation errors', async () => {
    const repository = fakeRepository();
    const invalid = { ...payload, contacts: [{ bad: true } as never] };
    repository.load.mockResolvedValue(ok(draftOf(invalid, 6, 4)));
    const { result } = await renderController({ repository });

    await act(async () => {
      await result.current.openReview();
    });

    expect(result.current.phase).toBe('error');
    expect(result.current.preview).toBeNull();
  });

  it('refuses every action under the read-only kill flag', async () => {
    const repository = fakeRepository();
    repository.load.mockResolvedValue(ok(draftOf(payload, 6, 4)));
    const { result } = await renderController({ repository, readOnly: true });

    await act(async () => {
      await result.current.openReview();
    });

    expect(result.current.phase).toBe('editing');
    expect(repository.load).not.toHaveBeenCalled();
  });

  it('prepares with a fresh UUID and the sha256 of the decoded token bytes, then publishes the same preparation', async () => {
    resetPreparationSeq();
    const repository = fakeRepository();
    const draft = draftOf(payload, 6, 4);
    repository.load.mockResolvedValue(ok(draft));
    const preparation = {
      preparationId: 'prep-uuid-1',
      draftId: 'current',
      generation: 6,
      expectedRevision: 4,
      digest: draft.digest,
      expiresAt: '2026-09-01T00:10:00Z',
    };
    repository.prepare.mockResolvedValue(ok(preparation));
    repository.publish.mockResolvedValue(
      ok({ revision: 5, publishedAt: '2026-09-01T00:01:00Z', draftGeneration: 7, digest: draft.digest }),
    );
    const refreshLatest = vi.fn().mockResolvedValue({ revision: 4, payload });
    const refresh = vi.fn();
    const { result, refreshDraft, onPublished } = await renderController({
      repository,
      published: { refreshLatest, refresh },
    });

    await act(async () => {
      await result.current.openReview();
    });
    await act(async () => {
      await result.current.publish();
    });

    expect(result.current.phase).toBe('success');
    const [prepareArgs] = repository.prepare.mock.calls[0] as unknown as [
      { preparationId: string; generation: number; expectedRevision: number; digest: string; tokenHash: string },
    ];
    expect(prepareArgs.preparationId).toBe('prep-uuid-1');
    expect(prepareArgs.generation).toBe(6);
    expect(prepareArgs.expectedRevision).toBe(4);
    expect(prepareArgs.digest).toBe(draft.digest);
    // Hash is over the decoded 32 bytes, never the token text.
    expect(prepareArgs.tokenHash).toBe(await sha256Text(String.fromCharCode(...new Uint8Array(32).fill(7))));
    expect(prepareArgs.tokenHash).not.toHaveLength(43);
    expect(repository.publish).toHaveBeenCalledWith('prep-uuid-1', encodePublishToken(new Uint8Array(32).fill(7)));
    // Post-publish refreshes: canonical draft AND the public query.
    expect(refreshDraft).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(onPublished).toHaveBeenCalledTimes(1);
  });

  it('closes the confirmation and refuses to prepare when the generation moved after the review', async () => {
    const repository = fakeRepository();
    repository.load.mockResolvedValueOnce(ok(draftOf(payload, 6, 4))).mockResolvedValueOnce(ok(draftOf(payload, 7, 4)));
    const { result } = await renderController({ repository });

    await act(async () => {
      await result.current.openReview();
    });
    await act(async () => {
      await result.current.publish();
    });

    expect(result.current.phase).toBe('error');
    expect(result.current.message).toContain('mudou desde a revisão');
    expect(repository.prepare).not.toHaveBeenCalled();
  });

  it('closes the confirmation when the live revision moved after the review', async () => {
    const repository = fakeRepository();
    repository.load.mockResolvedValue(ok(draftOf(payload, 6, 4)));
    const refreshLatest = vi
      .fn()
      .mockResolvedValueOnce({ revision: 4, payload })
      .mockResolvedValueOnce({ revision: 5, payload });
    const { result } = await renderController({ repository, published: { refreshLatest } });

    await act(async () => {
      await result.current.openReview();
    });
    await act(async () => {
      await result.current.publish();
    });

    expect(result.current.phase).toBe('error');
    expect(repository.prepare).not.toHaveBeenCalled();
  });

  it('replays the same preparation/token exactly once after a lost publish response, then stops', async () => {
    resetPreparationSeq();
    const repository = fakeRepository();
    const draft = draftOf(payload, 6, 4);
    repository.load.mockResolvedValue(ok(draft));
    const preparation = {
      preparationId: 'prep-uuid-1',
      draftId: 'current',
      generation: 6,
      expectedRevision: 4,
      digest: draft.digest,
      expiresAt: '2026-09-01T00:10:00Z',
    };
    repository.prepare.mockResolvedValue(ok(preparation));
    repository.publish.mockRejectedValueOnce(new Error('network lost'));
    const { result } = await renderController({ repository });

    await act(async () => {
      await result.current.openReview();
    });
    await act(async () => {
      await result.current.publish();
    });

    expect(result.current.phase).toBe('replay');
    expect(repository.prepare).toHaveBeenCalledTimes(1);
    // Second attempt: same preparation and token, no new prepare.
    repository.publish.mockResolvedValueOnce(
      ok({ revision: 5, publishedAt: '2026-09-01T00:02:00Z', draftGeneration: 7, digest: draft.digest }),
    );
    await act(async () => {
      await result.current.publish();
    });
    expect(repository.prepare).toHaveBeenCalledTimes(1);
    expect(repository.publish).toHaveBeenNthCalledWith(
      2,
      'prep-uuid-1',
      encodePublishToken(new Uint8Array(32).fill(7)),
    );
    expect(result.current.phase).toBe('success');

    // After the replay succeeded, the next attempt is a NEW cycle: a fresh
    // review would be required in the UI; publish() without a fresh preview
    // from the same cycle still uses the last captured head, so it prepares
    // a NEW preparation (never replays the old token).
    repository.prepare.mockResolvedValueOnce(ok({ ...preparation, preparationId: 'prep-uuid-2' }));
    repository.publish.mockRejectedValueOnce(new Error('down'));
    await act(async () => {
      await result.current.publish();
    });
    expect(repository.prepare).toHaveBeenCalledTimes(2);
    const [secondPrepareArgs] = repository.prepare.mock.calls[1] as unknown as [{ preparationId: string }];
    expect(secondPrepareArgs.preparationId).toBe('prep-uuid-2');
    expect(result.current.phase).toBe('replay');
  });

  it('maps preparation_invalid to an error without any legacy fallback', async () => {
    const repository = fakeRepository();
    const draft = draftOf(payload, 6, 4);
    repository.load.mockResolvedValue(ok(draft));
    repository.prepare.mockResolvedValue(err('preparation_invalid'));
    const { result } = await renderController({ repository });

    await act(async () => {
      await result.current.openReview();
    });
    await act(async () => {
      await result.current.publish();
    });

    expect(result.current.phase).toBe('error');
    expect(repository.publish).not.toHaveBeenCalled();
  });

  it('clears the raw token when the review is closed', async () => {
    resetPreparationSeq();
    const repository = fakeRepository();
    const draft = draftOf(payload, 6, 4);
    repository.load.mockResolvedValue(ok(draft));
    repository.prepare.mockResolvedValue(
      ok({
        preparationId: 'prep-uuid-1',
        draftId: 'current',
        generation: 6,
        expectedRevision: 4,
        digest: draft.digest,
        expiresAt: '2026-09-01T00:10:00Z',
      }),
    );
    repository.publish.mockRejectedValueOnce(new Error('lost'));
    const { result } = await renderController({ repository });

    await act(async () => {
      await result.current.openReview();
    });
    await act(async () => {
      await result.current.publish();
    });
    expect(result.current.phase).toBe('replay');

    act(() => {
      result.current.closeReview();
    });
    expect(result.current.phase).toBe('editing');
    expect(result.current.preview).toBeNull();
    // A later publish re-prepares (raw token was cleared by the close).
    repository.load.mockResolvedValue(ok(draft));
    await act(async () => {
      await result.current.openReview();
    });
    await act(async () => {
      await result.current.publish();
    });
    expect(repository.prepare).toHaveBeenCalledTimes(2);
  });
});
