/**
 * prepare_publish (doc 04 tool catalog; docs 14/15 guarded publication).
 * First phase of the two-phase protocol: it validates and pins the exact
 * current canonical draft but never publishes. Every check fails fast BEFORE
 * the prepare RPC: strict input bounds, a fresh digest-verified draft (the
 * volatile cache is never trusted for publication), a fresh verified live
 * revision, generation/revision/alignment agreement and the complete semantic
 * inspection. The preparation UUID and the 32-byte publish token are generated
 * client-side; only the token hash travels to the RPC. Returning the RAW token
 * from this tool is deliberate (doc 14) — publish_draft needs it later — and
 * it is the only allowed token exposure. No transport retry on the prepare
 * RPC; the shared limits classify the tool as a mutation (max one concurrent).
 */

import {
  inspectContent,
  sameContent,
  sha256Bytes,
  type ContentValidation,
  type Counter,
  type DraftHead,
  type PublicationPreparation,
} from '@bemtevi/content-core';
import type { ToolAnnotations } from '@modelcontextprotocol/server';
import type { ToolHandlerArgs } from '../server/dispatch';
import { connectionArgs, fetchVerifiedDraft, fetchVerifiedPublication, rpcOnce, type ToolRuntime } from './rpc';
import { headOf, isPositiveSafeInteger, isRecord, projectValidation, toolFail, toolOk } from './shared';
import type { ToolError, ToolOutcome } from './shared';

export const PREPARE_PUBLISH_ANNOTATIONS: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
};

export const PREPARE_PUBLISH_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    generation: { type: 'integer', minimum: 1, maximum: 9007199254740991 },
    expectedRevision: { type: 'integer', minimum: 1, maximum: 9007199254740991 },
  },
  required: ['generation', 'expectedRevision'],
  additionalProperties: false,
};

const PUBLISH_TOKEN_BYTES = 32;

/** Exact 43-character unpadded base64url encoding of 32 bytes (doc 15). */
export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index] as number);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/** Injected randomness for deterministic tests; production uses Web Crypto. */
export interface RandomSource {
  randomBytes(size: number): Uint8Array;
  uuid(): string;
}

export const cryptoRandomSource: RandomSource = {
  randomBytes: (size) => globalThis.crypto.getRandomValues(new Uint8Array(size)),
  uuid: () => globalThis.crypto.randomUUID(),
};

export interface PreparePublishOptions {
  random?: RandomSource;
}

export interface PreparePublishData {
  preparation: PublicationPreparation;
  publishToken: string;
  validation: ContentValidation;
}

/** Error object with only the doc-14 optional fields (never tokens/bodies). */
export interface PublicationError extends ToolError {
  currentHead?: DraftHead;
  currentRevision?: Counter;
}

/** validation_failed response: doc-14 error object plus the projected report. */
export interface PrepareValidationFailure {
  ok: false;
  error: PublicationError;
  validation: ContentValidation;
}

/** PT-BR guidance for in-band publication failures that carry no message. */
const PUBLICATION_MESSAGES: Record<string, string> = {
  preparation_invalid: 'A preparação de publicação é inválida ou não pertence a esta conexão. Prepare novamente.',
  preparation_expired: 'A preparação de publicação expirou. Prepare novamente.',
  preparation_stale: 'O rascunho mudou depois da preparação. Releia o contexto e prepare novamente.',
  revision_conflict: 'A publicação mudou desde a leitura. Releia o contexto antes de publicar.',
  published_base_unavailable: 'A publicação atual não está disponível. Tente novamente mais tarde.',
  stale_generation: 'O rascunho mudou desde a leitura. Atualize o contexto.',
  draft_unavailable: 'O rascunho compartilhado não está disponível.',
  invalid_capability: 'A conexão é inválida, expirou ou foi revogada.',
};

const GENERIC_FAILURE_MESSAGE = 'A operação falhou.';

/** Replaces only the generic fallback so real server messages are preserved. */
export function withPublicationMessage(error: ToolError): PublicationError {
  if (error.message !== GENERIC_FAILURE_MESSAGE) return error;
  const message = PUBLICATION_MESSAGES[error.code];
  return message ? { ...error, message } : error;
}

function parsePrepareInput(args: ToolHandlerArgs): ToolOutcome<{ generation: number; expectedRevision: number }> {
  if (
    !isRecord(args) ||
    Object.keys(args).length !== 2 ||
    !isPositiveSafeInteger(args['generation']) ||
    !isPositiveSafeInteger(args['expectedRevision'])
  ) {
    return toolFail('invalid_input', 'Informe generation e expectedRevision como inteiros positivos.');
  }
  return toolOk({ generation: args['generation'] as number, expectedRevision: args['expectedRevision'] as number });
}

export function isPublicationPreparation(value: unknown): value is PublicationPreparation {
  return (
    isRecord(value) &&
    typeof value['preparationId'] === 'string' &&
    value['draftId'] === 'current' &&
    isPositiveSafeInteger(value['generation']) &&
    isPositiveSafeInteger(value['expectedRevision']) &&
    typeof value['digest'] === 'string' &&
    typeof value['expiresAt'] === 'string'
  );
}

export type PreparePublishOutcome = ToolOutcome<PreparePublishData> | PrepareValidationFailure;

/**
 * Runs the fail-fast prepare pipeline (doc 04; doc 15 publication
 * transaction). The prepare RPC is reached only after every local check
 * passes, so an invalid or misaligned draft never creates a preparation.
 */
export function createPreparePublishHandler(rt: ToolRuntime, options: PreparePublishOptions = {}) {
  const random = options.random ?? cryptoRandomSource;
  return async (args: ToolHandlerArgs): Promise<PreparePublishOutcome> => {
    const input = parsePrepareInput(args);
    if (input.ok === false) return input;

    // Always fetch fresh: publication never trusts the volatile session cache.
    const draft = await fetchVerifiedDraft(rt);
    if (draft.ok === false) return draft;

    const live = await fetchVerifiedPublication(rt);
    if (live.ok === false) {
      if (live.error.code === 'unavailable') return toolFail('published_base_unavailable');
      return { ok: false, error: withPublicationMessage(live.error) };
    }

    if (input.data.generation !== draft.data.generation) {
      return {
        ok: false,
        error: {
          code: 'stale_generation',
          message: 'O rascunho mudou desde a leitura. Atualize o contexto.',
          currentHead: headOf(draft.data),
        },
      };
    }
    if (input.data.expectedRevision !== live.data.revision) {
      return {
        ok: false,
        error: {
          code: 'revision_conflict',
          message: 'A publicação mudou desde a leitura. Releia o contexto antes de publicar.',
          currentRevision: live.data.revision,
        },
      };
    }
    if (draft.data.baseRevision !== live.data.revision) {
      return toolFail(
        'preparation_stale',
        'O rascunho não está alinhado com a publicação atual. Releia o contexto e prepare novamente.',
      );
    }

    const inspection = inspectContent(draft.data.payload);
    const validation = projectValidation(inspection.validation);
    if (!inspection.validation.valid) {
      return {
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'O rascunho tem problemas de validação. Corrija os erros informados antes de publicar.',
        },
        validation,
      };
    }
    if (inspection.payload === null || !sameContent(inspection.payload, draft.data.payload)) {
      return {
        ok: false,
        error: {
          code: 'validation_failed',
          message:
            'A validação normalizou o conteúdo do rascunho. Salve as alterações normalizadas com uma edição comum (apply_operations) e prepare a publicação novamente; nunca publique um conteúdo substituto.',
        },
        validation,
      };
    }

    const preparationId = random.uuid();
    const tokenBytes = random.randomBytes(PUBLISH_TOKEN_BYTES);
    const publishToken = base64UrlEncode(tokenBytes);
    const tokenHash = await sha256Bytes(tokenBytes);

    const prepared = await rpcOnce(rt, 'agent_prepare_publish', {
      ...connectionArgs(rt),
      p_preparation_id: preparationId,
      p_generation: draft.data.generation,
      p_expected_revision: live.data.revision,
      p_digest: draft.data.digest,
      p_token_hash: tokenHash,
    });
    if (prepared.ok === false) return { ok: false, error: withPublicationMessage(prepared.error) };
    if (!isPublicationPreparation(prepared.data)) {
      return toolFail('unavailable', 'A resposta da preparação de publicação é inválida.');
    }
    return toolOk({
      preparation: prepared.data,
      publishToken,
      validation: projectValidation(inspection.validation),
    });
  };
}
