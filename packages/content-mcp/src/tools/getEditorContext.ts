/**
 * get_editor_context (doc 04). Fetches the editor context then the full draft;
 * if the context head generation differs from the fetched draft generation the
 * pair is repeated once (second race -> retry_required). The draft is verified
 * (canonical digest + semantic equality) BEFORE caching. Fetching the full
 * draft populates the three-entry base snapshot cache.
 */

import { verifySnapshot } from '@bemtevi/content-core';
import { SERVER_INSTRUCTIONS } from '../server/instructions';
import { connectionArgs, isContentDraft, isEditorContextResponse, rpcRead, type ToolRuntime } from './rpc';
import { headOf, scopeCounts, toolFail, toolOk } from './shared';
import type { ToolOutcome } from './shared';

interface ContextPair {
  context: unknown;
  draft: unknown;
}

async function fetchPair(rt: ToolRuntime): Promise<ToolOutcome<ContextPair>> {
  const context = await rpcRead(rt, 'agent_get_editor_context', connectionArgs(rt));
  if (context.ok === false) return context;
  const draft = await rpcRead(rt, 'agent_get_draft', connectionArgs(rt));
  if (draft.ok === false) return draft;
  return toolOk({ context: context.data, draft: draft.data });
}

export function createGetEditorContextHandler(rt: ToolRuntime) {
  return async (): Promise<ToolOutcome<Record<string, unknown>>> => {
    const first = await fetchPair(rt);
    if (first.ok === false) return first;
    let context: unknown = first.data.context;
    let draft: unknown = first.data.draft;
    if (!isEditorContextResponse(context) || !isContentDraft(draft)) {
      return toolFail('unavailable', 'A resposta do contexto editorial é inválida.');
    }
    if (context.head.generation !== draft.generation) {
      const second = await fetchPair(rt);
      if (second.ok === false) return second;
      context = second.data.context;
      draft = second.data.draft;
      if (!isEditorContextResponse(context) || !isContentDraft(draft)) {
        return toolFail('unavailable', 'A resposta do contexto editorial é inválida.');
      }
      if (context.head.generation !== draft.generation) {
        return toolFail('retry_required', 'O rascunho mudou duas vezes seguidas. Releia o contexto.');
      }
    }
    const verified = await verifySnapshot(draft.payload, draft.canonicalPayload, draft.digest);
    if (!verified) return toolFail('unavailable', 'A verificação do rascunho compartilhado falhou.');
    rt.cache.insert({
      connectionId: rt.connectionId,
      generation: draft.generation,
      head: headOf(draft),
      payload: draft.payload,
      canonicalPayload: draft.canonicalPayload,
      verified: true,
    });
    return toolOk({
      head: headOf(draft),
      publishedRevision: context.publishedRevision,
      connectionId: context.connectionId,
      principalUserId: context.principalUserId,
      expiresAt: context.expiresAt,
      instructions: SERVER_INSTRUCTIONS,
      counts: scopeCounts(draft.payload),
    });
  };
}
