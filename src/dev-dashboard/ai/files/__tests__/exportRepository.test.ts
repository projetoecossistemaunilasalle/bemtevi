import { describe, expect, it } from 'vitest';
import type { EditExport } from '@bemtevi/content-core';
import {
  createExportRepository,
  mapExportTransportError,
  parseEditExport,
  type ExportRpcCallResult,
  type ExportRpcTransport,
} from '../exportRepository';

const VALID_EXPORT: Record<string, unknown> = {
  exportId: '00000000-0000-4000-8000-000000000001',
  draftId: 'current',
  schemaVersion: '2.0.0',
  baseGeneration: 7,
  baseDigest: 'a'.repeat(64),
  publishedRevision: 42,
  basePayload: {
    flows: [],
    educationMaterials: [],
    educationGroups: [],
    contacts: [],
    locations: [],
    defaultGroupOrder: 0,
  },
  canonicalPayload: '{"flows":[]}',
  createdBy: 'user-1',
  createdAt: '2026-01-01T00:00:00Z',
  expiresAt: '2026-01-15T00:00:00Z',
  selection: null,
};

class FakeTransport implements ExportRpcTransport {
  public calls: Array<{ method: string; args: Record<string, unknown> }> = [];
  public response: ExportRpcCallResult = { data: { ok: true, data: VALID_EXPORT }, error: null };
  public throwOnCall = false;

  async rpc(method: string, args: Record<string, unknown>): Promise<ExportRpcCallResult> {
    if (this.throwOnCall) throw new Error('network down');
    this.calls.push({ method, args });
    return this.response;
  }
}

function okEnvelope(data: unknown): ExportRpcCallResult {
  return { data: { ok: true, data }, error: null };
}

describe('exportRepository RPC mapping', () => {
  it('create maps create_content_edit_export with exact snake_case parameters', async () => {
    const transport = new FakeTransport();
    const repository = createExportRepository(transport);
    const result = await repository.create('00000000-0000-4000-8000-000000000009', 12, null);

    expect(transport.calls).toEqual([
      {
        method: 'create_content_edit_export',
        args: {
          p_export_id: '00000000-0000-4000-8000-000000000009',
          p_expected_generation: 12,
          p_selection: null,
        },
      },
    ]);
    expect(result.ok).toBe(true);
  });

  it('create sends the selection object verbatim', async () => {
    const transport = new FakeTransport();
    const repository = createExportRepository(transport);
    await repository.create('00000000-0000-4000-8000-000000000009', 12, {
      scope: 'educationMaterials',
      ids: ['m1', 'm2'],
    });

    expect(transport.calls[0]!.args['p_selection']).toEqual({
      scope: 'educationMaterials',
      ids: ['m1', 'm2'],
    });
  });

  it('get maps get_content_edit_export with the export id parameter', async () => {
    const transport = new FakeTransport();
    const repository = createExportRepository(transport);
    const result = await repository.get('00000000-0000-4000-8000-000000000001');

    expect(transport.calls).toEqual([
      { method: 'get_content_edit_export', args: { p_export_id: '00000000-0000-4000-8000-000000000001' } },
    ]);
    expect(result.ok === true && result.data.exportId).toBe('00000000-0000-4000-8000-000000000001');
  });

  it('retrieves the same durable export across sessions (idempotent owner read)', async () => {
    const transport = new FakeTransport();
    const repository = createExportRepository(transport);
    const first = await repository.get('00000000-0000-4000-8000-000000000001');
    const second = await repository.get('00000000-0000-4000-8000-000000000001');
    expect(first).toEqual(second);
  });

  it('decodes the decoded EditExport structurally', async () => {
    const transport = new FakeTransport();
    transport.response = okEnvelope({
      ...VALID_EXPORT,
      selection: { scope: 'contacts', ids: ['c1'] },
    });
    const repository = createExportRepository(transport);
    const result = await repository.get('00000000-0000-4000-8000-000000000001');
    expect(result.ok === true && result.data.selection).toEqual({ scope: 'contacts', ids: ['c1'] });
    expect(result.ok === true && result.data.basePayload.defaultGroupOrder).toBe(0);
  });

  it('passes domain errors through with the frozen codes', async () => {
    const transport = new FakeTransport();
    transport.response = { data: { ok: false, error: { code: 'export_base_unavailable' } }, error: null };
    const repository = createExportRepository(transport);
    const result = await repository.get('00000000-0000-4000-8000-000000000001');
    expect(result.ok === false && result.error.code).toBe('export_base_unavailable');
  });

  it('maps transport rejections to unauthorized/unavailable', async () => {
    const repository = createExportRepository({
      async rpc(_method, _args) {
        return { data: null, error: { status: 401 } };
      },
    });
    const result = await repository.get('x');
    expect(result.ok === false && result.error.code).toBe('unauthorized');

    const offline = createExportRepository({
      async rpc() {
        throw new Error('offline');
      },
    });
    const offlineResult = await offline.get('x');
    expect(offlineResult.ok === false && offlineResult.error.code).toBe('unavailable');
  });

  it('returns unavailable for malformed envelopes and malformed exports', async () => {
    const malformedEnvelope = createExportRepository({
      async rpc() {
        return { data: { unexpected: true }, error: null };
      },
    });
    const malformedResult = await malformedEnvelope.get('x');
    expect(malformedResult.ok === false && malformedResult.error.code).toBe('unavailable');

    const malformedExport = createExportRepository({
      async rpc() {
        return okEnvelope({ ...VALID_EXPORT, baseDigest: 'nothex' });
      },
    });
    const malformedExportResult = await malformedExport.get('x');
    expect(malformedExportResult.ok === false && malformedExportResult.error.code).toBe('unavailable');
  });
});

describe('parseEditExport structural decoding', () => {
  it('rejects invalid selection shapes and non-current drafts', () => {
    expect(parseEditExport({ ...VALID_EXPORT, draftId: 'other' })).toBeNull();
    expect(parseEditExport({ ...VALID_EXPORT, selection: { scope: 'flows', ids: [] } })).toBeNull();
    expect(parseEditExport({ ...VALID_EXPORT, selection: { scope: 'nope', ids: ['a'] } })).toBeNull();
    expect(parseEditExport({ ...VALID_EXPORT, selection: { scope: 'flows', ids: ['a', 'a'] } })).toBeNull();
  });

  it('maps HTTP-level failures exactly as doc 14 prescribes', () => {
    expect(mapExportTransportError({ code: '42501' }).code).toBe('unauthorized');
    expect(mapExportTransportError({ status: 403 }).code).toBe('unauthorized');
    expect(mapExportTransportError({ code: 'PGRST301' }).code).toBe('unauthorized');
    expect(mapExportTransportError(new Error('boom')).code).toBe('unavailable');
  });
});

describe('exportRepository typing safety', () => {
  it('never receives a Neon client or any-cast escape (structural transport only)', () => {
    const transport: ExportRpcTransport = new FakeTransport();
    const repository: {
      create(id: string, generation: number, selection: EditExport['selection'] | null): Promise<unknown>;
      get(id: string): Promise<unknown>;
    } = createExportRepository(transport);
    expect(typeof repository.create).toBe('function');
    expect(typeof repository.get).toBe('function');
  });
});
