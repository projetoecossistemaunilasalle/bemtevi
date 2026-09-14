import type {
  ContentDraft,
  Counter,
  DraftHead,
  DraftMutationResult,
  EditorialOperation,
  Result,
  AgentConnection,
  EditExport,
  PublicationPreparation,
  PublishResult,
  PublishedContentPayload,
  Scope,
} from '@bemtevi/content-core';

/**
 * TS types for the exact RPC catalog of dossier 15 (Frozen Database Contract).
 * Every RPC RETURNS jsonb carrying a `Result<T>` from doc 14; agent rows expand
 * the leading connection pair `G = p_connection_id uuid, p_token text`.
 * RPC parameters are snake_case named arguments; wire data is camelCase.
 */

export type RpcResult<T> = Result<T>;

/** Leading agent connection pair (`G`). */
export interface AgentG {
  p_connection_id: string;
  p_token: string;
}

// --- Admin: draft load / head / mutate (DB-01) -------------------------------

export type GetContentDraftArgs = Record<string, never>;

export type GetContentDraftHeadArgs = Record<string, never>;

export interface ApplyContentDraftOperationsArgs {
  p_expected_generation: Counter;
  p_operations: EditorialOperation[];
}

// --- Admin/agent: capability connections (DB-02) -----------------------------

export interface CreateContentAgentConnectionArgs {
  p_connection_id: string;
  p_token_hash: string;
  p_label: string;
}

export type ListContentAgentConnectionsArgs = Record<string, never>;

export interface RevokeContentAgentConnectionArgs {
  p_connection_id: string;
}

// --- Admin/agent: durable edit exports (DB-02) -------------------------------

export interface CreateContentEditExportArgs {
  p_export_id: string;
  p_expected_generation: Counter;
  p_selection: { scope: Scope; ids: string[] } | null;
}

export interface GetContentEditExportArgs {
  p_export_id: string;
}

// --- Admin/agent: guarded two-phase publication (DB-03) ----------------------

export interface PrepareContentDraftPublishArgs {
  p_preparation_id: string;
  p_generation: Counter;
  p_expected_revision: Counter;
  p_digest: string;
  p_token_hash: string;
}

export interface PublishContentDraftArgs {
  p_preparation_id: string;
  p_publish_token: string;
}

// --- Agent gateway (anonymous-only wrappers) ---------------------------------

export type AgentGetEditorContextArgs = AgentG;

export interface EditorContext {
  head: DraftHead;
  publishedRevision: Counter;
  principalUserId: string;
  connectionId: string;
  expiresAt: string;
}

export interface AgentGetPublishedContentData {
  revision: Counter;
  payload: PublishedContentPayload;
  canonicalPayload: string;
  digest: string;
}

// --- Wire return types (success `data` payloads) -----------------------------

export type TGetContentDraft = ContentDraft;
export type TGetContentDraftHead = DraftHead;
export type TApplyContentDraftOperations = DraftMutationResult;
export type TCreateContentAgentConnection = AgentConnection;
export type TListContentAgentConnections = AgentConnection[];
export type TRevokeContentAgentConnection = AgentConnection;
export type TCreateContentEditExport = EditExport;
export type TGetContentEditExport = EditExport;
export type TPrepareContentDraftPublish = PublicationPreparation;
export type TPublishContentDraft = PublishResult;
export type TAgentGetEditorContext = EditorContext;
export type TAgentGetDraft = ContentDraft;
export type TAgentGetPublishedContent = AgentGetPublishedContentData;
export type TAgentApplyOperations = DraftMutationResult;
export type TAgentPreparePublish = PublicationPreparation;
export type TAgentPublishDraft = PublishResult;
