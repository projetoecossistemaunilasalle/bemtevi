import { describe, expect, it, vi, type Mock } from 'vitest';
import { createPageViewRepository, PageViewRepositoryError, type PageViewGateway } from '../pageViewRepository';

type FakeGateway = {
  [K in keyof PageViewGateway]: Mock<PageViewGateway[K]>;
};

function createGateway(overrides: Partial<FakeGateway> = {}): FakeGateway {
  return {
    increment: vi.fn().mockResolvedValue({ error: null }),
    listFrom: vi.fn().mockResolvedValue({ data: [], error: null }),
    ...overrides,
  };
}

describe('PageViewRepository', () => {
  it('increments only the canonical route passed by the tracker', async () => {
    const gateway = createGateway();
    const repository = createPageViewRepository(gateway);

    await repository.recordPageView('/educacao/:resourceId');

    expect(gateway.increment).toHaveBeenCalledWith('/educacao/:resourceId');
  });

  it('parses aggregate rows and accepts bigint values serialized as strings', async () => {
    const gateway = createGateway({
      listFrom: vi.fn().mockResolvedValue({
        data: [
          { view_date: '2026-07-29', route: '/apoio', view_count: 4 },
          { view_date: '2026-07-30', route: '/', view_count: '12' },
        ],
        error: null,
      }),
    });
    const repository = createPageViewRepository(gateway);

    await expect(repository.loadPageViewCounts('2026-07-01')).resolves.toEqual([
      { date: '2026-07-29', route: '/apoio', count: 4 },
      { date: '2026-07-30', route: '/', count: 12 },
    ]);
    expect(gateway.listFrom).toHaveBeenCalledWith('2026-07-01');
  });

  it('rejects unknown routes or malformed aggregate values', async () => {
    const gateway = createGateway({
      listFrom: vi.fn().mockResolvedValue({
        data: [{ view_date: '2026-07-30', route: '/login', view_count: 1 }],
        error: null,
      }),
    });
    const repository = createPageViewRepository(gateway);

    await expect(repository.loadPageViewCounts('2026-07-01')).rejects.toMatchObject({
      code: 'invalid_data',
    });
  });

  it('rejects an invalid start date before querying Neon', async () => {
    const gateway = createGateway();
    const repository = createPageViewRepository(gateway);

    await expect(repository.loadPageViewCounts('30/07/2026')).rejects.toMatchObject({
      code: 'invalid_data',
    });
    expect(gateway.listFrom).not.toHaveBeenCalled();
  });

  it('maps authorization failures without exposing server details', async () => {
    const gateway = createGateway({
      listFrom: vi.fn().mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'secret database policy details' },
      }),
    });
    const repository = createPageViewRepository(gateway);

    let thrown: unknown;
    try {
      await repository.loadPageViewCounts('2026-07-01');
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(PageViewRepositoryError);
    expect(thrown).toMatchObject({ code: 'unauthorized' });
    expect((thrown as Error).message).not.toContain('secret');
  });

  it('maps network failures to a safe unavailable error', async () => {
    const gateway = createGateway({
      increment: vi.fn().mockRejectedValue(new Error('network internals')),
    });
    const repository = createPageViewRepository(gateway);

    await expect(repository.recordPageView('/')).rejects.toMatchObject({
      code: 'unavailable',
    });
  });
});
