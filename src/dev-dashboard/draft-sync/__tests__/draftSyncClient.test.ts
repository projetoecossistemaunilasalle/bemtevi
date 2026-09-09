import { describe, expect, it, vi } from 'vitest';
import type { PublishedContentPayload } from '../../../app/content/publishedContent';
import {
  DraftSyncClient,
  DraftSyncError,
  digestContent,
  normalizeDraftSyncUrl,
  pairDraftSync,
} from '../draftSyncClient';

const payload: PublishedContentPayload = {
  flows: [],
  educationMaterials: [],
  educationGroups: [],
  contacts: [],
  locations: [],
  defaultGroupOrder: 0,
};

function draft(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    draftId: 'draft-123',
    generation: 2,
    base: { revision: 8, digest: 'base-digest', payload },
    candidate: payload,
    candidateDigest: 'candidate-digest',
    validation: { valid: true, issues: [] },
    createdAt: '2026-09-09T12:00:00.000Z',
    updatedAt: '2026-09-09T12:01:00.000Z',
    ...overrides,
  };
}

describe('DraftSyncClient', () => {
  it('pareia a API local sem persistir o código de pareamento', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ token: 'session-token' })));

    await expect(pairDraftSync('http://127.0.0.1:4319', '123456', fetchImpl)).resolves.toBe('session-token');
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://127.0.0.1:4319/v1/pair',
      expect.objectContaining({ body: JSON.stringify({ code: '123456' }) }),
    );
  });

  it('aceita somente a API local e normaliza barras finais', () => {
    expect(normalizeDraftSyncUrl('http://127.0.0.1:4318/')).toBe('http://127.0.0.1:4318');
    expect(normalizeDraftSyncUrl('http://localhost:4318///')).toBe('http://localhost:4318');
    expect(() => normalizeDraftSyncUrl('https://example.com')).toThrow(DraftSyncError);
  });

  it('limita listagens a 100 itens e envia o token sem colocá-lo na URL', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ drafts: [], nextCursor: null })));
    const client = new DraftSyncClient('http://127.0.0.1:4318', { token: 'secret', fetchImpl });

    await client.listDrafts({ limit: 500, cursor: 'next' });

    expect(fetchImpl).toHaveBeenCalledWith(
      'http://127.0.0.1:4318/v1/drafts?limit=100&cursor=next',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer secret' }) }),
    );
  });

  it('preserva candidatos inválidos para recuperação, validando apenas o envelope', async () => {
    const invalidCandidate = { malformed: true };
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ draft: draft({ candidate: invalidCandidate }) }), { status: 200 }),
      );
    const client = new DraftSyncClient('http://127.0.0.1:4318', { fetchImpl });

    const result = await client.getDraft('draft-123', 2);

    expect(result.draftId).toBe('draft-123');
    expect(result.candidate).toEqual(invalidCandidate);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('http://127.0.0.1:4318/v1/drafts/draft-123?generation=2');
  });

  it('envia expectedGeneration e chave de idempotência no corpo ao atualizar', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify(draft({ generation: 3 }))));
    const client = new DraftSyncClient('http://127.0.0.1:4318', { fetchImpl });

    await client.updateDraft({
      draftId: 'draft-123',
      expectedGeneration: 2,
      candidate: payload,
      idempotencyKey: 'request-1',
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'http://127.0.0.1:4318/v1/drafts/draft-123',
      expect.objectContaining({
        method: 'PUT',
        body: expect.stringContaining('"expectedGeneration":2'),
      }),
    );
  });

  it('mapeia conflitos e não expõe mensagens remotas na interface', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ code: 'stale_generation', message: 'payload secreto' }), { status: 409 }),
      );
    const client = new DraftSyncClient('http://127.0.0.1:4318', { fetchImpl });

    await expect(client.getDraft('draft-123')).rejects.toMatchObject({
      code: 'stale_generation',
      message: expect.stringContaining('geração mais recente'),
    });
    await expect(client.getDraft('draft-123')).rejects.not.toThrow('payload secreto');
  });

  it('rejeita respostas maiores que o limite antes de interpretar o JSON', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('1234567890'));
    const client = new DraftSyncClient('http://127.0.0.1:4318', { fetchImpl, maxResponseBytes: 4 });

    await expect(client.listDrafts()).rejects.toMatchObject({ code: 'invalid_payload' });
  });

  it('gera o mesmo digest para objetos com chaves em ordem diferente', async () => {
    await expect(digestContent({ b: 2, a: 1 })).resolves.toBe(await digestContent({ a: 1, b: 2 }));
  });
});
