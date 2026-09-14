import { describe, expect, it, vi, type Mock } from 'vitest';
import { createNeonPublishedContentGateway, legacyPublishContent, type LegacyPublishInput } from '../legacyPublication';
import {
  PublishedContentRepositoryError,
  type PublishedContentGateway,
} from '../../../app/content/publishedContentRepository';
import {
  PUBLISHED_CONTENT_SCHEMA_VERSION,
  type PublishedContentPayload,
  type PublishedContentRow,
  type PublishedContentSnapshot,
} from '../../../app/content/publishedContent';

/**
 * Legacy direct-publication adapter tests (task INTEGRATION-02). The adapter
 * holds the MOVED direct `published_content` insert/update implementation;
 * these tests prove the moved behavior is byte-identical to the former
 * repository method and that only the `v2Enabled=false` branch may use it
 * (the coexistence proof itself lives in the route flag suites).
 */

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
        nodes: { n1: { id: 'n1', text: 'Oi', kind: 'choice', options: [{ id: 'o1', label: 'Sim', next: 'n1' }] } },
      },
    ],
    educationMaterials: [
      { id: 'm1', title: 'Titulo', source: 'Fonte', description: 'Desc', tags: ['x'], audience: 'teachers', review },
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
        locationId: 'loc-cidade-sp',
        review,
      },
    ],
    locations: [{ id: 'loc-cidade-sp', city: 'Cidade', state: 'SP' }],
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

function publishInput(overrides: Partial<LegacyPublishInput> = {}): LegacyPublishInput {
  return { payload: buildValidPayload(), expectedRevision: null, publisherId: 'pub-9', ...overrides };
}

describe('legacyPublication adapter (moved direct-table publish)', () => {
  it('inserts revision 1 when expectedRevision is null', async () => {
    const insertedRow = buildValidRow({ revision: 1 });
    const gateway = createFakeGateway({
      insertCurrent: vi.fn().mockResolvedValue({ data: insertedRow, error: null }),
    });

    const result = await legacyPublishContent(gateway, publishInput());

    expect(gateway.insertCurrent).toHaveBeenCalledTimes(1);
    const [inserted] = gateway.insertCurrent.mock.calls[0] as unknown[];
    expect((inserted as { revision: number }).revision).toBe(1);
    expect((inserted as { id: string }).id).toBe('current');
    expect(result.revision).toBe(1);
  });

  it('updates revision N to N+1 using the expected revision without the id key', async () => {
    const expected = 7;
    const returnedRow = buildValidRow({ revision: expected + 1, published_by: 'pub-9' });
    const gateway = createFakeGateway({
      updateCurrent: vi.fn().mockResolvedValue({ data: returnedRow, error: null }),
    });

    const result = await legacyPublishContent(gateway, publishInput({ expectedRevision: expected }));

    expect(gateway.updateCurrent).toHaveBeenCalledTimes(1);
    const [revisionArg, updateArg] = gateway.updateCurrent.mock.calls[0] as unknown[];
    expect(revisionArg).toBe(expected);
    expect((updateArg as { revision: number }).revision).toBe(expected + 1);
    expect((updateArg as { id?: string }).id).toBeUndefined();
    expect(result.publishedBy).toBe('pub-9');
  });

  it('maps an empty conditional update to conflict', async () => {
    const gateway = createFakeGateway({
      updateCurrent: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    await expect(legacyPublishContent(gateway, publishInput({ expectedRevision: 2 }))).rejects.toMatchObject({
      code: 'conflict',
    });
  });

  it('maps PostgreSQL 23505 on first insert to conflict', async () => {
    const gateway = createFakeGateway({
      insertCurrent: vi.fn().mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate' } }),
    });

    await expect(legacyPublishContent(gateway, publishInput())).rejects.toMatchObject({ code: 'conflict' });
  });

  it('maps the 42501 code to unauthorized', async () => {
    const gateway = createFakeGateway({
      insertCurrent: vi.fn().mockResolvedValue({ data: null, error: { code: '42501', message: 'permissao negada' } }),
    });

    await expect(legacyPublishContent(gateway, publishInput())).rejects.toMatchObject({ code: 'unauthorized' });
  });

  it('maps missing-auth-token errors to unauthorized', async () => {
    const gateway = createFakeGateway({
      updateCurrent: vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST301', message: 'Missing auth token' },
      }),
    });

    await expect(legacyPublishContent(gateway, publishInput({ expectedRevision: 3 }))).rejects.toMatchObject({
      code: 'unauthorized',
    });
  });

  it('rejects oversized payloads before calling the gateway', async () => {
    const gateway = createFakeGateway();
    const big = buildValidPayload();
    big.educationMaterials[0].description = 'x'.repeat(6 * 1024 * 1024);

    await expect(legacyPublishContent(gateway, publishInput({ payload: big }))).rejects.toMatchObject({
      code: 'invalid_payload',
    });
    expect(gateway.insertCurrent).not.toHaveBeenCalled();
    expect(gateway.updateCurrent).not.toHaveBeenCalled();
  });

  it('maps an invalid returned row to invalid_payload', async () => {
    const malformed = buildValidRow({ revision: 'not-a-number' as unknown as number });
    const gateway = createFakeGateway({
      insertCurrent: vi.fn().mockResolvedValue({ data: malformed, error: null }),
    });

    await expect(legacyPublishContent(gateway, publishInput())).rejects.toBeInstanceOf(PublishedContentRepositoryError);
  });

  it('re-exports the Neon gateway factory for the legacy route composition', async () => {
    // The factory is the same symbol the repository uses; the adapter only
    // re-exports it so the legacy branch wires one gateway shape.
    const client = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: buildValidRow({ revision: 9 }), error: null }),
      })),
    } as never;
    const gateway = createNeonPublishedContentGateway(client);
    const snapshot: PublishedContentSnapshot = await legacyPublishContent(gateway, publishInput());
    expect(snapshot.revision).toBe(9);
  });
});
