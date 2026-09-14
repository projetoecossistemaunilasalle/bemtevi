/**
 * RPC access for tool handlers (doc 04/15). Handlers may only call the fixed
 * client allowlist with the leading connection pair `p_connection_id`/`p_token`
 * (the credential travels only as POST body parameters and is never logged).
 * Read calls are retried once after 500 ms for transient transport failures
 * (`unavailable`); mutation-path calls have no transport-level automatic retry.
 * Full drafts are digest-verified (content-core `verifySnapshot`) before use.
 */

import { verifySnapshot, type ContentDraft, type DraftHead } from '@bemtevi/content-core';
import type { AgentRpcName, DataApiClient } from '../client/dataApiClient';
import { READ_RETRY_DELAY_MS, type DelayFn } from '../session/limits';
import { type BaseSnapshot, type BaseSnapshotCache } from '../session/baseSnapshotCache';
import {
  isNonNegativeSafeInteger,
  isPositiveSafeInteger,
  isRecord,
  toolFail,
  toolOk,
  unwrapRpcOutcome,
} from './shared';
import type { ToolOutcome } from './shared';

export interface ToolRuntime {
  client: DataApiClient;
  connectionId: string;
  agentToken: string;
  cache: BaseSnapshotCache;
  delay: DelayFn;
}

export function connectionArgs(rt: ToolRuntime): Record<string, unknown> {
  return { p_connection_id: rt.connectionId, p_token: rt.agentToken };
}

/**
 * Verified cached base for the requested generation (reads and mutations).
 * Missing, expired or unverified entries are a safe `rebase_required` failure:
 * a page or mutation is never silently upgraded to a newer generation and a
 * mutation is never applied blindly to unknown content.
 */
export function verifiedBaseOrRebase(rt: ToolRuntime, generation: number): ToolOutcome<BaseSnapshot> {
  const snapshot = rt.cache.get(rt.connectionId, generation);
  if (snapshot === null || !snapshot.verified) {
    return toolFail('rebase_required', 'A base em cache não está disponível. Chame get_editor_context novamente.');
  }
  return toolOk(snapshot);
}

/** One RPC call without retry (mutation paths and their internal fetches). */
export async function rpcOnce(
  rt: ToolRuntime,
  name: AgentRpcName,
  args: Record<string, unknown>,
): Promise<ToolOutcome<unknown>> {
  return unwrapRpcOutcome(await rt.client.rpc(name, args));
}

/** Read RPC: retried once after 500 ms on transient transport failures. */
export async function rpcRead(
  rt: ToolRuntime,
  name: AgentRpcName,
  args: Record<string, unknown>,
): Promise<ToolOutcome<unknown>> {
  const first = unwrapRpcOutcome(await rt.client.rpc(name, args));
  if (first.ok === false && first.error.code === 'unavailable') {
    await rt.delay(READ_RETRY_DELAY_MS);
    return unwrapRpcOutcome(await rt.client.rpc(name, args));
  }
  return first;
}

export function isContentDraft(value: unknown): value is ContentDraft {
  return (
    isRecord(value) &&
    value.id === 'current' &&
    value.status === 'active' &&
    typeof value.schemaVersion === 'string' &&
    isNonNegativeSafeInteger(value.baseRevision) &&
    isPositiveSafeInteger(value.generation) &&
    typeof value.digest === 'string' &&
    typeof value.updatedAt === 'string' &&
    isRecord(value.lastActor) &&
    isRecord(value.payload) &&
    typeof value.canonicalPayload === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.createdBy === 'string'
  );
}

export interface EditorContextResponse {
  head: DraftHead;
  publishedRevision: number;
  principalUserId: string;
  connectionId: string;
  expiresAt: string;
}

export function isEditorContextResponse(value: unknown): value is EditorContextResponse {
  if (!isRecord(value)) return false;
  const head = value.head;
  return (
    isRecord(head) &&
    head.id === 'current' &&
    typeof head.schemaVersion === 'string' &&
    isNonNegativeSafeInteger(head.baseRevision) &&
    isPositiveSafeInteger(head.generation) &&
    typeof head.digest === 'string' &&
    typeof head.updatedAt === 'string' &&
    isRecord(head.lastActor) &&
    isPositiveSafeInteger(value.publishedRevision) &&
    typeof value.principalUserId === 'string' &&
    typeof value.connectionId === 'string' &&
    typeof value.expiresAt === 'string'
  );
}

/** Fetches the full draft and verifies its digest before any use (doc 04). */
export async function fetchVerifiedDraft(rt: ToolRuntime): Promise<ToolOutcome<ContentDraft>> {
  const outcome = await rpcOnce(rt, 'agent_get_draft', connectionArgs(rt));
  if (outcome.ok === false) return outcome;
  if (!isContentDraft(outcome.data)) {
    return toolFail('unavailable', 'A resposta do rascunho compartilhado é inválida.');
  }
  const draft = outcome.data;
  const verified = await verifySnapshot(draft.payload, draft.canonicalPayload, draft.digest);
  if (!verified) return toolFail('unavailable', 'A verificação do rascunho compartilhado falhou.');
  return toolOk(draft);
}

/** Verified publication snapshot fetch (doc 04 get_diff / doc 15). */
export interface PublicationSnapshot {
  revision: number;
  payload: ContentDraft['payload'];
  canonicalPayload: string;
  digest: string;
}

export function isPublicationSnapshot(value: unknown): value is PublicationSnapshot {
  return (
    isRecord(value) &&
    isPositiveSafeInteger(value.revision) &&
    isRecord(value.payload) &&
    typeof value.canonicalPayload === 'string' &&
    typeof value.digest === 'string'
  );
}

export async function fetchVerifiedPublication(rt: ToolRuntime): Promise<ToolOutcome<PublicationSnapshot>> {
  const outcome = await rpcRead(rt, 'agent_get_published_content', connectionArgs(rt));
  if (outcome.ok === false) return outcome;
  if (!isPublicationSnapshot(outcome.data)) {
    return toolFail('unavailable', 'A resposta da publicação é inválida.');
  }
  const snapshot = outcome.data;
  const verified = await verifySnapshot(snapshot.payload, snapshot.canonicalPayload, snapshot.digest);
  if (!verified) return toolFail('unavailable', 'A verificação da publicação falhou.');
  return toolOk(snapshot);
}
