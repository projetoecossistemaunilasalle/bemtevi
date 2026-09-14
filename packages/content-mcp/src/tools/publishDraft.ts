/**
 * publish_draft (doc 04 tool catalog; docs 14/15 guarded publication). Second
 * phase: accepts ONLY the preparation UUID plus the raw publish token — never
 * arbitrary publication content. Both are shape-validated client-side before
 * any RPC. After an ambiguous transport outcome (`unavailable`) the SAME
 * preparation/token pair is retried at most once per tool invocation (doc 04
 * "Cache, Limits And Retries"); a different candidate is never prepared
 * automatically. Wrong/expired/stale preparations and revision conflicts map
 * exactly to the frozen codes. Classified as a mutation by the shared limits
 * (max one concurrent; no other transport-level retry).
 */

import type { PublishResult } from '@bemtevi/content-core';
import type { ToolAnnotations } from '@modelcontextprotocol/server';
import type { ToolHandlerArgs } from '../server/dispatch';
import { connectionArgs, rpcOnce, type ToolRuntime } from './rpc';
import { isPositiveSafeInteger, isRecord, toolFail, toolOk } from './shared';
import type { ToolOutcome } from './shared';
import { withPublicationMessage } from './preparePublish';

export const PUBLISH_DRAFT_ANNOTATIONS: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: false,
};

export const PUBLISH_DRAFT_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    preparationId: { type: 'string', minLength: 36, maxLength: 36 },
    publishToken: { type: 'string', minLength: 43, maxLength: 43 },
  },
  required: ['preparationId', 'publishToken'],
  additionalProperties: false,
};

/** Canonical lowercase UUID syntax (doc 14). */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Exact 43-character unpadded base64url encoding of 32 bytes (doc 15). */
const PUBLISH_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function isPublishResult(value: unknown): value is PublishResult {
  return (
    isRecord(value) &&
    isPositiveSafeInteger(value['revision']) &&
    typeof value['publishedAt'] === 'string' &&
    isPositiveSafeInteger(value['draftGeneration']) &&
    typeof value['digest'] === 'string'
  );
}

function parsePublishInput(args: ToolHandlerArgs): ToolOutcome<{ preparationId: string; publishToken: string }> {
  if (
    !isRecord(args) ||
    Object.keys(args).length !== 2 ||
    typeof args['preparationId'] !== 'string' ||
    typeof args['publishToken'] !== 'string'
  ) {
    return toolFail(
      'invalid_input',
      'Informe apenas preparationId (UUID) e publishToken; nunca um conteúdo de publicação.',
    );
  }
  const preparationId = args['preparationId'];
  const publishToken = args['publishToken'];
  if (!UUID_PATTERN.test(preparationId) || !PUBLISH_TOKEN_PATTERN.test(publishToken)) {
    return toolFail(
      'invalid_input',
      'O preparationId deve ser um UUID e o publishToken, a credencial de 43 caracteres.',
    );
  }
  return toolOk({ preparationId, publishToken });
}

/**
 * Publishes the pinned preparation. The single replay reuses the exact same
 * arguments, so a lost response resolves to the stored PublishResult instead
 * of double-publishing (the database replays completed preparations).
 */
export function createPublishDraftHandler(rt: ToolRuntime) {
  return async (args: ToolHandlerArgs): Promise<ToolOutcome<PublishResult>> => {
    const input = parsePublishInput(args);
    if (input.ok === false) return input;
    const callArgs = {
      ...connectionArgs(rt),
      p_preparation_id: input.data.preparationId,
      p_publish_token: input.data.publishToken,
    };
    const first = await rpcOnce(rt, 'agent_publish_draft', callArgs);
    const outcome =
      first.ok === false && first.error.code === 'unavailable'
        ? await rpcOnce(rt, 'agent_publish_draft', callArgs)
        : first;
    if (outcome.ok === false) return { ok: false, error: withPublicationMessage(outcome.error) };
    if (!isPublishResult(outcome.data)) {
      return toolFail('unavailable', 'A resposta da publicação é inválida.');
    }
    return toolOk(outcome.data);
  };
}
