/**
 * Shared mutation pipeline for apply_operations and set_material_image
 * (docs 03/04). The pipeline REQUIRES the exact verified cached base for
 * `expectedGeneration` (missing -> rebase_required), applies operations locally
 * with content-core, reports the complete semantic inspection (projected), and
 * performs at most ONE automatic merge-and-CAS retry after a stale generation:
 * fetch the verified remote draft, reconcile semantically, encode the delta and
 * CAS against the remote generation. Unresolved conflicts surface as
 * merge_conflict with the original SemanticConflict objects when the bounded
 * output fits; a second stale attempt is retry_required and preserves the
 * cached base. Ambiguous network outcomes are resolved by fetching the draft
 * and comparing with sameContent — never a blind resend, never a claimed clean
 * failure.
 */

import {
  MAX_OPERATIONS_PER_BATCH,
  parseEditorialOperation,
  applyOperations,
  encodeOperations,
  inspectContent,
  reconcileContent,
  sameContent,
  type ContentValidation,
  type DraftHead,
  type DraftMutationResult,
  type EditorialOperation,
  type PublishedContentPayload,
  type SemanticConflict,
} from '@bemtevi/content-core';
import { EDITORIAL_ERROR_CODES, type EditorialError } from '../client/errors';
import { connectionArgs, fetchVerifiedDraft, rpcOnce, verifiedBaseOrRebase, type ToolRuntime } from './rpc';
import { fitsOutputBudget, headOf, isDraftHead, isRecord, projectValidation, toolFail, toolOk } from './shared';
import type { ToolError, ToolOutcome } from './shared';

export interface MutationData {
  head: DraftHead;
  changed: boolean;
  validation: ContentValidation;
  merged: boolean;
}

/** Maps a content-core failure (frozen code + PT-BR message) to a tool error. */
export function toToolError(failure: { code: string; message: string }): ToolError {
  const code = (EDITORIAL_ERROR_CODES as readonly string[]).includes(failure.code) ? failure.code : 'unavailable';
  return { code: code as EditorialError['code'], message: failure.message };
}

/**
 * Validates the operation envelope bounds (1..200 items -> invalid_input) and
 * every operation structure through content-core (invalid_operations /
 * invalid_image). No RPC call happens for a rejected batch.
 */
export function parseOperationBatch(value: unknown): ToolOutcome<EditorialOperation[]> {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_OPERATIONS_PER_BATCH) {
    return toolFail('invalid_input', `operations deve conter de 1 a ${MAX_OPERATIONS_PER_BATCH} operações.`);
  }
  const parsed: EditorialOperation[] = [];
  for (const raw of value) {
    const result = parseEditorialOperation(raw);
    if (result.ok === false) return { ok: false, error: toToolError(result.error) };
    parsed.push(result.data);
  }
  return toolOk(parsed);
}

function isMutationResult(value: unknown): value is DraftMutationResult {
  return isRecord(value) && isDraftHead(value.head) && typeof value.changed === 'boolean';
}

/** Builds the local candidate by applying the operations to the cached base. */
export function localCandidate(
  base: PublishedContentPayload,
  operations: EditorialOperation[],
): ToolOutcome<PublishedContentPayload> {
  const applied = applyOperations(base, operations);
  if (applied.ok === false) return { ok: false, error: toToolError(applied.error) };
  return toolOk(applied.data);
}

/** Caches the attempted/merged candidate UNVERIFIED under the returned head. */
function cacheCandidate(rt: ToolRuntime, head: DraftHead, candidate: PublishedContentPayload): void {
  try {
    rt.cache.insert({
      connectionId: rt.connectionId,
      generation: head.generation,
      head,
      payload: candidate,
      canonicalPayload: '',
      verified: false,
    });
  } catch {
    // A failed cache refresh must NOT fail the mutation result (doc 04).
  }
}

function conflictOutcome(conflicts: SemanticConflict[]): ToolOutcome<MutationData> {
  const failure = toolFail('merge_conflict', undefined, conflicts);
  if (!fitsOutputBudget(failure)) {
    return toolFail('response_too_large', 'Os conflitos desta chamada são grandes demais para a resposta.');
  }
  return failure;
}

/**
 * Runs the full mutation pipeline: cached verified base, local candidate,
 * CAS write, single bounded stale-merge retry, and ambiguous-outcome recovery.
 */
export async function runMutation(
  rt: ToolRuntime,
  expectedGeneration: number,
  operations: EditorialOperation[],
): Promise<ToolOutcome<MutationData>> {
  const base = verifiedBaseOrRebase(rt, expectedGeneration);
  if (base.ok === false) return base;
  const candidate = localCandidate(base.data.payload, operations);
  if (candidate.ok === false) return candidate;
  const inspection = inspectContent(candidate.data);

  const first = await rpcOnce(rt, 'agent_apply_operations', {
    ...connectionArgs(rt),
    p_expected_generation: expectedGeneration,
    p_operations: operations,
  });
  if (first.ok === false) {
    if (first.error.code === 'stale_generation') {
      return runStalePath(rt, base.data.payload, candidate.data);
    }
    if (first.error.code === 'unavailable') {
      return runAmbiguousPath(rt, base.data.payload, candidate.data);
    }
    return first;
  }
  if (!isMutationResult(first.data)) {
    return toolFail('unavailable', 'A resposta da aplicação de operações é inválida.');
  }
  const mutation = first.data;
  if (!mutation.changed) {
    // Accepted no-op: nothing advances and the verified base stays in place.
    return toolOk({
      head: headOf(mutation.head),
      changed: false,
      validation: projectValidation(inspection.validation),
      merged: false,
    });
  }
  cacheCandidate(rt, mutation.head, candidate.data);
  return toolOk({
    head: headOf(mutation.head),
    changed: true,
    validation: projectValidation(inspection.validation),
    merged: false,
  });
}

/** Stale generation: one verified fetch, reconcile, encode delta, retry once. */
async function runStalePath(
  rt: ToolRuntime,
  basePayload: PublishedContentPayload,
  candidate: PublishedContentPayload,
): Promise<ToolOutcome<MutationData>> {
  const remote = await fetchVerifiedDraft(rt);
  if (remote.ok === false) return remote;
  const merge = reconcileContent(basePayload, candidate, remote.data.payload);
  if (merge.ok === false) return toolFail('unavailable', 'A comparação para a mesclagem semântica falhou.');
  const mergedInspection = inspectContent(merge.value.candidate);
  if (merge.value.kind === 'incomplete') {
    return conflictOutcome(merge.value.conflicts);
  }
  const encoded = encodeOperations(remote.data.payload, merge.value.candidate);
  if (encoded.ok === false) return { ok: false, error: toToolError(encoded.error) };
  if (encoded.data.length === 0) {
    // The merged candidate equals the remote draft: skip the RPC entirely.
    cacheCandidate(rt, headOf(remote.data), merge.value.candidate);
    return toolOk({
      head: headOf(remote.data),
      changed: false,
      validation: projectValidation(mergedInspection.validation),
      merged: true,
    });
  }
  const retry = await rpcOnce(rt, 'agent_apply_operations', {
    ...connectionArgs(rt),
    p_expected_generation: remote.data.generation,
    p_operations: encoded.data,
  });
  if (retry.ok === false) {
    if (retry.error.code === 'stale_generation') {
      // Second stale: bounded — the cached base is preserved for host inspection.
      return toolFail('retry_required', 'O rascunho mudou novamente durante a mesclagem. Releia o contexto.');
    }
    if (retry.error.code === 'unavailable') {
      const remoteAfter = await fetchVerifiedDraft(rt);
      if (remoteAfter.ok === false) {
        return toolFail('retry_required', 'A resposta da mesclagem foi ambígua. Releia o contexto.');
      }
      if (!sameContent(remoteAfter.data.payload, merge.value.candidate)) {
        return toolFail('retry_required', 'A resposta da mesclagem foi ambígua. Releia o contexto.');
      }
      cacheCandidate(rt, headOf(remoteAfter.data), merge.value.candidate);
      return toolOk({
        head: headOf(remoteAfter.data),
        changed: true,
        validation: projectValidation(mergedInspection.validation),
        merged: true,
      });
    }
    return retry;
  }
  if (!isMutationResult(retry.data)) {
    return toolFail('unavailable', 'A resposta da aplicação de operações é inválida.');
  }
  const mutation = retry.data;
  if (mutation.changed) cacheCandidate(rt, mutation.head, merge.value.candidate);
  return toolOk({
    head: headOf(mutation.head),
    changed: mutation.changed,
    validation: projectValidation(mergedInspection.validation),
    merged: true,
  });
}

/** Ambiguous network outcome: fetch and compare before anything else (doc 03). */
async function runAmbiguousPath(
  rt: ToolRuntime,
  basePayload: PublishedContentPayload,
  candidate: PublishedContentPayload,
): Promise<ToolOutcome<MutationData>> {
  const remote = await fetchVerifiedDraft(rt);
  if (remote.ok === false) {
    return toolFail('unavailable', 'A gravação teve resultado ambíguo. Releia o contexto antes de tentar de novo.');
  }
  if (sameContent(remote.data.payload, candidate)) {
    cacheCandidate(rt, headOf(remote.data), candidate);
    const inspection = inspectContent(candidate);
    return toolOk({
      head: headOf(remote.data),
      changed: true,
      validation: projectValidation(inspection.validation),
      merged: false,
    });
  }
  // Different content: the original reconcile/retry path applies (the one retry).
  return runStalePath(rt, basePayload, candidate);
}
