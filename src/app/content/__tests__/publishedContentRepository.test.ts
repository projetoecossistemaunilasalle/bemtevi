import { describe, expect, it, vi, type Mock } from 'vitest';
import {
  createPublishedContentRepository,
  PublishedContentRepositoryError,
  type PublishedContentGateway,
} from '../publishedContentRepository';
import {
  parsePublishedContentRow,
  PUBLISHED_CONTENT_SCHEMA_VERSION,
  type PublishedContentPayload,
  type PublishedContentRow,
} from '../publishedContent';

type FakeGateway = {
  [K in keyof PublishedContentGateway]: Mock<PublishedContentGateway[K]>;
};

const review = { status: 'approved' as const, reviewedBy: 'a', reviewedAt: 'b', notes: '' };

function buildValidPayload(): PublishedContentPayload {
  return {
    flows: [
      {
        id: 'f1',
        version: '1.0.0',
        locale: 'pt-BR',
        title: 'Fluxo',
        type: 'guided_conversation',
        status: 'approved',
        entry: { nodeId: 'n1', enteringPhrases: ['ola'], transitionMessage: 'Oi' },
        nodes: {
          n1: {
            id: 'n1',
            text: 'Oi',
            kind: 'choice',
            options: [{ id: 'o1', label: 'Sim', next: 'n1' }],
          },
        },
      },
    ],
    educationMaterials: [
      {
        id: 'm1',
        title: 'Titulo',
        source: 'Fonte',
        description: 'Desc',
        tags: ['x'],
        audience: 'teachers',
        review,
      },
    ],
    educationGroups: [{ id: 'g1', title: 'Grupo', order: 1 }],
    contacts: [
      {
        id: 'c1',
        name: 'Nome',
        type: 'tipo',
        city: 'Cidade',
        state: 'SP',
        address: 'Rua',
        phoneDisplay: '119',
        phoneHref: 'tel:119',
        badgeTone: 'primary',
        review,
      },
    ],
    defaultGroupOrder: 1,
  };
}

function buildValidRow(overrides: Partial<PublishedContentRow> = {}): PublishedContentRow {
  return {
    id: 'current',
    schema_version: PUBLISHED_CONTENT_SCHEMA_VERSION,
    revision: 3,
    payload: buildValidPayload(),
    published_at: '2026-01-01T00:00:00.000Z',
    published_by: 'pub-1',
    ...overrides,
  };
}

function createFakeGateway(overrides: Partial<FakeGateway> = {}): FakeGateway {
  return {
    readCurrent: vi.fn().mockResolvedValue({ data: null, error: null }),
    insertCurrent: vi.fn().mockResolvedValue({ data: null, error: null }),
    updateCurrent: vi.fn().mockResolvedValue({ data: null, error: null }),
    ...overrides,
  };
}

describe('PublishedContentRepository', () => {
  it('returns null when the current row does not exist', async () => {
    const gateway = createFakeGateway({
      readCurrent: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    const repo = createPublishedContentRepository(gateway);

    await expect(repo.loadPublishedContent()).resolves.toBeNull();
  });

  it('parses and returns the current row', async () => {
    const row = buildValidRow();
    const gateway = createFakeGateway({
      readCurrent: vi.fn().mockResolvedValue({ data: row, error: null }),
    });
    const repo = createPublishedContentRepository(gateway);

    await expect(repo.loadPublishedContent()).resolves.toEqual(parsePublishedContentRow(row));
  });

  it('inserts revision 1 when expectedRevision is null', async () => {
    const insertedRow = buildValidRow({ revision: 1 });
    const gateway = createFakeGateway({
      insertCurrent: vi.fn().mockResolvedValue({ data: insertedRow, error: null }),
    });
    const repo = createPublishedContentRepository(gateway);

    await repo.publishContent({ payload: buildValidPayload(), expectedRevision: null, publisherId: 'pub-9' });

    expect(gateway.insertCurrent).toHaveBeenCalledTimes(1);
    const [inserted] = gateway.insertCurrent.mock.calls[0] as unknown[];
    expect((inserted as { revision: number }).revision).toBe(1);
    expect((inserted as { id: string }).id).toBe('current');
  });

  it('updates revision N to N+1 using the expected revision', async () => {
    const expected = 7;
    const returnedRow = buildValidRow({ revision: expected + 1, published_by: 'pub-9' });
    const gateway = createFakeGateway({
      updateCurrent: vi.fn().mockResolvedValue({ data: returnedRow, error: null }),
    });
    const repo = createPublishedContentRepository(gateway);

    const result = await repo.publishContent({
      payload: buildValidPayload(),
      expectedRevision: expected,
      publisherId: 'pub-9',
    });

    expect(gateway.updateCurrent).toHaveBeenCalledTimes(1);
    const [revisionArg, updateArg] = gateway.updateCurrent.mock.calls[0] as unknown[];
    expect(revisionArg).toBe(expected);
    expect((updateArg as { revision: number }).revision).toBe(expected + 1);
    expect((updateArg as { id?: string }).id).toBeUndefined();
    expect((updateArg as { payload: PublishedContentPayload }).payload).toEqual(buildValidPayload());
    expect(result.revision).toBe(expected + 1);
    expect(result.publishedBy).toBe('pub-9');
  });

  it('maps an empty conditional update to conflict', async () => {
    const gateway = createFakeGateway({
      updateCurrent: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    const repo = createPublishedContentRepository(gateway);

    await expect(
      repo.publishContent({ payload: buildValidPayload(), expectedRevision: 2, publisherId: 'pub-9' }),
    ).rejects.toMatchObject({ code: 'conflict' });
  });

  it('maps PostgreSQL 23505 on first insert to conflict', async () => {
    const gateway = createFakeGateway({
      insertCurrent: vi.fn().mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate' } }),
    });
    const repo = createPublishedContentRepository(gateway);

    await expect(
      repo.publishContent({ payload: buildValidPayload(), expectedRevision: null, publisherId: 'pub-9' }),
    ).rejects.toMatchObject({ code: 'conflict' });
  });

  it('maps the 42501 code to unauthorized', async () => {
    const gateway = createFakeGateway({
      insertCurrent: vi.fn().mockResolvedValue({ data: null, error: { code: '42501', message: 'permissao negada' } }),
    });
    const repo = createPublishedContentRepository(gateway);

    await expect(
      repo.publishContent({ payload: buildValidPayload(), expectedRevision: null, publisherId: 'pub-9' }),
    ).rejects.toMatchObject({ code: 'unauthorized' });
  });

  it('maps missing-auth-token errors to unauthorized', async () => {
    const gateway = createFakeGateway({
      updateCurrent: vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST301', message: 'Missing auth token' },
      }),
    });
    const repo = createPublishedContentRepository(gateway);

    await expect(
      repo.publishContent({ payload: buildValidPayload(), expectedRevision: 3, publisherId: 'pub-9' }),
    ).rejects.toMatchObject({ code: 'unauthorized' });
  });

  it('maps invalid rows to invalid_payload', async () => {
    const malformed = buildValidRow({ revision: 'not-a-number' as unknown as number });
    const gateway = createFakeGateway({
      readCurrent: vi.fn().mockResolvedValue({ data: malformed, error: null }),
    });
    const repo = createPublishedContentRepository(gateway);

    await expect(repo.loadPublishedContent()).rejects.toBeInstanceOf(PublishedContentRepositoryError);
    await expect(repo.loadPublishedContent()).rejects.toMatchObject({ code: 'invalid_payload' });
  });

  it('maps an unexpected DataApiError code to unavailable without leaking the server message', async () => {
    const gateway = createFakeGateway({
      readCurrent: vi.fn().mockResolvedValue({
        data: null,
        error: { code: '42P01', message: 'relation "published_content" does not exist' },
      }),
    });
    const repo = createPublishedContentRepository(gateway);

    let thrown: unknown;
    try {
      await repo.loadPublishedContent();
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(PublishedContentRepositoryError);
    const error = thrown as PublishedContentRepositoryError;
    expect(error.code).toBe('unavailable');
    expect(error.message).not.toContain('published_content');
    expect(error.message).not.toContain('42P01');
  });

  it('maps a thrown non-auth gateway error to unavailable without leaking the server message', async () => {
    const gateway = createFakeGateway({
      readCurrent: vi.fn().mockRejectedValue(new Error('boom from network layer')),
    });
    const repo = createPublishedContentRepository(gateway);

    let thrown: unknown;
    try {
      await repo.loadPublishedContent();
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(PublishedContentRepositoryError);
    const error = thrown as PublishedContentRepositoryError;
    expect(error.code).toBe('unavailable');
    expect(error.message).not.toContain('boom');
  });

  it('rejects oversized payloads before calling the gateway', async () => {
    const gateway = createFakeGateway();
    const repo = createPublishedContentRepository(gateway);
    const big = buildValidPayload();
    big.educationMaterials[0].description = 'x'.repeat(6 * 1024 * 1024);

    await expect(
      repo.publishContent({ payload: big, expectedRevision: null, publisherId: 'pub-9' }),
    ).rejects.toMatchObject({ code: 'invalid_payload' });
    expect(gateway.insertCurrent).not.toHaveBeenCalled();
    expect(gateway.updateCurrent).not.toHaveBeenCalled();
  });
});
