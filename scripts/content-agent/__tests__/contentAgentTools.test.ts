import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getBundledContent } from '../../../src/app/content/bundledContent';
import type { PublishedContentSnapshot } from '../../../src/app/content/publishedContent';
import { ContentAgentError, mapContentAgentError, validateToolArguments } from '../contentAgentErrors';
import { ContentDraftTools } from '../contentDraftTools';
import { ContentReadTools } from '../contentReadTools';
import { DraftStore, DraftStoreError } from '../draftStore';

function snapshot(): PublishedContentSnapshot {
  return {
    schemaVersion: '1.0.0',
    revision: 40,
    payload: getBundledContent(),
    publishedAt: new Date(0).toISOString(),
    publishedBy: 'admin',
  };
}

describe('content agent error boundary', () => {
  it('rejects unknown arguments and ambiguous write variants', () => {
    expect(() => validateToolArguments('get_published_revision', { extra: true })).toThrowError(ContentAgentError);
    expect(() => validateToolArguments('create_draft', { baseRevision: 40, candidate: {}, operations: [] })).toThrow(
      'Informe exatamente um entre candidate e operations.',
    );
  });

  it('maps draft-store failures without leaking implementation details', () => {
    const error = mapContentAgentError(new DraftStoreError('stale_generation', 'geração antiga'));
    expect(error).toMatchObject({ code: 'stale_generation', message: 'geração antiga' });
    expect(mapContentAgentError(new Error('unexpected')).code).toBe('unavailable');
  });
});

describe('content read tools', () => {
  it('keeps reads projected and exposes revision metadata separately', async () => {
    const current = snapshot();
    const tools = new ContentReadTools({ loadPublishedContent: async () => current });

    await expect(tools.getPublishedRevision()).resolves.toMatchObject({
      revision: 40,
      counts: { flows: current.payload.flows.length },
    });
    const page = await tools.listPublishedItems({ scope: 'flows', fields: ['title'], limit: 1 });
    expect(page.items).toHaveLength(1);
    expect(Object.keys(page.items[0] ?? {})).toEqual(['id', 'title']);
    expect(page.nextCursor).toBe(current.payload.flows.length > 1 ? '1' : null);
  });

  it('maps reader failures to the unavailable agent error', async () => {
    const tools = new ContentReadTools({
      loadPublishedContent: async () => {
        throw new Error('database offline');
      },
    });

    await expect(tools.getPublishedRevision()).rejects.toMatchObject({
      code: 'unavailable',
      message: 'Não foi possível ler o conteúdo publicado.',
    });
  });
});

describe('content draft tools', () => {
  it('validates operations, persists a generation, and returns its diff', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'bemtevi-content-draft-tools-test-'));
    const current = snapshot();
    const store = new DraftStore(directory);
    const tools = new ContentDraftTools({
      store,
      loadSnapshot: async () => current,
    });
    const flow = current.payload.flows[0];

    try {
      const operation = {
        op: 'update',
        scope: 'flows',
        id: flow.id,
        patch: { title: 'Título validado' },
      };
      const validation = await tools.validateContentPatch({ baseRevision: 40, operations: [operation] });
      expect(validation.validation.valid).toBe(true);
      const draft = await tools.createDraft({ baseRevision: 40, operations: [operation] });
      expect(draft.generation).toBe(1);
      const diff = await tools.getDraftDiff({ draftId: draft.draftId });
      expect(diff.diff.length).toBeGreaterThan(0);
      expect((await tools.getDraft({ draftId: draft.draftId })).status).toBe('valid');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
