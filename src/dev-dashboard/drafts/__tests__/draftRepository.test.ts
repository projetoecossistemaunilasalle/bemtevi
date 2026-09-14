import { describe, expect, it } from 'vitest';

import type { ContentDraft, DraftHead, Result } from '@bemtevi/content-core';

import { createDraftRepository, type DraftRpcTransport } from '../draftRepository';

// --- Fake transport ----------------------------------------------------------

interface RecordedCall {
  method: string;
  args: Record<string, unknown>;
}

type ScriptedResponse = { data: unknown; error: unknown } | ((call: RecordedCall) => { data: unknown; error: unknown });

function createFakeTransport(response: ScriptedResponse | null = null) {
  const calls: RecordedCall[] = [];
  const transport: DraftRpcTransport = {
    async rpc(method, args) {
      const call = { method, args };
      calls.push(call);
      if (typeof response === 'function') return response(call);
      if (response === null) throw new Error('network down');
      return { data: response.data, error: response.error ?? null };
    },
  };
  return { transport, calls };
}

// --- Fixtures ----------------------------------------------------------------

const DIGEST_A = 'a'.repeat(64);
const DIGEST_B = 'b'.repeat(64);

function headFixture(overrides: Partial<DraftHead> = {}): DraftHead {
  return {
    id: 'current',
    schemaVersion: '1.0.0',
    baseRevision: 40,
    generation: 51,
    digest: DIGEST_A,
    updatedAt: '2026-09-12T10:00:00.000Z',
    lastActor: { kind: 'admin', principalUserId: 'admin-1', connectionId: null },
    ...overrides,
  };
}

const PAYLOAD = {
  flows: [],
  educationMaterials: [],
  educationGroups: [],
  contacts: [],
  locations: [],
  defaultGroupOrder: 0,
};

function draftFixture(overrides: Partial<ContentDraft> = {}): ContentDraft {
  return {
    ...headFixture(),
    status: 'active',
    payload: PAYLOAD,
    canonicalPayload: JSON.stringify(PAYLOAD),
    createdAt: '2026-09-01T08:00:00.000Z',
    createdBy: 'admin-1',
    ...overrides,
  };
}

function okEnvelope(data: unknown): { data: unknown; error: unknown } {
  return { data: { ok: true, data }, error: null };
}

function errorEnvelope(error: unknown): { data: unknown; error: unknown } {
  return { data: { ok: false, error }, error: null };
}

function expectError(result: Result<unknown>, code: string): void {
  expect(result.ok).toBe(false);
  if (result.ok !== false) throw new Error('expected error result');
  expect(result.error.code).toBe(code);
}

// --- Tests -------------------------------------------------------------------

describe('createDraftRepository', () => {
  describe('load (get_content_draft)', () => {
    it('maps the method, decodes the Result envelope and returns the draft', async () => {
      const draft = draftFixture();
      const { transport, calls } = createFakeTransport(okEnvelope(draft));
      const repository = createDraftRepository(transport);
      const result = await repository.load();
      expect(calls).toEqual([{ method: 'get_content_draft', args: {} }]);
      expect(result).toEqual({ ok: true, data: draft });
    });

    it('passes through domain errors including the current head', async () => {
      const head = headFixture();
      const { transport } = createFakeTransport(
        errorEnvelope({ code: 'published_base_unavailable', currentHead: head }),
      );
      const result = await createDraftRepository(transport).load();
      expectError(result, 'published_base_unavailable');
      if (result.ok !== false) throw new Error('unreachable');
      expect(result.error.currentHead).toEqual(head);
    });

    it('maps unknown error codes and malformed envelopes to unavailable', async () => {
      const malformed = createDraftRepository(createFakeTransport({ data: 'not-an-envelope', error: null }).transport);
      expectError(await malformed.load(), 'unavailable');
      const badCode = createDraftRepository(createFakeTransport(errorEnvelope({ code: 'totally-unknown' })).transport);
      expectError(await badCode.load(), 'unavailable');
      const badData = createDraftRepository(createFakeTransport(okEnvelope({ id: 'other' })).transport);
      expectError(await badData.load(), 'unavailable');
    });
  });

  describe('head (get_content_draft_head)', () => {
    it('maps the method and decodes the head without initializing', async () => {
      const head = headFixture({ generation: 52 });
      const { transport, calls } = createFakeTransport(okEnvelope(head));
      const result = await createDraftRepository(transport).head();
      expect(calls).toEqual([{ method: 'get_content_draft_head', args: {} }]);
      expect(result).toEqual({ ok: true, data: head });
    });

    it('rejects a head with a non-hex digest', async () => {
      const { transport } = createFakeTransport(okEnvelope(headFixture({ digest: 'nothex' })));
      expectError(await createDraftRepository(transport).head(), 'unavailable');
    });
  });

  describe('mutate (apply_content_draft_operations)', () => {
    const operations = [{ op: 'set_default_group_order' as const, value: 4 }];
    const input = { expectedGeneration: 51, operations };

    it('maps exact snake_case arguments and decodes the mutation result', async () => {
      const head = headFixture({ generation: 52 });
      const { transport, calls } = createFakeTransport(okEnvelope({ head, changed: true }));
      const result = await createDraftRepository(transport).mutate(input);
      expect(calls).toEqual([
        {
          method: 'apply_content_draft_operations',
          args: { p_expected_generation: 51, p_operations: operations },
        },
      ]);
      expect(result).toEqual({ ok: true, data: { head, changed: true } });
    });

    it('keeps stale_generation errors with their currentHead', async () => {
      const head = headFixture({ generation: 53 });
      const { transport } = createFakeTransport(errorEnvelope({ code: 'stale_generation', currentHead: head }));
      const result = await createDraftRepository(transport).mutate(input);
      expectError(result, 'stale_generation');
      if (result.ok !== false) throw new Error('unreachable');
      expect(result.error.currentHead).toEqual(head);
    });

    it('rejects a success payload without a valid head', async () => {
      const { transport } = createFakeTransport(okEnvelope({ head: null, changed: true }));
      expectError(await createDraftRepository(transport).mutate(input), 'unavailable');
    });
  });

  describe('prepare (prepare_content_draft_publish)', () => {
    const input = {
      preparationId: '0f0e0d0c-0b0a-4948-8476-554433221100',
      generation: 51,
      expectedRevision: 40,
      digest: DIGEST_A,
      tokenHash: DIGEST_B,
    };

    it('maps exact snake_case arguments and never sends a raw token', async () => {
      const preparation = {
        preparationId: input.preparationId,
        draftId: 'current' as const,
        generation: input.generation,
        expectedRevision: input.expectedRevision,
        digest: input.digest,
        expiresAt: '2026-09-12T10:10:00.000Z',
      };
      const { transport, calls } = createFakeTransport(okEnvelope(preparation));
      const result = await createDraftRepository(transport).prepare(input);
      expect(calls).toEqual([
        {
          method: 'prepare_content_draft_publish',
          args: {
            p_preparation_id: input.preparationId,
            p_generation: 51,
            p_expected_revision: 40,
            p_digest: DIGEST_A,
            p_token_hash: DIGEST_B,
          },
        },
      ]);
      expect(result).toEqual({ ok: true, data: preparation });
      expect(Object.keys(calls[0]?.args ?? {}).some((key) => key.toLowerCase() === 'p_token')).toBe(false);
    });

    it('passes through preparation_invalid without optional fields', async () => {
      const { transport } = createFakeTransport(errorEnvelope({ code: 'preparation_invalid' }));
      expectError(await createDraftRepository(transport).prepare(input), 'preparation_invalid');
    });
  });

  describe('publish (publish_content_draft)', () => {
    const preparationId = '0f0e0d0c-0b0a-4948-8476-554433221100';

    it('maps exact snake_case arguments and decodes the publish result', async () => {
      const publishResult = {
        revision: 41,
        publishedAt: '2026-09-12T10:05:00.000Z',
        draftGeneration: 52,
        digest: DIGEST_A,
      };
      const { transport, calls } = createFakeTransport(okEnvelope(publishResult));
      const result = await createDraftRepository(transport).publish(preparationId, 'raw-token');
      expect(calls).toEqual([
        { method: 'publish_content_draft', args: { p_preparation_id: preparationId, p_publish_token: 'raw-token' } },
      ]);
      expect(result).toEqual({ ok: true, data: publishResult });
    });

    it('passes through revision_conflict with currentRevision', async () => {
      const { transport } = createFakeTransport(errorEnvelope({ code: 'revision_conflict', currentRevision: 44 }));
      const result = await createDraftRepository(transport).publish(preparationId, 'raw-token');
      expectError(result, 'revision_conflict');
      if (result.ok !== false) throw new Error('unreachable');
      expect(result.error.currentRevision).toBe(44);
    });
  });

  describe('transport error mapping', () => {
    it.each([
      [{ code: '42501', message: 'permission denied' }, 'unauthorized'],
      [{ status: 401, message: 'unauthorized' }, 'unauthorized'],
      [{ status: 403, message: 'forbidden' }, 'unauthorized'],
      [{ code: 'PGRST301', message: 'JWT invalid' }, 'unauthorized'],
      [{ status: 500, message: 'internal' }, 'unavailable'],
      [{ message: 'connection refused' }, 'unavailable'],
      ['boom', 'unavailable'],
    ])('maps %j to %s', async (transportError, expected) => {
      const { transport } = createFakeTransport({ data: null, error: transportError });
      expectError(await createDraftRepository(transport).load(), expected);
    });

    it('maps a thrown transport exception to unavailable', async () => {
      expectError(await createDraftRepository(createFakeTransport(null).transport).load(), 'unavailable');
    });
  });
});
