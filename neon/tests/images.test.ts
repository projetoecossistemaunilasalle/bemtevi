import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import type { DraftHead } from '@bemtevi/content-core';
import { PNG_1X1_BASE64, type ImageSlot, type ImageValue } from '@bemtevi/content-core';
import type { TGetContentDraft } from './rpc-types';

/**
 * DB-01 live Neon suite: image value contract, decoded byte bounds, container
 * header validation and protected image slot rules (dossier 14/15). Executed
 * by the DB-04 harness; missing environment fails closed (no skip). See
 * drafts.test.ts for the required environment contract.
 */

interface WireResult {
  ok: boolean;
  data?: unknown;
  error?: { code: string };
}

interface Harness {
  owner: Client;
  dataApiUrl: string;
  adminAToken: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`missing required environment variable: ${name}`);
  }
  return value;
}

const harness: Harness = {
  owner: new Client({ connectionString: 'pending' }),
  dataApiUrl: 'pending',
  adminAToken: 'pending',
};

async function callRpc(token: string, functionName: string, args: Record<string, unknown>): Promise<WireResult> {
  const response = await fetch(`${harness.dataApiUrl}/rpc/${functionName}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(args),
  });
  // The Data API denies EXECUTE at the HTTP layer when a role lacks the grant;
  // normalize it to the wrapper's `unauthorized` envelope.
  if (response.status === 401 || response.status === 403 || response.status === 404) {
    return { ok: false, error: { code: 'unauthorized' } } as WireResult;
  }
  return (await response.json()) as WireResult;
}

async function loadHead(): Promise<DraftHead> {
  const result = await callRpc(harness.adminAToken, 'get_content_draft_head', {});
  return (result as { ok: boolean; data?: unknown }).data as DraftHead;
}

async function loadDraft(): Promise<TGetContentDraft> {
  const result = await callRpc(harness.adminAToken, 'get_content_draft', {});
  return (result as { ok: boolean; data?: unknown }).data as TGetContentDraft;
}

async function resetDraft(): Promise<void> {
  const { conformanceBasePayload } = await import('@bemtevi/content-core');
  // FK-safe reset order: rows on real Neon reference connections via history.
  await harness.owner.query(
    `delete from public.content_publish_preparations;
     delete from public.content_edit_exports;
     delete from public.published_content;
     delete from public.published_content_history;
     delete from public.content_agent_connections;
     delete from public.content_drafts;`,
  );
  await harness.owner.query(
    `insert into public.published_content (id, schema_version, revision, payload, published_by)
     values ('current', '1.0.0', 42, $1::jsonb, $2)`,
    [JSON.stringify(conformanceBasePayload), process.env['NEON_TEST_ADMIN_A_USER_ID']],
  );
  await callRpc(harness.adminAToken, 'get_content_draft', {});
}

async function applyImageOperation(
  slot: ImageSlot,
  image: ImageValue,
  materialId = 'material-exemplo',
): Promise<WireResult> {
  const head = await loadHead();
  return callRpc(harness.adminAToken, 'apply_content_draft_operations', {
    p_expected_generation: head.generation,
    p_operations: [{ op: 'set_material_image', materialId, slot, image }],
  });
}

async function applyGeneric(operations: unknown[]): Promise<WireResult> {
  const head = await loadHead();
  return callRpc(harness.adminAToken, 'apply_content_draft_operations', {
    p_expected_generation: head.generation,
    p_operations: operations,
  });
}

// --- Minimal container builders (header-level, like the SQL inspector) -------

function pngBytes(width: number, height: number, extraChunks: Buffer[] = []): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrType = Buffer.from('IHDR', 'ascii');
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  const ihdr = Buffer.concat([Buffer.from([0, 0, 0, 13]), ihdrType, ihdrData, Buffer.alloc(4)]);
  return Buffer.concat([signature, ...extraChunks, ihdr]);
}

function chunk(type: string, data: Buffer): Buffer {
  const header = Buffer.alloc(4);
  header.writeUInt32BE(data.length, 0);
  return Buffer.concat([header, Buffer.from(type, 'ascii'), data, Buffer.alloc(4)]);
}

function jpegBytes(sofMarker: number, withEoi: boolean): Buffer {
  const sof = Buffer.alloc(19);
  sof[0] = 0xff;
  sof[1] = sofMarker;
  sof.writeUInt16BE(17, 2);
  sof[4] = 8;
  sof.writeUInt16BE(1, 5);
  sof.writeUInt16BE(1, 7);
  const parts = [Buffer.from([0xff, 0xd8]), sof];
  if (withEoi) parts.push(Buffer.from([0xff, 0xd9]));
  return Buffer.concat(parts);
}

function webpChunk(type: string, data: Buffer): Buffer {
  const header = Buffer.alloc(4);
  header.writeUInt32LE(data.length, 0);
  return Buffer.concat([Buffer.from(type, 'ascii'), header, data]);
}

function webpBytes(chunks: Buffer[]): Buffer {
  const body = Buffer.concat(chunks);
  const riffSize = Buffer.alloc(4);
  riffSize.writeUInt32LE(body.length + 4, 0);
  return Buffer.concat([Buffer.from('RIFF', 'ascii'), riffSize, Buffer.from('WEBP', 'ascii'), body]);
}

function uploadedValue(bytes: Buffer, extras: Record<string, unknown> = {}): ImageValue {
  return {
    kind: 'uploaded',
    mime: 'image/png',
    base64: bytes.toString('base64'),
    fileName: 'nova.png',
    alt: 'Nova',
    ...extras,
  } as ImageValue;
}

beforeAll(async () => {
  harness.owner = new Client({ connectionString: requireEnv('NEON_TEST_OWNER_DATABASE_URL') });
  harness.dataApiUrl = requireEnv('NEON_TEST_DATA_API_URL');
  harness.adminAToken = requireEnv('NEON_TEST_ADMIN_A_TOKEN');
  await harness.owner.connect();
  await harness.owner.query(
    `insert into public.admin_users (user_id) values ($1)
     on conflict (user_id) do nothing`,
    [requireEnv('NEON_TEST_ADMIN_A_USER_ID')],
  );
  await resetDraft();
});

afterAll(async () => {
  await harness.owner.end();
});

describe('decoded image byte bounds', () => {
  it('accepts the fixture 1x1 PNG upload', async () => {
    await resetDraft();
    const result = await applyImageOperation(
      { kind: 'featured' },
      { kind: 'uploaded', mime: 'image/png', base64: PNG_1X1_BASE64, fileName: 'a.png', alt: 'A' },
    );
    expect(result.ok).toBe(true);
  });

  it('rejects uploads decoding above 1 MiB and accepts within', async () => {
    await resetDraft();
    const tooBig = pngBytes(1, 1);
    const padded = Buffer.concat([tooBig, Buffer.alloc(1048577 - tooBig.length)]);
    const rejected = await applyImageOperation({ kind: 'featured' }, uploadedValue(padded));
    expect(rejected.ok).toBe(false);
    expect(rejected.error?.code).toBe('invalid_image');
    const accepted = pngBytes(1, 1);
    const paddedOk = Buffer.concat([accepted, Buffer.alloc(600 - accepted.length)]);
    const result = await applyImageOperation({ kind: 'featured' }, uploadedValue(paddedOk));
    expect(result.ok).toBe(true);
  });
});

describe('container header validation', () => {
  it('rejects missing IHDR and animated PNG (acTL before IHDR)', async () => {
    await resetDraft();
    const noIhdr = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IDAT', Buffer.alloc(10)),
    ]);
    const first = await applyImageOperation({ kind: 'featured' }, uploadedValue(noIhdr));
    expect(first.ok).toBe(false);
    const animated = pngBytes(1, 1, [chunk('acTL', Buffer.alloc(8))]);
    const second = await applyImageOperation({ kind: 'featured' }, uploadedValue(animated));
    expect(second.ok).toBe(false);
    expect(second.error?.code).toBe('invalid_image');
  });

  it('enforces PNG dimension bounds including the megapixel product', async () => {
    await resetDraft();
    const tooLarge = await applyImageOperation({ kind: 'featured' }, uploadedValue(pngBytes(4096, 4096)));
    expect(tooLarge.ok).toBe(false);
    expect(tooLarge.error?.code).toBe('invalid_image');
    const zero = await applyImageOperation({ kind: 'featured' }, uploadedValue(pngBytes(0, 1)));
    expect(zero.ok).toBe(false);
    const edge = await applyImageOperation({ kind: 'featured' }, uploadedValue(pngBytes(4096, 1)));
    expect(edge.ok).toBe(true);
  });

  it('validates JPEG SOF markers and requires EOI', async () => {
    await resetDraft();
    const valid = await applyImageOperation(
      { kind: 'featured' },
      {
        kind: 'uploaded',
        mime: 'image/jpeg',
        base64: jpegBytes(0xc0, true).toString('base64'),
        fileName: 'a.jpg',
        alt: 'A',
      },
    );
    expect(valid.ok).toBe(true);
    const unsupported = await applyImageOperation(
      { kind: 'featured' },
      {
        kind: 'uploaded',
        mime: 'image/jpeg',
        base64: jpegBytes(0xc3, true).toString('base64'),
        fileName: 'a.jpg',
        alt: 'A',
      },
    );
    expect(unsupported.ok).toBe(false);
    const truncated = await applyImageOperation(
      { kind: 'featured' },
      {
        kind: 'uploaded',
        mime: 'image/jpeg',
        base64: jpegBytes(0xc0, false).toString('base64'),
        fileName: 'a.jpg',
        alt: 'A',
      },
    );
    expect(truncated.ok).toBe(false);
  });

  it('validates WebP chunks, rejecting animation and accepting VP8L', async () => {
    await resetDraft();
    const animated = webpBytes([webpChunk('ANIM', Buffer.alloc(0))]);
    const rejected = await applyImageOperation(
      { kind: 'featured' },
      { kind: 'uploaded', mime: 'image/webp', base64: animated.toString('base64'), fileName: 'a.webp', alt: 'A' },
    );
    expect(rejected.ok).toBe(false);
    const vp8lData = Buffer.from([0x2f, 0x00, 0x00, 0x00]);
    // Container must be at least 27 bytes (RIFF/WEBP header + one chunk).
    const valid = webpBytes([webpChunk('PAD ', Buffer.alloc(4)), webpChunk('VP8L', vp8lData)]);
    const accepted = await applyImageOperation(
      { kind: 'featured' },
      { kind: 'uploaded', mime: 'image/webp', base64: valid.toString('base64'), fileName: 'a.webp', alt: 'A' },
    );
    expect(accepted.ok).toBe(true);
  });
});

describe('image value contract', () => {
  it('rejects non-canonical base64, bad file names and oversized alt', async () => {
    await resetDraft();
    const unpadded = PNG_1X1_BASE64.replace(/=+$/, '');
    const nonCanonical = await applyImageOperation(
      { kind: 'featured' },
      { kind: 'uploaded', mime: 'image/png', base64: unpadded, fileName: 'a.png', alt: 'A' },
    );
    expect(nonCanonical.ok).toBe(false);
    expect(nonCanonical.error?.code).toBe('invalid_image');
    const badName = await applyImageOperation(
      { kind: 'featured' },
      { kind: 'uploaded', mime: 'image/png', base64: PNG_1X1_BASE64, fileName: 'a/b.png', alt: 'A' },
    );
    expect(badName.ok).toBe(false);
    const longAlt = await applyImageOperation(
      { kind: 'featured' },
      { kind: 'uploaded', mime: 'image/png', base64: PNG_1X1_BASE64, fileName: 'a.png', alt: 'x'.repeat(501) },
    );
    expect(longAlt.ok).toBe(false);
  });

  it('enforces external URL rules and catalog slot exclusivity', async () => {
    await resetDraft();
    const insecure = await applyImageOperation(
      { kind: 'featured' },
      { kind: 'external', url: 'http://exemplo.bemtevi.org/a.png', alt: 'A' },
    );
    expect(insecure.ok).toBe(false);
    const userinfo = await applyImageOperation(
      { kind: 'featured' },
      { kind: 'external', url: 'https://user:pass@exemplo.bemtevi.org/a.png', alt: 'A' },
    );
    expect(userinfo.ok).toBe(false);
    const port = await applyImageOperation(
      { kind: 'featured' },
      { kind: 'external', url: 'https://exemplo.bemtevi.org:8443/a.png', alt: 'A' },
    );
    expect(port.ok).toBe(false);
    const oversized = await applyImageOperation(
      { kind: 'featured' },
      { kind: 'external', url: `https://exemplo.bemtevi.org/${'a'.repeat(2100)}`, alt: 'A' },
    );
    expect(oversized.ok).toBe(false);
    const catalogOnBody = await applyImageOperation(
      { kind: 'body', blockId: 'bloco-imagem' },
      { kind: 'catalog', imageId: 'classroom-1' },
    );
    expect(catalogOnBody.ok).toBe(false);
    expect(catalogOnBody.error?.code).toBe('invalid_image');
    const catalogOnLegacy = await applyImageOperation({ kind: 'legacy' }, { kind: 'catalog', imageId: 'classroom-1' });
    expect(catalogOnLegacy.ok).toBe(false);
    const unknownCatalogId = await applyImageOperation(
      { kind: 'featured' },
      { kind: 'catalog', imageId: 'imagem-inexistente' },
    );
    expect(unknownCatalogId.ok).toBe(false);
  });

  it('requires an empty alt on the legacy slot and existing image body blocks', async () => {
    await resetDraft();
    const legacyAlt = await applyImageOperation(
      { kind: 'legacy' },
      { kind: 'uploaded', mime: 'image/png', base64: PNG_1X1_BASE64, fileName: 'a.png', alt: 'Texto' },
    );
    expect(legacyAlt.ok).toBe(false);
    expect(legacyAlt.error?.code).toBe('invalid_image');
    const missingBlock = await applyImageOperation({ kind: 'body', blockId: 'bloco-ausente' }, { kind: 'remove' });
    expect(missingBlock.ok).toBe(false);
    expect(missingBlock.error?.code).toBe('invalid_image');
  });

  it('maps uploaded, external and remove actions to the correct slots', async () => {
    await resetDraft();
    const uploaded = await applyImageOperation(
      { kind: 'body', blockId: 'bloco-imagem' },
      { kind: 'uploaded', mime: 'image/png', base64: PNG_1X1_BASE64, fileName: 'corpo.png', alt: 'Corpo' },
    );
    expect(uploaded.ok).toBe(true);
    let draft = await loadDraft();
    let block = (
      draft.payload as never as { educationMaterials: Array<{ body?: Array<Record<string, unknown>> }> }
    ).educationMaterials[0]?.body?.find((item) => item['id'] === 'bloco-imagem');
    expect(String(block?.['imageUrl'])).toContain('data:image/png;base64,');
    expect(block?.['imageFileName']).toBe('corpo.png');
    const external = await applyImageOperation(
      { kind: 'body', blockId: 'bloco-imagem' },
      { kind: 'external', url: 'https://exemplo.bemtevi.org/corpo.png', alt: 'Corpo' },
    );
    expect(external.ok).toBe(true);
    draft = await loadDraft();
    block = (
      draft.payload as never as { educationMaterials: Array<{ body?: Array<Record<string, unknown>> }> }
    ).educationMaterials[0]?.body?.find((item) => item['id'] === 'bloco-imagem');
    expect(block?.['imageFileName']).toBeUndefined();
    const remove = await applyImageOperation({ kind: 'body', blockId: 'bloco-imagem' }, { kind: 'remove' });
    expect(remove.ok).toBe(true);
    draft = await loadDraft();
    block = (
      draft.payload as never as { educationMaterials: Array<{ body?: Array<Record<string, unknown>> }> }
    ).educationMaterials[0]?.body?.find((item) => item['id'] === 'bloco-imagem');
    expect(block?.['imageUrl']).toBeUndefined();
    expect(block?.['alt']).toBeUndefined();
  });
});

describe('protected image rules during generic operations', () => {
  it('rejects material adds naming protected image keys or body image fields', async () => {
    await resetDraft();
    const topLevel = await applyGeneric([
      {
        op: 'add',
        scope: 'educationMaterials',
        value: { id: 'm-novo', title: 'M', featuredImage: { kind: 'catalog', imageId: 'classroom-1' } },
      },
    ]);
    expect(topLevel.ok).toBe(false);
    expect(topLevel.error?.code).toBe('invalid_operations');
    const bodyImage = await applyGeneric([
      {
        op: 'add',
        scope: 'educationMaterials',
        value: {
          id: 'm-novo',
          title: 'M',
          body: [{ id: 'bloco-x', kind: 'image', imageUrl: 'https://exemplo.bemtevi.org/a.png', alt: 'A' }],
        },
      },
    ]);
    expect(bodyImage.ok).toBe(false);
  });

  it('rejects flow adds with visuals and nodes patches editing retained visuals', async () => {
    await resetDraft();
    const flowAdd = await applyGeneric([
      {
        op: 'add',
        scope: 'flows',
        value: {
          id: 'fluxo-novo',
          version: '1',
          locale: 'pt-BR',
          title: 'Novo',
          type: 'guided_conversation',
          status: 'draft',
          nodes: { 'no-novo': { id: 'no-novo', kind: 'result', text: 'Fim', visuals: [] } },
          nodeOrder: ['no-novo'],
        },
      },
    ]);
    expect(flowAdd.ok).toBe(false);
    const visualsEdit = await applyGeneric([
      {
        op: 'update',
        scope: 'flows',
        id: 'fluxo-exemplo',
        patch: { nodes: { 'no-um': { id: 'no-um', kind: 'choice', text: 'Tudo bem?' } } },
        unset: [],
      },
    ]);
    expect(visualsEdit.ok).toBe(false);
    expect(visualsEdit.error?.code).toBe('invalid_operations');
  });
});
