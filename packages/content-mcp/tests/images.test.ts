import { describe, expect, it } from 'vitest';
import {
  applyOperations,
  conformanceBasePayload,
  sameContent,
  sha256Text,
  type ContentDraft,
  type DraftHead,
  type PublishedContentPayload,
} from '@bemtevi/content-core';
import { PNG_1X1_BASE64 } from '@bemtevi/content-core';
import { createDataApiClientWith } from '../src/client/dataApiClient';
import { BaseSnapshotCache } from '../src/session/baseSnapshotCache';
import { createToolDispatch } from '../src/server/dispatch';
import { registerContentTools } from '../src/tools/definitions';

/**
 * Image tests (MCP-02): the frozen set_material_image contract — uploaded,
 * catalog, external and remove values on the three slot kinds; byte,
 * dimension, megapixel, fileName and alt bounds; protected generic image
 * fields; large images omitted from reads; and no URL fetching.
 */

const CONNECTION_ID = '00000000-0000-4000-8000-0000000000c1';

type Wire = { ok: true; data: unknown } | { ok: false; error: { code: string; message?: string } };

interface FakeState {
  draft: ContentDraft;
  published: { revision: number; payload: PublishedContentPayload; canonicalPayload: string; digest: string };
  calls: Array<{ name: string; args: Record<string, unknown> }>;
  applyBehavior: (expectedGeneration: number, operations: unknown) => Promise<Wire>;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Conformance fixture with its two deliberate semantic errors repaired. */
function validPayload(): PublishedContentPayload {
  const payload = clone(conformanceBasePayload);
  (payload.contacts[0] as unknown as Record<string, unknown>).phoneHref = 'tel:4130000000';
  const flow = payload.flows[0] as unknown as Record<string, unknown>;
  const nodes = flow.nodes as Record<string, Record<string, unknown>>;
  nodes['no-dois'].recommendations = ['material-exemplo'];
  return payload;
}

function headFields(draft: ContentDraft): DraftHead {
  return {
    id: 'current',
    schemaVersion: draft.schemaVersion,
    baseRevision: draft.baseRevision,
    generation: draft.generation,
    digest: draft.digest,
    updatedAt: draft.updatedAt,
    lastActor: draft.lastActor,
  };
}

async function makeDraft(payload: PublishedContentPayload, generation: number): Promise<ContentDraft> {
  const canonicalPayload = JSON.stringify(payload);
  return {
    id: 'current',
    schemaVersion: '1.0.0',
    status: 'active',
    baseRevision: 3,
    generation,
    digest: await sha256Text(canonicalPayload),
    updatedAt: '2026-09-13T00:00:00.000Z',
    lastActor: { kind: 'admin', principalUserId: 'admin-1', connectionId: null },
    payload,
    canonicalPayload,
    createdAt: '2026-09-01T00:00:00.000Z',
    createdBy: 'admin-1',
  };
}

async function defaultApply(state: FakeState, expectedGeneration: number, operations: unknown): Promise<Wire> {
  if (expectedGeneration !== state.draft.generation) return { ok: false, error: { code: 'stale_generation' } };
  const applied = applyOperations(state.draft.payload, operations as never);
  if (applied.ok === false) return { ok: false, error: { code: applied.error.code, message: applied.error.message } };
  const changed = !sameContent(applied.data, state.draft.payload);
  if (changed) state.draft = await makeDraft(applied.data, state.draft.generation + 1);
  return { ok: true, data: { head: headFields(state.draft), changed } };
}

async function makeHarness() {
  const state: FakeState = {
    draft: await makeDraft(validPayload(), 7),
    published: {
      revision: 3,
      payload: clone(conformanceBasePayload),
      canonicalPayload: JSON.stringify(conformanceBasePayload),
      digest: await sha256Text(JSON.stringify(conformanceBasePayload)),
    },
    calls: [],
    applyBehavior: (generation, operations) => defaultApply(state, generation, operations),
  };
  const now = 1_000_000;
  const client = createDataApiClientWith(async (name, args) => {
    state.calls.push({ name, args });
    if (name === 'agent_get_editor_context') {
      return {
        data: {
          ok: true,
          data: {
            head: headFields(state.draft),
            publishedRevision: state.published.revision,
            principalUserId: 'admin-1',
            connectionId: CONNECTION_ID,
            expiresAt: 'e',
          },
        },
      };
    }
    if (name === 'agent_get_draft') return { data: { ok: true, data: state.draft } };
    if (name === 'agent_get_published_content') return { data: { ok: true, data: state.published } };
    if (name === 'agent_apply_operations') {
      return { data: await state.applyBehavior(Number(args['p_expected_generation']), args['p_operations']) };
    }
    return { data: { ok: false, error: { code: 'unavailable' } } };
  });
  const cache = new BaseSnapshotCache({ clock: () => now });
  const dispatch = createToolDispatch();
  registerContentTools(
    {
      client,
      connectionId: CONNECTION_ID,
      agentToken: 'A'.repeat(43),
      clock: () => now,
      delay: () => Promise.resolve(),
      cache,
    },
    dispatch,
  );
  const call = async (name: string, args: Record<string, unknown> = {}) => dispatch.dispatch(name, args);
  return { state, dispatch, cache, call, seed: () => call('get_editor_context') };
}

interface ImageCall {
  materialId?: string;
  slot?: Record<string, unknown>;
  image?: Record<string, unknown>;
  generation?: number;
}

function imageArgs(overrides: ImageCall = {}): Record<string, unknown> {
  return {
    expectedGeneration: overrides.generation ?? 7,
    materialId: overrides.materialId ?? 'material-exemplo',
    slot: overrides.slot ?? { kind: 'featured' },
    image: overrides.image,
  };
}

/** Minimal 33-byte PNG header buffer with the requested dimensions (IHDR first). */
function pngWithDimensions(width: number, height: number): string {
  const bytes = new Uint8Array(33);
  [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].forEach((byte, index) => {
    bytes[index] = byte;
  });
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  view.setUint32(16, width);
  view.setUint32(20, height);
  bytes[24] = 8;
  bytes[25] = 6;
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return globalThis.btoa(binary);
}

const UPLOADED = {
  kind: 'uploaded',
  mime: 'image/png',
  base64: PNG_1X1_BASE64,
  fileName: 'destaque.png',
  alt: 'Destaque',
};

describe('set_material_image success paths', () => {
  it('sets an uploaded featured image, advances the generation, and caches the candidate unverified', async () => {
    const { call, seed, state } = await makeHarness();
    await seed();
    const result = await call('set_material_image', imageArgs({ image: UPLOADED }));
    expect(result.ok).toBe(true);
    const data = result.data as { head: DraftHead; changed: boolean; merged: boolean; validation: { valid: boolean } };
    expect(data.head.generation).toBe(8);
    expect(data.changed).toBe(true);
    expect(data.merged).toBe(false);
    expect(data.validation.valid).toBe(true);
    const featured = (state.draft.payload.educationMaterials[0] as unknown as Record<string, unknown>)
      .featuredImage as Record<string, unknown>;
    expect(featured).toMatchObject({ kind: 'uploaded', alt: 'Destaque', fileName: 'destaque.png' });
    expect(
      state.calls.every((entry) =>
        ['agent_get_editor_context', 'agent_get_draft', 'agent_apply_operations'].includes(entry.name),
      ),
    ).toBe(true);
    const staleRead = await call('get_item', { generation: 8, scope: 'educationMaterials', id: 'material-exemplo' });
    expect(staleRead.error?.code).toBe('rebase_required');
    await seed();
    const refreshed = await call('get_item', { generation: 8, scope: 'educationMaterials', id: 'material-exemplo' });
    expect(refreshed.ok).toBe(true);
  });

  it('sets catalog, external, and remove values on the featured slot', async () => {
    const { call, seed, state } = await makeHarness();
    await seed();
    const catalog = await call('set_material_image', imageArgs({ image: { kind: 'catalog', imageId: 'green-patch' } }));
    expect(catalog.ok).toBe(true);
    expect(
      (state.draft.payload.educationMaterials[0] as unknown as Record<string, unknown>).featuredImage,
    ).toMatchObject({ kind: 'catalog', imageId: 'green-patch' });
    // Each mutation needs a fresh verified base: candidates stay unverified
    // until a full fetch verifies the server digest (doc 04).
    await seed();
    const external = await call(
      'set_material_image',
      imageArgs({
        generation: 8,
        image: { kind: 'external', url: 'https://exemplo.bemtevi.org/nova.png', alt: 'Nova' },
      }),
    );
    expect(external.ok).toBe(true);
    expect(
      (state.draft.payload.educationMaterials[0] as unknown as Record<string, unknown>).featuredImage,
    ).toMatchObject({ kind: 'external' });
    await seed();
    const removed = await call('set_material_image', imageArgs({ generation: 9, image: { kind: 'remove' } }));
    expect(removed.ok).toBe(true);
    expect(
      (state.draft.payload.educationMaterials[0] as unknown as Record<string, unknown>).featuredImage,
    ).toBeUndefined();
  });

  it('handles the legacy and body slots through the same contract', async () => {
    const { call, seed, state } = await makeHarness();
    await seed();
    const legacy = await call(
      'set_material_image',
      imageArgs({ slot: { kind: 'legacy' }, image: { ...UPLOADED, fileName: 'legada.png', alt: '' } }),
    );
    expect(legacy.ok).toBe(true);
    const material = state.draft.payload.educationMaterials[0] as unknown as Record<string, unknown>;
    expect(material.imageUrl).toContain('data:image/png;base64,');
    expect(material.imageFileName).toBe('legada.png');
    await seed();
    const body = await call(
      'set_material_image',
      imageArgs({
        generation: 8,
        slot: { kind: 'body', blockId: 'bloco-imagem' },
        image: { ...UPLOADED, fileName: 'corpo.png', alt: 'Corpo' },
      }),
    );
    expect(body.ok).toBe(true);
  });
});

describe('set_material_image rejections', () => {
  it('rejects legacy catalog values and non-empty legacy alt', async () => {
    const { call, seed } = await makeHarness();
    await seed();
    const catalog = await call(
      'set_material_image',
      imageArgs({ slot: { kind: 'legacy' }, image: { kind: 'catalog', imageId: 'green-patch' } }),
    );
    expect(catalog.error?.code).toBe('invalid_image');
    const alt = await call(
      'set_material_image',
      imageArgs({ slot: { kind: 'legacy' }, image: { ...UPLOADED, alt: 'texto' } }),
    );
    expect(alt.error?.code).toBe('invalid_image');
  });

  it('rejects non-PNG/JPEG/WebP uploads and oversized decoded bytes', async () => {
    const { call, seed } = await makeHarness();
    await seed();
    const mime = await call('set_material_image', imageArgs({ image: { ...UPLOADED, mime: 'image/gif' } }));
    expect(mime.error?.code).toBe('invalid_image');
    const hugeBase64 = 'QUFB'.repeat(466668);
    const oversize = await call('set_material_image', imageArgs({ image: { ...UPLOADED, base64: hugeBase64 } }));
    expect(oversize.error?.code).toBe('invalid_image');
  });

  it('enforces per-dimension and megapixel bounds through container inspection', async () => {
    const { call, seed } = await makeHarness();
    await seed();
    const tooWide = await call(
      'set_material_image',
      imageArgs({ image: { ...UPLOADED, base64: pngWithDimensions(5000, 100) } }),
    );
    expect(tooWide.error?.code).toBe('invalid_image');
    const megapixels = await call(
      'set_material_image',
      imageArgs({ image: { ...UPLOADED, base64: pngWithDimensions(4096, 4096) } }),
    );
    expect(megapixels.error?.code).toBe('invalid_image');
  });

  it('enforces fileName and alt bounds', async () => {
    const { call, seed } = await makeHarness();
    await seed();
    const separator = await call('set_material_image', imageArgs({ image: { ...UPLOADED, fileName: 'a/b.png' } }));
    expect(separator.error?.code).toBe('invalid_image');
    const tooLong = await call('set_material_image', imageArgs({ image: { ...UPLOADED, fileName: 'f'.repeat(121) } }));
    expect(tooLong.error?.code).toBe('invalid_image');
    const alt = await call('set_material_image', imageArgs({ image: { ...UPLOADED, alt: 'a'.repeat(501) } }));
    expect(alt.error?.code).toBe('invalid_image');
  });

  it('rejects non-HTTPS external URLs and missing body blocks', async () => {
    const { call, seed } = await makeHarness();
    await seed();
    const http = await call(
      'set_material_image',
      imageArgs({ image: { kind: 'external', url: 'http://exemplo.bemtevi.org/x.png', alt: '' } }),
    );
    expect(http.error?.code).toBe('invalid_image');
    const missingBlock = await call(
      'set_material_image',
      imageArgs({ slot: { kind: 'body', blockId: 'bloco-inexistente' }, image: { ...UPLOADED } }),
    );
    expect(missingBlock.error?.code).toBe('invalid_image');
  });

  it('rejects unknown materials with invalid_input before any RPC call', async () => {
    const { call, seed, state } = await makeHarness();
    await seed();
    const callsBefore = state.calls.length;
    const missing = await call('set_material_image', imageArgs({ materialId: 'material-outro', image: UPLOADED }));
    expect(missing.error?.code).toBe('invalid_input');
    expect(state.calls.length).toBe(callsBefore);
  });

  it('requires the cached base and fails safely without it', async () => {
    const { call } = await makeHarness();
    const result = await call('set_material_image', imageArgs({ image: UPLOADED }));
    expect(result.error?.code).toBe('rebase_required');
  });
});

describe('protected image fields and read omission', () => {
  it('rejects generic operations that name protected image fields', async () => {
    const { call, seed } = await makeHarness();
    await seed();
    const patch = await call('apply_operations', {
      expectedGeneration: 7,
      operations: [
        {
          op: 'update',
          scope: 'educationMaterials',
          id: 'material-exemplo',
          patch: { imageUrl: 'https://exemplo.bemtevi.org/x.png' },
          unset: [],
        },
      ],
    });
    expect(patch.error?.code).toBe('invalid_operations');
  });

  it('omits large images from get_item and get_diff reads', async () => {
    const { call, seed } = await makeHarness();
    await seed();
    await call('set_material_image', imageArgs({ image: UPLOADED }));
    await seed();
    const item = await call('get_item', { generation: 8, scope: 'educationMaterials', id: 'material-exemplo' });
    const text = (item.data as { jsonText: string }).jsonText;
    expect(text).toContain('[embedded image omitted]');
    expect(text).not.toContain('iVBOR');
    const diff = await call('get_diff', { generation: 8 });
    expect(diff.ok).toBe(true);
    const data = diff.data as { publishedRevision: number; changes: Array<{ kind: string; afterPreview: string }> };
    expect(data.publishedRevision).toBe(3);
    const serialized = JSON.stringify(data.changes);
    expect(serialized).toContain('[embedded image omitted]');
    expect(serialized).not.toContain('iVBOR');
  });

  it('never fetches URLs or reads the filesystem for image values', async () => {
    const originalFetch = globalThis.fetch;
    let fetchCalls = 0;
    globalThis.fetch = (() => {
      fetchCalls += 1;
      return Promise.reject(new Error('fetch must not be used'));
    }) as typeof fetch;
    try {
      const { call, seed } = await makeHarness();
      await seed();
      const external = await call(
        'set_material_image',
        imageArgs({ image: { kind: 'external', url: 'https://exemplo.bemtevi.org/x.png', alt: '' } }),
      );
      expect(external.ok).toBe(true);
      await seed();
      const read = await call('get_item', { generation: 8, scope: 'educationMaterials', id: 'material-exemplo' });
      expect(read.ok).toBe(true);
      expect(fetchCalls).toBe(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
