import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getBundledContent } from '../../../src/app/content/bundledContent';
import type { PublishedContentSnapshot } from '../../../src/app/content/publishedContent';
import { DraftStore } from '../draftStore';
import { ContentMcpServer, type ContentPublisher } from '../server';

function request(server: ContentMcpServer, id: number, name: string, args: Record<string, unknown> = {}) {
  return server.handle({
    jsonrpc: '2.0',
    id,
    method: 'tools/call',
    params: { name, arguments: args },
  }) as Promise<Record<string, unknown>>;
}

function toolValue(response: Record<string, unknown>) {
  return (response.result as { structuredContent: Record<string, unknown> }).structuredContent;
}

async function createFixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'bemtevi-content-agent-test-'));
  const payload = getBundledContent();
  let snapshot: PublishedContentSnapshot = {
    schemaVersion: '1.0.0',
    revision: 40,
    payload,
    publishedAt: new Date(0).toISOString(),
    publishedBy: 'admin',
  };
  const reader = { loadPublishedContent: async () => snapshot };
  const store = new DraftStore(directory);
  const server = new ContentMcpServer({ reader, store });
  return {
    directory,
    payload,
    server,
    store,
    reader,
    setSnapshot(next: PublishedContentSnapshot) {
      snapshot = next;
    },
  };
}

describe('servidor MCP de conteúdo', () => {
  it('anuncia as ferramentas e retorna somente metadados na leitura da revisão', async () => {
    const fixture = await createFixture();
    try {
      const listed = await fixture.server.handle({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
      const announced = (listed?.result as { tools: Array<{ name: string; outputSchema: Record<string, unknown> }> })
        .tools;
      expect(announced.map((tool) => tool.name)).toEqual(
        expect.arrayContaining([
          'get_published_revision',
          'list_published_items',
          'find_material_references',
          'get_flow',
          'get_material',
          'validate_content_patch',
          'create_draft',
          'update_draft',
          'get_draft',
          'get_draft_diff',
          'prepare_publish',
          'publish_draft',
        ]),
      );
      expect(announced.every((tool) => tool.outputSchema.additionalProperties === false)).toBe(true);
      const response = await request(fixture.server, 2, 'get_published_revision');
      const value = toolValue(response);
      expect(value).toMatchObject({ revision: 40, counts: { flows: fixture.payload.flows.length } });
      expect(value).not.toHaveProperty('payload');
    } finally {
      await rm(fixture.directory, { recursive: true, force: true });
    }
  });

  it('pagina com projeção e aplica operações sem transportar o payload inteiro', async () => {
    const fixture = await createFixture();
    try {
      const list = toolValue(
        await request(fixture.server, 1, 'list_published_items', {
          scope: 'flows',
          fields: ['title'],
          limit: 1,
        }),
      );
      const items = list.items as Array<Record<string, unknown>>;
      expect(items).toHaveLength(1);
      expect(Object.keys(items[0])).toEqual(['id', 'title']);
      expect(list.nextCursor).toBe('1');

      const flow = fixture.payload.flows[0];
      const validation = toolValue(
        await request(fixture.server, 2, 'validate_content_patch', {
          baseRevision: 40,
          operations: [{ op: 'update', scope: 'flows', id: flow.id, patch: { title: 'Título de teste' } }],
        }),
      );
      expect(validation.candidateDigest).toMatch(/^[a-f0-9]{64}$/);
      expect((validation.candidate as { flows: Array<{ title: string }> }).flows[0].title).toBe('Título de teste');
      expect((validation.validation as { valid: boolean }).valid).toBe(true);
    } finally {
      await rm(fixture.directory, { recursive: true, force: true });
    }
  });

  it('cria gerações com idempotência e rejeita atualização obsoleta', async () => {
    const fixture = await createFixture();
    try {
      const operation = {
        op: 'update',
        scope: 'flows',
        id: fixture.payload.flows[0].id,
        patch: { title: 'Primeiro título' },
      };
      const first = toolValue(
        await request(fixture.server, 1, 'create_draft', {
          baseRevision: 40,
          operations: [operation],
          idempotencyKey: 'create-once',
        }),
      );
      const repeated = toolValue(
        await request(fixture.server, 2, 'create_draft', {
          baseRevision: 40,
          operations: [operation],
          idempotencyKey: 'create-once',
        }),
      );
      expect(repeated.draftId).toBe(first.draftId);
      expect(first.generation).toBe(1);

      const updated = toolValue(
        await request(fixture.server, 3, 'update_draft', {
          draftId: first.draftId,
          expectedGeneration: 1,
          candidate: { ...fixture.payload, defaultGroupOrder: fixture.payload.defaultGroupOrder + 1 },
        }),
      );
      expect(updated.generation).toBe(2);
      const stale = await request(fixture.server, 4, 'update_draft', {
        draftId: first.draftId,
        expectedGeneration: 1,
        candidate: fixture.payload,
      });
      const staleError = (stale.result as { structuredContent: { error: { code: string } } }).structuredContent;
      expect(staleError.error.code).toBe('stale_generation');
    } finally {
      await rm(fixture.directory, { recursive: true, force: true });
    }
  });

  it('serializa compare-and-swap entre instâncias independentes do DraftStore', async () => {
    const fixture = await createFixture();
    try {
      const firstStore = new DraftStore(fixture.directory);
      const secondStore = new DraftStore(fixture.directory);
      const draft = await firstStore.create({
        baseRevision: 40,
        basePayload: fixture.payload,
        candidate: fixture.payload,
      });
      const results = await Promise.allSettled([
        firstStore.update({
          draftId: draft.draftId,
          expectedGeneration: 1,
          candidate: { ...fixture.payload, defaultGroupOrder: fixture.payload.defaultGroupOrder + 1 },
        }),
        secondStore.update({
          draftId: draft.draftId,
          expectedGeneration: 1,
          candidate: { ...fixture.payload, defaultGroupOrder: fixture.payload.defaultGroupOrder + 2 },
        }),
      ]);
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
      expect(await firstStore.get(draft.draftId)).toMatchObject({ generation: 2 });
    } finally {
      await rm(fixture.directory, { recursive: true, force: true });
    }
  });

  it('repete exatamente a geração registrada por uma chave de idempotência', async () => {
    const fixture = await createFixture();
    try {
      const draft = await fixture.store.create({
        baseRevision: 40,
        basePayload: fixture.payload,
        candidate: fixture.payload,
      });
      const generationTwo = await fixture.store.update({
        draftId: draft.draftId,
        expectedGeneration: 1,
        candidate: { ...fixture.payload, defaultGroupOrder: fixture.payload.defaultGroupOrder + 1 },
        idempotencyKey: 'first-update',
      });
      await fixture.store.update({
        draftId: draft.draftId,
        expectedGeneration: 2,
        candidate: { ...fixture.payload, defaultGroupOrder: fixture.payload.defaultGroupOrder + 2 },
        idempotencyKey: 'second-update',
      });

      const repeated = await fixture.store.update({
        draftId: draft.draftId,
        expectedGeneration: 1,
        candidate: fixture.payload,
        idempotencyKey: 'first-update',
      });

      expect(repeated).toEqual(generationTwo);
      expect((await fixture.store.get(draft.draftId)).generation).toBe(3);
    } finally {
      await rm(fixture.directory, { recursive: true, force: true });
    }
  });

  it('rejeita argumentos desconhecidos e variantes de escrita ambíguas', async () => {
    const fixture = await createFixture();
    try {
      const unknown = await request(fixture.server, 1, 'get_published_revision', { extra: true });
      expect(toolValue(unknown)).toMatchObject({ error: { code: 'invalid_payload' } });
      const ambiguous = await request(fixture.server, 2, 'create_draft', {
        baseRevision: 40,
        candidate: fixture.payload,
        operations: [],
      });
      expect(toolValue(ambiguous)).toMatchObject({ error: { code: 'invalid_payload' } });
    } finally {
      await rm(fixture.directory, { recursive: true, force: true });
    }
  });

  it('prepara e publica somente o token vinculado à geração aprovada', async () => {
    const fixture = await createFixture();
    try {
      let published = false;
      const publisher: ContentPublisher = {
        getSession: async () => ({ publisherId: 'admin', sessionId: 'session' }),
        publishContent: async ({ payload, expectedRevision }) => {
          published = true;
          return {
            schemaVersion: '1.0.0',
            revision: (expectedRevision ?? 0) + 1,
            payload,
            publishedAt: new Date().toISOString(),
            publishedBy: 'admin',
          };
        },
      };
      const publishingServer = new ContentMcpServer({
        reader: fixture.reader,
        store: new DraftStore(fixture.directory),
        publisher,
      });
      const draft = toolValue(
        await request(publishingServer, 1, 'create_draft', {
          baseRevision: 40,
          operations: [
            {
              op: 'update',
              scope: 'flows',
              id: fixture.payload.flows[0].id,
              patch: { title: 'Publicável' },
            },
          ],
        }),
      );
      const prepared = toolValue(
        await request(publishingServer, 2, 'prepare_publish', {
          draftId: draft.draftId,
          generation: draft.generation,
          expectedRevision: 40,
        }),
      );
      expect(prepared.publishToken).toMatch(/^btp_/);
      const publishedResult = toolValue(
        await request(publishingServer, 3, 'publish_draft', {
          draftId: draft.draftId,
          generation: draft.generation,
          expectedRevision: 40,
          publishToken: prepared.publishToken,
        }),
      );
      expect(published).toBe(true);
      expect(publishedResult.status).toBe('published');
      const replay = await request(publishingServer, 4, 'publish_draft', {
        draftId: draft.draftId,
        generation: draft.generation,
        expectedRevision: 40,
        publishToken: prepared.publishToken,
      });
      const replayError = (replay.result as { structuredContent: { error: { code: string } } }).structuredContent;
      expect(replayError.error.code).toBe('token_expired');
    } finally {
      await rm(fixture.directory, { recursive: true, force: true });
    }
  });

  it('rejeita publicação quando a sessão muda depois da preparação', async () => {
    const fixture = await createFixture();
    try {
      let sessionId = 'session-one';
      let published = false;
      const publisher: ContentPublisher = {
        getSession: async () => ({ publisherId: 'admin', sessionId }),
        publishContent: async () => {
          published = true;
          throw new Error('não deveria publicar');
        },
      };
      const publishingServer = new ContentMcpServer({
        reader: fixture.reader,
        store: new DraftStore(fixture.directory),
        publisher,
      });
      const draft = toolValue(
        await request(publishingServer, 1, 'create_draft', {
          baseRevision: 40,
          operations: [
            {
              op: 'update',
              scope: 'flows',
              id: fixture.payload.flows[0].id,
              patch: { title: 'Sessão vinculada' },
            },
          ],
        }),
      );
      const prepared = toolValue(
        await request(publishingServer, 2, 'prepare_publish', {
          draftId: draft.draftId,
          generation: draft.generation,
          expectedRevision: 40,
        }),
      );
      sessionId = 'session-two';

      const response = await request(publishingServer, 3, 'publish_draft', {
        draftId: draft.draftId,
        generation: draft.generation,
        expectedRevision: 40,
        publishToken: prepared.publishToken,
      });

      expect(toolValue(response)).toMatchObject({ error: { code: 'unauthorized' } });
      expect(published).toBe(false);
    } finally {
      await rm(fixture.directory, { recursive: true, force: true });
    }
  });
});
