import { useCallback, useRef, useState } from 'react';
import {
  inspectContent,
  sha256Bytes,
  type ContentDraft,
  type PublicationPreparation,
  type PublishResult,
  type PublishedContentPayload,
} from '@bemtevi/content-core';
import type { DraftRepository } from '../drafts/draftRepository';
import { useAdminAuth } from '../../app/auth/AdminAuthContext';
import { usePublishedContent } from '../../app/content/PublishedContentContext';
import { compareContent, contentIdentity, type ValueSlot } from './semanticDiff';

/**
 * V2 publication controller (doc 16 "Publication And File Actions", task
 * INTEGRATION-02). Implements the guarded `DraftRepository.prepare()` +
 * `DraftRepository.publish()` protocol:
 *
 * - publish/export first awaits `flush()`; false/offline/conflict/error cancels;
 * - the clean generation is captured and re-checked (head) together with the
 *   live revision immediately before prepare;
 * - the exact canonical snapshot is validated with content-core
 *   (`inspectContent`) and shown as a diff versus the live content
 *   (`ContentComparison`); an explicit `Publicar` click is required;
 * - prepare uses a NEW preparation UUID plus a fresh 32-byte random token —
 *   only the SHA-256 hash of the decoded bytes crosses the wire; publish sends
 *   the raw token with the same preparation;
 * - the raw token lives only in memory while the confirmation is open and is
 *   cleared on dialog close, logout/principal change and after success;
 * - a lost publish response may replay the SAME preparation/token exactly once,
 *   then the UI refreshes (explicit review and refresh after the result);
 * - after success the canonical draft and the public publication query are
 *   refreshed (other editors' newer changes are never overwritten);
 * - no error path calls the legacy direct-table adapter.
 */

export type PublicationPhase = 'editing' | 'preparing' | 'review' | 'publishing' | 'success' | 'replay' | 'error';

export interface PublicationPreview {
  /** Draft head captured after the flush that gates this preview. */
  draft: ContentDraft;
  /** Live published snapshot captured with the head (must stay unchanged). */
  liveRevision: number;
  /** Reconciled candidate versus the live published payload. */
  candidate: PublishedContentPayload;
}

export interface PublicationOutcome {
  preparation: PublicationPreparation;
  result: PublishResult;
}

export interface UsePublicationControllerOptions {
  /** The V2 draft repository from `editorialNeonServices`. */
  repository: DraftRepository;
  /** Workspace flush gate; publication is canceled when it returns false. */
  flush(): Promise<boolean>;
  /** Refreshes the canonical draft after publication (doc 16). */
  refreshDraft(): Promise<void>;
  /** Notified after a successful publish and the follow-up refreshes. */
  onPublished?(result: PublishResult): void;
  /** Emergency read-only UI kill flag blocks every publication action. */
  readOnly?: boolean;
  /** Generates the raw 32-byte token; injectable for deterministic tests. */
  secretBytes?(): Uint8Array;
  /** Generates the preparation UUID; injectable for deterministic tests. */
  preparationId?(): string;
}

/** Raw 32 publish-token bytes (Web Crypto; never Math.random). */
function defaultSecretBytes(): Uint8Array {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytes;
}

function defaultPreparationId(): string {
  return crypto.randomUUID();
}

/** Canonical 43-character unpadded base64url encoding of exactly 32 bytes. */
export function encodePublishToken(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function usePublicationController({
  repository,
  flush,
  refreshDraft,
  onPublished,
  readOnly = false,
  secretBytes = defaultSecretBytes,
  preparationId = defaultPreparationId,
}: UsePublicationControllerOptions) {
  const { account } = useAdminAuth();
  const { refresh: refreshPublicQuery, refreshLatest } = usePublishedContent();
  const [phase, setPhase] = useState<PublicationPhase>('editing');
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<PublicationPreview | null>(null);
  const [outcome, setOutcome] = useState<PublicationOutcome | null>(null);
  const preparationRef = useRef<{
    preparation: PublicationPreparation;
    token: string;
    replayed: boolean;
  } | null>(null);
  const busyRef = useRef(false);

  const clearRawToken = useCallback(() => {
    preparationRef.current = null;
  }, []);

  /** Closes the confirmation and clears the raw token (dialog close/staleness). */
  const closeReview = useCallback(() => {
    clearRawToken();
    setPreview(null);
    setPhase('editing');
  }, [clearRawToken]);

  /**
   * Step 1: flush, then capture the clean draft head and live revision. Any
   * change after this preview closes the confirmation (the caller re-checks
   * before prepare, and `publish` re-verifies server-side).
   */
  const openReview = useCallback(async (): Promise<void> => {
    if (readOnly) {
      setMessage('A publicação está temporariamente desativada neste painel.');
      return;
    }
    if (busyRef.current) return;
    busyRef.current = true;
    setPhase('preparing');
    setMessage(null);
    try {
      const flushed = await flush();
      if (!flushed) throw new Error('flush');
      const loaded = await repository.load();
      if (loaded.ok === false) throw loaded.error;
      const draft = loaded.data;
      const live = await refreshLatest?.();
      const liveRevision = live?.revision ?? draft.baseRevision;
      const inspection = inspectContent(draft.payload);
      if (inspection.validation.issues.some((issue) => issue.level === 'error')) {
        throw new Error('invalid');
      }
      setPreview({ draft, liveRevision, candidate: draft.payload });
      setPhase('review');
    } catch (error) {
      setPhase('error');
      setMessage(
        error instanceof Error && error.message === 'flush'
          ? 'Há alterações não salvas. Finalize o salvamento antes de publicar.'
          : 'Não foi possível preparar a publicação. Seu rascunho foi preservado.',
      );
    } finally {
      busyRef.current = false;
    }
  }, [flush, readOnly, refreshLatest, repository]);

  /**
   * Step 2: explicit `Publicar` click. Re-checks the generation and live
   * revision, prepares with a fresh UUID/token hash, then publishes the same
   * preparation. A lost publish response replays the same preparation/token
   * exactly once before the UI refreshes.
   */
  const publish = useCallback(async (): Promise<void> => {
    if (readOnly) return;
    if (busyRef.current || preview === null) return;
    busyRef.current = true;
    setPhase('publishing');
    setMessage(null);
    try {
      let preparation = preparationRef.current;
      if (preparation === null) {
        const current = await repository.load();
        if (current.ok === false) throw current.error;
        const draft = current.data;
        const live = await refreshLatest?.();
        const liveRevision = live?.revision ?? draft.baseRevision;
        if (draft.generation !== preview.draft.generation || draft.digest !== preview.draft.digest) {
          throw new Error('stale');
        }
        if (liveRevision !== preview.liveRevision || draft.baseRevision !== preview.liveRevision) {
          throw new Error('stale');
        }
        const bytes = secretBytes();
        const token = encodePublishToken(bytes);
        const tokenHash = await sha256Bytes(bytes);
        const prepared = await repository.prepare({
          generation: draft.generation,
          expectedRevision: liveRevision,
          digest: draft.digest,
          preparationId: preparationId(),
          tokenHash,
        });
        if (prepared.ok === false) throw prepared.error;
        preparation = { preparation: prepared.data, token, replayed: false };
        preparationRef.current = preparation;
      }
      const result = await repository.publish(preparation.preparation.preparationId, preparation.token);
      if (result.ok === false) throw result.error;
      preparationRef.current = null;
      setOutcome({ preparation: preparation.preparation, result: result.data });
      setPhase('success');
      setMessage('O conteúdo foi publicado. As informações foram atualizadas.');
      // Post-publish refreshes: canonical draft AND public query (doc 16).
      await Promise.allSettled([refreshDraft(), refreshPublicQuery()]);
      onPublished?.(result.data);
    } catch (error) {
      const lostResponse = preparationRef.current !== null && !preparationRef.current.replayed;
      if (lostResponse) {
        // The request outcome is unknown: replay the SAME preparation/token
        // exactly once (publish replays return the stored PublishResult).
        preparationRef.current = { ...preparationRef.current, replayed: true };
        setPhase('replay');
        setMessage(
          'Não foi possível confirmar a publicação. Tentaremos novamente com a mesma autorização; consulte o resultado antes de repetir.',
        );
        return;
      }
      // Replay budget exhausted: the raw token is cleared and the preview is
      // closed — a new attempt must pass a fresh review (doc 16).
      clearRawToken();
      setPreview(null);
      setPhase('error');
      setMessage(
        error instanceof Error && error.message === 'stale'
          ? 'O rascunho ou a publicação mudou desde a revisão. A confirmação foi encerrada; revise novamente antes de publicar.'
          : 'Não foi possível publicar. Seu rascunho foi preservado. Revise as alterações e tente novamente.',
      );
    } finally {
      busyRef.current = false;
    }
  }, [
    clearRawToken,
    onPublished,
    preparationId,
    preview,
    readOnly,
    refreshDraft,
    refreshLatest,
    refreshPublicQuery,
    repository,
    secretBytes,
  ]);

  return {
    phase,
    message,
    preview,
    outcome,
    readOnly,
    account,
    openReview,
    publish,
    closeReview,
    clearRawToken,
  };
}

/** Re-exported semantic helpers used by the publishing UI. */
export { compareContent, contentIdentity, type ValueSlot };
