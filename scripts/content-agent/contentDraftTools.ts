import { applyAiOperations, parseAiOperationsResponse } from '../../src/dev-dashboard/ai/aiOperations';
import { compareContent } from '../../src/dev-dashboard/publishing/semanticDiff';
import type { PublishedContentPayload, PublishedContentSnapshot } from '../../src/app/content/publishedContent';
import {
  ContentAgentError,
  mapContentAgentError,
  requiredPositiveInteger,
  requiredString,
  type JsonRecord,
} from './contentAgentErrors';
import { digestContent } from './digest';
import { DraftStore, type ContentDraft } from './draftStore';
import { currentPayload } from './contentReadTools';
import { inspectContent } from './contentValidation';

export interface ContentDraftToolsOptions {
  store: DraftStore;
  loadSnapshot: () => Promise<PublishedContentSnapshot | null>;
  invalidatePreparedTokens?: (draftId: string) => void;
}

export class ContentDraftTools {
  constructor(private readonly options: ContentDraftToolsOptions) {}

  async validateContentPatch(args: JsonRecord) {
    const snapshot = await this.options.loadSnapshot();
    const current = currentPayload(snapshot);
    const revision = args.baseRevision;
    if (typeof revision !== 'number' || revision !== snapshot?.revision) {
      throw new ContentAgentError('revision_conflict', 'A revisão base não corresponde à publicação atual.');
    }
    const candidate = operationCandidate(current, revision, args.operations);
    return { baseRevision: revision, ...inspectResult(candidate, current) };
  }

  async createDraft(args: JsonRecord) {
    const snapshot = await this.options.loadSnapshot();
    const current = currentPayload(snapshot);
    const baseRevision = args.baseRevision;
    if (baseRevision !== snapshot?.revision && !(baseRevision === null && snapshot === null)) {
      throw new ContentAgentError('revision_conflict', 'A revisão base não corresponde à publicação atual.');
    }
    const candidate =
      args.operations !== undefined ? operationCandidate(current, snapshot!.revision, args.operations) : args.candidate;
    if (candidate === undefined) throw new ContentAgentError('invalid_payload', 'Informe candidate ou operations.');
    try {
      const draft = await this.options.store.create({
        baseRevision: snapshot?.revision ?? null,
        basePayload: current,
        candidate,
        idempotencyKey: typeof args.idempotencyKey === 'string' ? args.idempotencyKey : undefined,
      });
      return summarizeDraftMutation(draft);
    } catch (error) {
      throw mapContentAgentError(error);
    }
  }

  async updateDraft(args: JsonRecord) {
    const draftId = requiredString(args.draftId, 'draftId');
    const expectedGeneration = args.expectedGeneration;
    if (typeof expectedGeneration !== 'number' || !Number.isSafeInteger(expectedGeneration) || expectedGeneration < 1) {
      throw new ContentAgentError('invalid_payload', 'expectedGeneration inválida.');
    }
    const current = await this.options.store.get(draftId);
    const candidate =
      args.operations !== undefined
        ? operationCandidate(current.candidate, current.base.revision ?? 1, args.operations)
        : args.candidate;
    if (candidate === undefined) throw new ContentAgentError('invalid_payload', 'Informe candidate ou operations.');
    try {
      const draft = await this.options.store.update({
        draftId,
        expectedGeneration,
        candidate,
        idempotencyKey: typeof args.idempotencyKey === 'string' ? args.idempotencyKey : undefined,
      });
      this.options.invalidatePreparedTokens?.(draftId);
      return summarizeDraftMutation(draft);
    } catch (error) {
      throw mapContentAgentError(error);
    }
  }

  async getDraft(args: JsonRecord) {
    const generation =
      args.generation === undefined ? undefined : requiredPositiveInteger(args.generation, 'generation');
    const draft = await this.options.store.get(requiredString(args.draftId, 'draftId'), generation);
    return summarizeDraft(draft);
  }

  async getDraftDiff(args: JsonRecord) {
    const generation =
      args.generation === undefined ? undefined : requiredPositiveInteger(args.generation, 'generation');
    const snapshot = args.against === 'published' ? await this.options.loadSnapshot() : null;
    const draft = await this.options.store.get(requiredString(args.draftId, 'draftId'), generation);
    const against = args.against === 'published' ? currentPayload(snapshot) : draft.base.payload;
    const result = inspectResult(draft.candidate, against);
    return {
      draftId: draft.draftId,
      generation: draft.generation,
      against: args.against === 'published' ? 'published' : 'base',
      againstRevision: args.against === 'published' ? (snapshot?.revision ?? null) : draft.base.revision,
      baseDigest: digestContent(against),
      candidateDigest: result.candidateDigest,
      validation: result.validation,
      diff: result.diff,
    };
  }
}

export function operationCandidate(
  base: PublishedContentPayload,
  revision: number,
  raw: unknown,
): PublishedContentPayload {
  if (!Array.isArray(raw)) throw new ContentAgentError('invalid_payload', 'operations precisa ser uma lista.');
  try {
    const envelope = parseAiOperationsResponse({
      schemaVersion: '1.0.0',
      baseRevision: revision,
      operations: raw,
      selfCheck: {
        reviewed: true,
        noOutOfScopeChanges: true,
        noUnrequestedDeletes: true,
        noUnsupportedImagePaths: true,
        notes: [],
      },
    });
    return applyAiOperations(base, envelope, revision);
  } catch (error) {
    throw new ContentAgentError('invalid_payload', error instanceof Error ? error.message : 'Operações inválidas.');
  }
}

export function inspectResult(candidate: unknown, base: PublishedContentPayload) {
  const inspection = inspectContent(candidate);
  const diff = inspection.payload
    ? compareContent(base, inspection.payload)
    : { ok: false as const, code: 'invalid_input' as const };
  return {
    candidate,
    candidateDigest: digestContent(candidate),
    validation: inspection.validation,
    diff: diff.ok ? diff.value : [],
  };
}

function summarizeDraft(draft: ContentDraft) {
  return {
    ...draft,
    status: draft.validation.valid ? 'valid' : 'invalid',
  };
}

function summarizeDraftMutation(draft: ContentDraft) {
  const compared = compareContent(draft.base.payload, draft.candidate);
  return {
    draftId: draft.draftId,
    generation: draft.generation,
    baseRevision: draft.base.revision,
    baseDigest: draft.base.digest,
    candidateDigest: draft.candidateDigest,
    validation: draft.validation,
    diff: compared.ok ? compared.value : [],
    status: draft.validation.valid ? 'valid' : 'invalid',
  };
}
