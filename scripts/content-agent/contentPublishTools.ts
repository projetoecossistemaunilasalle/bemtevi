import { randomBytes } from 'node:crypto';
import { compareContent } from '../../src/dev-dashboard/publishing/semanticDiff';
import type { PublishedContentPayload, PublishedContentSnapshot } from '../../src/app/content/publishedContent';
import {
  ContentAgentError,
  parseRevision,
  requiredPositiveInteger,
  requiredString,
  type JsonRecord,
} from './contentAgentErrors';
import { digestContent } from './digest';
import { DraftStore, type PublicationAttempt } from './draftStore';
import { loadPublishedSnapshot } from './contentReadTools';
import type { PublishedContentReader } from './publishedReader';

export interface ContentAgentSession {
  publisherId: string;
  sessionId: string;
}

/** The publisher owns authentication; credentials never cross the tool boundary. */
export interface ContentPublisher {
  getSession(): Promise<ContentAgentSession | null>;
  publishContent(input: {
    payload: PublishedContentPayload;
    expectedRevision: number | null;
    publisherId: string;
  }): Promise<PublishedContentSnapshot>;
}

export interface ContentPublishToolsOptions {
  reader: PublishedContentReader;
  store: DraftStore;
  publisher?: ContentPublisher;
}

interface PreparedPublish {
  publishToken: string;
  draftId: string;
  generation: number;
  candidateDigest: string;
  expectedRevision: number | null;
  sessionId: string;
  expiresAt: number;
}

export class ContentPublishTools {
  private readonly preparedTokens = new Map<string, PreparedPublish>();
  private readonly publishingTokens = new Set<string>();

  constructor(private readonly options: ContentPublishToolsOptions) {}

  invalidateDraft(draftId: string): void {
    for (const [token, prepared] of this.preparedTokens) {
      if (prepared.draftId === draftId) this.preparedTokens.delete(token);
    }
  }

  async preparePublish(args: JsonRecord) {
    const draftId = requiredString(args.draftId, 'draftId');
    const generation = requiredPositiveInteger(args.generation, 'generation');
    const expectedRevision = parseRevision(args.expectedRevision);
    const snapshot = await loadPublishedSnapshot(this.options.reader);
    if (expectedRevision !== snapshot?.revision) {
      throw new ContentAgentError('revision_conflict', 'A revisão esperada não corresponde à publicação atual.');
    }
    const draft = await this.options.store.get(draftId);
    if (draft.generation !== generation) {
      throw new ContentAgentError('stale_generation', 'O rascunho foi alterado; prepare uma geração mais nova.');
    }
    if (draft.base.revision !== expectedRevision) {
      throw new ContentAgentError('revision_conflict', 'A base do rascunho não corresponde à publicação atual.');
    }
    if (!draft.validation.valid) {
      throw new ContentAgentError('invalid_payload', 'O rascunho contém erros de validação e não pode ser publicado.');
    }
    const publisher = this.options.publisher;
    if (!publisher) throw new ContentAgentError('unauthorized', 'Nenhuma sessão administrativa está disponível.');
    const session = await publisher.getSession();
    if (!session?.publisherId || !session.sessionId) {
      throw new ContentAgentError('unauthorized', 'A sessão administrativa não está autenticada.');
    }
    const diff = compareContent(snapshot!.payload, draft.candidate);
    if (!diff.ok || diff.value.length === 0) {
      throw new ContentAgentError('invalid_payload', 'O rascunho não contém alterações publicáveis.');
    }
    const publishToken = `btp_${cryptoRandomToken()}`;
    const expiresAt = Date.now() + 5 * 60 * 1000;
    this.expireTokens();
    this.preparedTokens.set(publishToken, {
      publishToken,
      draftId,
      generation,
      candidateDigest: draft.candidateDigest,
      expectedRevision,
      sessionId: session.sessionId,
      expiresAt,
    });
    return {
      draftId,
      generation,
      expectedRevision,
      candidateDigest: draft.candidateDigest,
      publishToken,
      expiresAt: new Date(expiresAt).toISOString(),
      diff: diff.value,
      summary: summarizeChanges(diff.value),
    };
  }

  async publishDraft(args: JsonRecord) {
    const publishToken = requiredString(args.publishToken, 'publishToken');
    if (this.publishingTokens.has(publishToken)) {
      throw new ContentAgentError('uncertain_outcome', 'Esta publicação já está em andamento.');
    }
    this.publishingTokens.add(publishToken);
    try {
      return await this.publishDraftUnlocked(args);
    } finally {
      this.publishingTokens.delete(publishToken);
    }
  }

  private async publishDraftUnlocked(args: JsonRecord) {
    const draftId = requiredString(args.draftId, 'draftId');
    const generation = requiredPositiveInteger(args.generation, 'generation');
    const expectedRevision = parseRevision(args.expectedRevision);
    const publishToken = requiredString(args.publishToken, 'publishToken');
    this.expireTokens();
    const prepared = this.preparedTokens.get(publishToken);
    if (!prepared || prepared.expiresAt <= Date.now()) {
      this.preparedTokens.delete(publishToken);
      throw new ContentAgentError('token_expired', 'O token de publicação expirou ou não é válido.');
    }
    if (
      prepared.draftId !== draftId ||
      prepared.generation !== generation ||
      prepared.expectedRevision !== expectedRevision
    ) {
      throw new ContentAgentError('stale_generation', 'O token não corresponde à geração e revisão informadas.');
    }
    const publisher = this.options.publisher;
    if (!publisher) throw new ContentAgentError('unauthorized', 'Nenhuma sessão administrativa está disponível.');
    const session = await publisher.getSession();
    if (!session?.publisherId || !session.sessionId) {
      throw new ContentAgentError('unauthorized', 'A sessão administrativa não está autenticada.');
    }
    if (session.sessionId !== prepared.sessionId) {
      this.preparedTokens.delete(publishToken);
      throw new ContentAgentError('unauthorized', 'A sessão administrativa mudou depois da preparação.');
    }
    const priorAttempt = await this.options.store.findPublicationAttempt({
      draftId,
      generation,
      candidateDigest: prepared.candidateDigest,
      expectedRevision,
      publisherId: session.publisherId,
    });
    if (priorAttempt) {
      const confirmed = await this.confirmRemoteDigest(prepared.candidateDigest, expectedRevision, session.publisherId);
      if (confirmed) {
        this.preparedTokens.delete(publishToken);
        await this.options.store.clearPublicationAttempt(priorAttempt.attemptId);
        return {
          draftId,
          generation,
          revision: confirmed.revision,
          digest: prepared.candidateDigest,
          status: 'published',
          confirmed: true,
        };
      }
      throw new ContentAgentError('uncertain_outcome', 'A tentativa anterior ainda não pôde ser confirmada.');
    }
    const draft = await this.options.store.get(draftId);
    if (draft.generation !== generation || draft.candidateDigest !== prepared.candidateDigest) {
      this.preparedTokens.delete(publishToken);
      throw new ContentAgentError('stale_generation', 'O rascunho mudou depois da preparação.');
    }
    if (!draft.validation.valid) {
      this.preparedTokens.delete(publishToken);
      throw new ContentAgentError('invalid_payload', 'O rascunho contém erros de validação.');
    }
    const latest = await loadPublishedSnapshot(this.options.reader);
    if ((latest?.revision ?? null) !== expectedRevision) {
      this.preparedTokens.delete(publishToken);
      throw new ContentAgentError('revision_conflict', 'A publicação mudou depois da preparação.');
    }
    const attempt: PublicationAttempt = {
      attemptId: cryptoRandomToken(),
      draftId,
      generation,
      candidateDigest: draft.candidateDigest,
      expectedRevision,
      publisherId: session.publisherId,
      createdAt: new Date().toISOString(),
    };
    await this.options.store.recordPublicationAttempt(attempt);
    try {
      const snapshot = await publisher.publishContent({
        payload: draft.candidate,
        expectedRevision,
        publisherId: session.publisherId,
      });
      this.preparedTokens.delete(publishToken);
      await this.options.store.clearPublicationAttempt(attempt.attemptId);
      return {
        draftId,
        generation,
        revision: snapshot.revision,
        digest: digestContent(snapshot.payload),
        status: 'published',
      };
    } catch (error) {
      if (error instanceof ContentAgentError && error.code === 'revision_conflict') {
        this.preparedTokens.delete(publishToken);
        await this.options.store.clearPublicationAttempt(attempt.attemptId);
        throw error;
      }
      if ((error as { code?: string })?.code === 'conflict') {
        this.preparedTokens.delete(publishToken);
        await this.options.store.clearPublicationAttempt(attempt.attemptId);
        throw new ContentAgentError('revision_conflict', 'Conflito de revisão ao publicar o conteúdo.');
      }
      const confirmed = await this.confirmRemoteDigest(draft.candidateDigest, expectedRevision, session.publisherId);
      if (confirmed) {
        this.preparedTokens.delete(publishToken);
        await this.options.store.clearPublicationAttempt(attempt.attemptId);
        return {
          draftId,
          generation,
          revision: confirmed.revision,
          digest: draft.candidateDigest,
          status: 'published',
          confirmed: true,
        };
      }
      throw new ContentAgentError('uncertain_outcome', 'O resultado da publicação não pôde ser confirmado.');
    }
  }

  private async confirmRemoteDigest(
    candidateDigest: string,
    expectedRevision: number | null,
    publisherId: string,
  ): Promise<PublishedContentSnapshot | null> {
    try {
      const snapshot = await loadPublishedSnapshot(this.options.reader);
      return snapshot &&
        snapshot.revision === (expectedRevision ?? 0) + 1 &&
        snapshot.publishedBy === publisherId &&
        digestContent(snapshot.payload) === candidateDigest
        ? snapshot
        : null;
    } catch {
      return null;
    }
  }

  private expireTokens() {
    const now = Date.now();
    for (const [token, prepared] of this.preparedTokens) {
      if (prepared.expiresAt <= now) this.preparedTokens.delete(token);
    }
  }
}

function cryptoRandomToken(): string {
  return randomBytes(32).toString('base64url');
}

function summarizeChanges(changes: Array<{ kind: string }>) {
  return changes.reduce<Record<string, number>>((summary, change) => {
    summary[change.kind] = (summary[change.kind] ?? 0) + 1;
    return summary;
  }, {});
}
