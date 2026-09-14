import type {
  ContentDraft,
  Counter,
  Digest,
  DraftHead,
  DraftMutationInput,
  DraftMutationResult,
  EditorialError,
  EditorialOperation,
  PrepareInput,
  PublicationPreparation,
  PublishResult,
  PublishedContentPayload,
  Result,
  Scope,
} from '@bemtevi/content-core';

/**
 * Shared, React-free draft contracts for the dashboard drafts lane
 * (dossier docs 14/16). The canonical domain types live in
 * `@bemtevi/content-core`; this module re-exports the ones the draft
 * repository/consumers use and adds only dashboard-local shapes that the
 * dossier defines literally (doc 16 `SaveState.base`).
 */

export type {
  ContentDraft,
  Counter,
  Digest,
  DraftHead,
  DraftMutationInput,
  DraftMutationResult,
  EditorialError,
  EditorialOperation,
  PrepareInput,
  PublicationPreparation,
  PublishResult,
  PublishedContentPayload,
  Result,
  Scope,
};

/**
 * Acknowledged base used by the save state machine: the verified server head
 * plus the full payload that backs it (doc 16: `base: DraftHead & { payload }`).
 */
export interface DraftBaseSnapshot extends DraftHead {
  payload: PublishedContentPayload;
}
