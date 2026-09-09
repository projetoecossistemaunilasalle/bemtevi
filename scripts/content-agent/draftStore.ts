import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { PublishedContentPayload } from '../../src/app/content/publishedContent';
import { digestContent } from './digest';
import { inspectContent, type ContentValidation } from './contentValidation';

export const DRAFT_SCHEMA_VERSION = 1 as const;

export interface ContentDraft {
  schemaVersion: typeof DRAFT_SCHEMA_VERSION;
  draftId: string;
  generation: number;
  base: {
    revision: number | null;
    digest: string;
    payload: PublishedContentPayload;
  };
  candidate: PublishedContentPayload;
  candidateDigest: string;
  validation: ContentValidation;
  createdAt: string;
  updatedAt: string;
}

export type DraftStoreErrorCode = 'stale_generation' | 'unavailable' | 'invalid_payload';

export class DraftStoreError extends Error {
  constructor(
    public readonly code: DraftStoreErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'DraftStoreError';
  }
}

interface DraftIndex {
  idempotency: Record<string, string>;
}

export interface PublicationAttempt {
  attemptId: string;
  draftId: string;
  generation: number;
  candidateDigest: string;
  expectedRevision: number | null;
  publisherId: string;
  createdAt: string;
}

export interface CreateDraftInput {
  baseRevision: number | null;
  basePayload: PublishedContentPayload;
  candidate: unknown;
  idempotencyKey?: string;
}

export interface UpdateDraftInput {
  draftId: string;
  expectedGeneration: number;
  candidate: unknown;
  idempotencyKey?: string;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function safeDraftId(draftId: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(draftId))
    throw new DraftStoreError('unavailable', 'Identificador de rascunho inválido.');
  return draftId;
}

function validIdempotencyKey(key: string | undefined): string | undefined {
  if (key === undefined) return undefined;
  if (typeof key !== 'string' || key.trim().length < 1 || key.length > 200) {
    throw new DraftStoreError('invalid_payload', 'A chave de idempotência precisa ter entre 1 e 200 caracteres.');
  }
  return key;
}

export class DraftStore {
  private readonly locks = new Map<string, Promise<void>>();

  constructor(private readonly directory: string) {}

  async create(input: CreateDraftInput): Promise<ContentDraft> {
    return this.withLock('__create__', () => this.withMutationLock(() => this.createUnlocked(input)));
  }

  private async createUnlocked(input: CreateDraftInput): Promise<ContentDraft> {
    const key = validIdempotencyKey(input.idempotencyKey);
    await this.ensureDirectory();
    const operationId = key ? `create:${key}` : undefined;
    const recorded = operationId ? await this.readOperation(operationId) : null;
    if (recorded) {
      await this.recoverRecordedDraft(recorded);
      return clone(recorded);
    }
    const index = await this.readIndex();
    const existingId = key ? index.idempotency[`create:${key}`] : undefined;
    if (existingId) return this.get(existingId);

    const now = new Date().toISOString();
    const baseInspection = inspectContent(input.basePayload);
    if (!baseInspection.payload || !baseInspection.validation.valid) {
      throw new DraftStoreError('invalid_payload', 'A base do rascunho é inválida.');
    }
    const inspection = inspectContent(input.candidate);
    const candidate = clone(inspection.payload ?? input.candidate) as PublishedContentPayload;
    const draft: ContentDraft = {
      schemaVersion: DRAFT_SCHEMA_VERSION,
      draftId: randomUUID(),
      generation: 1,
      base: {
        revision: input.baseRevision,
        digest: digestContent(baseInspection.payload),
        payload: clone(baseInspection.payload),
      },
      candidate,
      candidateDigest: digestContent(candidate),
      validation: inspection.validation,
      createdAt: now,
      updatedAt: now,
    };
    if (operationId) await this.writeOperation(operationId, draft);
    await this.writeDraft(draft);
    if (key) {
      index.idempotency[`create:${key}`] = draft.draftId;
      await this.writeIndex(index);
    }
    return clone(draft);
  }

  async update(input: UpdateDraftInput): Promise<ContentDraft> {
    const draftId = safeDraftId(input.draftId);
    const key = validIdempotencyKey(input.idempotencyKey);
    const idempotencyId = key ? `update:${draftId}:${key}` : undefined;
    await this.ensureDirectory();

    return this.withLock(draftId, () =>
      this.withMutationLock(async () => {
        const recorded = idempotencyId ? await this.readOperation(idempotencyId) : null;
        if (recorded) {
          await this.recoverRecordedDraft(recorded);
          return clone(recorded);
        }
        const index = await this.readIndex();
        const existingId = idempotencyId ? index.idempotency[idempotencyId] : undefined;
        if (existingId) return this.get(existingId);

        const current = await this.get(draftId);
        if (current.generation !== input.expectedGeneration) {
          throw new DraftStoreError(
            'stale_generation',
            `O rascunho está na geração ${current.generation}; era esperada a geração ${input.expectedGeneration}.`,
          );
        }
        const inspection = inspectContent(input.candidate);
        const next: ContentDraft = {
          ...current,
          generation: current.generation + 1,
          candidate: clone(inspection.payload ?? input.candidate) as PublishedContentPayload,
          candidateDigest: digestContent(inspection.payload ?? input.candidate),
          validation: inspection.validation,
          updatedAt: new Date().toISOString(),
        };
        if (idempotencyId) await this.writeOperation(idempotencyId, next);
        await this.writeDraft(next);
        if (idempotencyId) {
          index.idempotency[idempotencyId] = draftId;
          await this.writeIndex(index);
        }
        return clone(next);
      }),
    );
  }

  async get(draftId: string, generation?: number): Promise<ContentDraft> {
    const safeId = safeDraftId(draftId);
    try {
      const raw = JSON.parse(
        await readFile(
          generation === undefined ? this.filePath(safeId) : this.checkpointPath(safeId, generation),
          'utf8',
        ),
      ) as ContentDraft;
      if (
        raw.schemaVersion !== DRAFT_SCHEMA_VERSION ||
        raw.draftId !== safeId ||
        !Number.isSafeInteger(raw.generation) ||
        raw.generation < 1 ||
        (generation !== undefined && raw.generation !== generation) ||
        raw.base.digest !== digestContent(raw.base.payload) ||
        raw.candidateDigest !== digestContent(raw.candidate)
      ) {
        throw new Error('invalid draft');
      }
      const inspection = inspectContent(raw.candidate);
      if (JSON.stringify(inspection.validation) !== JSON.stringify(raw.validation))
        throw new Error('invalid validation');
      return clone(raw);
    } catch (error) {
      if (error instanceof DraftStoreError) throw error;
      if (generation !== undefined) {
        throw new DraftStoreError('stale_generation', 'A geração solicitada não está disponível.');
      }
      throw new DraftStoreError('unavailable', 'Não foi possível ler o rascunho solicitado.');
    }
  }

  async list(cursor = 0, limit = 20): Promise<{ drafts: ContentDraft[]; nextCursor: string | null }> {
    await this.ensureDirectory();
    const entries = (await readdir(this.directory, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && /^[0-9a-f-]{36}\.json$/i.test(entry.name))
      .sort((left, right) => left.name.localeCompare(right.name));
    const selected = entries.slice(cursor, cursor + limit);
    const drafts = await Promise.all(selected.map((entry) => this.get(entry.name.slice(0, -5))));
    const next = cursor + selected.length;
    return { drafts, nextCursor: next < entries.length ? String(next) : null };
  }

  async recordPublicationAttempt(attempt: PublicationAttempt): Promise<void> {
    await this.withMutationLock(async () => {
      const attempts = await this.readAttempts();
      attempts[attempt.attemptId] = clone(attempt);
      await this.writeAttempts(attempts);
    });
  }

  async getPublicationAttempt(attemptId: string): Promise<PublicationAttempt | null> {
    const attempts = await this.readAttempts();
    const attempt = attempts[attemptId];
    return attempt ? clone(attempt) : null;
  }

  async findPublicationAttempt(query: {
    draftId: string;
    generation: number;
    candidateDigest: string;
    expectedRevision: number | null;
    publisherId: string;
  }): Promise<PublicationAttempt | null> {
    const attempts = await this.readAttempts();
    const match = Object.values(attempts).find(
      (attempt) =>
        attempt.draftId === query.draftId &&
        attempt.generation === query.generation &&
        attempt.candidateDigest === query.candidateDigest &&
        attempt.expectedRevision === query.expectedRevision &&
        attempt.publisherId === query.publisherId,
    );
    return match ? clone(match) : null;
  }

  async clearPublicationAttempt(attemptId: string): Promise<void> {
    await this.withMutationLock(async () => {
      const attempts = await this.readAttempts();
      delete attempts[attemptId];
      await this.writeAttempts(attempts);
    });
  }

  private async withLock<T>(draftId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(draftId) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const queued = previous.then(() => current);
    this.locks.set(draftId, queued);
    await previous;
    try {
      return await operation();
    } finally {
      release();
      if (this.locks.get(draftId) === queued) this.locks.delete(draftId);
    }
  }

  private filePath(draftId: string): string {
    return path.join(this.directory, `${draftId}.json`);
  }

  private checkpointPath(draftId: string, generation: number): string {
    return path.join(this.directory, 'checkpoints', `${draftId}.${generation}.json`);
  }

  private indexPath(): string {
    return path.join(this.directory, 'index.json');
  }

  private attemptsPath(): string {
    return path.join(this.directory, 'publication-attempts.json');
  }

  private operationPath(operationId: string): string {
    return path.join(this.directory, 'operations', `${digestContent(operationId)}.json`);
  }

  private async ensureDirectory() {
    await mkdir(path.join(this.directory, 'checkpoints'), { recursive: true });
    await mkdir(path.join(this.directory, 'operations'), { recursive: true });
  }

  private async readIndex(): Promise<DraftIndex> {
    try {
      const index = JSON.parse(await readFile(this.indexPath(), 'utf8')) as DraftIndex;
      return index && typeof index.idempotency === 'object' ? index : { idempotency: {} };
    } catch {
      return { idempotency: {} };
    }
  }

  private async writeIndex(index: DraftIndex) {
    await this.atomicWrite(this.indexPath(), JSON.stringify(index));
  }

  private async readAttempts(): Promise<Record<string, PublicationAttempt>> {
    try {
      const attempts = JSON.parse(await readFile(this.attemptsPath(), 'utf8')) as Record<string, PublicationAttempt>;
      return attempts && typeof attempts === 'object' ? attempts : {};
    } catch {
      return {};
    }
  }

  private async writeAttempts(attempts: Record<string, PublicationAttempt>) {
    await this.atomicWrite(this.attemptsPath(), JSON.stringify(attempts));
  }

  private async writeDraft(draft: ContentDraft) {
    await this.atomicWrite(this.checkpointPath(draft.draftId, draft.generation), JSON.stringify(draft));
    await this.atomicWrite(this.filePath(draft.draftId), JSON.stringify(draft));
  }

  private async readOperation(operationId: string): Promise<ContentDraft | null> {
    try {
      const draft = JSON.parse(await readFile(this.operationPath(operationId), 'utf8')) as ContentDraft;
      if (
        draft.schemaVersion !== DRAFT_SCHEMA_VERSION ||
        !Number.isSafeInteger(draft.generation) ||
        draft.generation < 1 ||
        draft.base.digest !== digestContent(draft.base.payload) ||
        draft.candidateDigest !== digestContent(draft.candidate)
      ) {
        throw new Error('invalid operation journal');
      }
      return draft;
    } catch {
      return null;
    }
  }

  private async writeOperation(operationId: string, draft: ContentDraft): Promise<void> {
    await this.atomicWrite(this.operationPath(operationId), JSON.stringify(draft));
  }

  private async recoverRecordedDraft(draft: ContentDraft): Promise<void> {
    await this.atomicWrite(this.checkpointPath(draft.draftId, draft.generation), JSON.stringify(draft));
    let current: ContentDraft | null = null;
    try {
      current = await this.get(draft.draftId);
    } catch {
      // The journal may have been persisted immediately before process exit.
    }
    if (!current || current.generation < draft.generation) {
      await this.atomicWrite(this.filePath(draft.draftId), JSON.stringify(draft));
    }
  }

  /** Serializes mutations shared by the stdio MCP and dashboard HTTP process. */
  private async withMutationLock<T>(operation: () => Promise<T>): Promise<T> {
    await this.ensureDirectory();
    const lockPath = path.join(this.directory, '.write-lock');
    const deadline = Date.now() + 10_000;
    while (true) {
      try {
        await mkdir(lockPath);
        break;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
          throw new DraftStoreError('unavailable', 'Não foi possível bloquear o armazenamento de rascunhos.');
        }
        try {
          if (Date.now() - (await stat(lockPath)).mtimeMs > 30_000) await rm(lockPath, { recursive: true });
        } catch {
          // Another process may have released the lock between checks.
        }
        if (Date.now() >= deadline) {
          throw new DraftStoreError('unavailable', 'O armazenamento de rascunhos está ocupado. Tente novamente.');
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    }
    try {
      return await operation();
    } finally {
      await rm(lockPath, { recursive: true, force: true });
    }
  }

  private async atomicWrite(filePath: string, contents: string) {
    const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporaryPath, contents, { encoding: 'utf8', mode: 0o600 });
      await rename(temporaryPath, filePath);
    } catch (_error) {
      try {
        await import('node:fs/promises').then(({ unlink }) => unlink(temporaryPath));
      } catch {
        // Best effort cleanup; the atomic target remains untouched.
      }
      throw new DraftStoreError('unavailable', 'Não foi possível salvar o rascunho local.');
    }
  }
}
