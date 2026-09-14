import { describe, expect, it } from 'vitest';
import type { EditorialOperation } from '@bemtevi/content-core';
import {
  MAX_EXTERNAL_IMAGE_URL_LENGTH,
  MAX_IMAGE_DIMENSION,
  MAX_IMAGE_DIMENSION_PRODUCT,
  PNG_1X1_BASE64,
  applyOperations,
  conformanceBasePayload,
  decodeStrictBase64,
  fixtureImageActionOperations,
  inspectImage,
  parseEditorialOperation,
  parseImageDataUrl,
} from '@bemtevi/content-core';

const base = () => JSON.parse(JSON.stringify(conformanceBasePayload)) as typeof conformanceBasePayload;

function pngWithDimensions(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0, 0, 0, 13], 8);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12); // IHDR
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

function pngWithChunk(type: string, size: number): Uint8Array {
  const bytes = new Uint8Array(16 + size);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, size);
  for (let index = 0; index < 4; index += 1) bytes[12 + index] = type.charCodeAt(index);
  return bytes;
}

function jpegBytes(softMarker = 0xc0, withEoi = true): Uint8Array {
  const bytes = new Uint8Array(withEoi ? 17 : 16);
  bytes.set([0xff, 0xd8], 0);
  bytes.set([0xff, softMarker, 0x00, 0x0b, 0x08, 0x00, 0x10, 0x00, 0x10, 0x03, 0x01, 0x22, 0x00, 0x02], 2);
  if (withEoi) bytes.set([0xff, 0xd9], 15);
  return bytes;
}

function webpChunk(type: string, payload: number[]): Uint8Array {
  const chunkPayload = new Uint8Array(payload);
  const pad = chunkPayload.length % 2 === 1 ? 1 : 0;
  const bytes = new Uint8Array(12 + 8 + chunkPayload.length + pad);
  bytes.set([0x52, 0x49, 0x46, 0x46], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(4, bytes.length - 8, true);
  bytes.set([0x57, 0x45, 0x42, 0x50], 8);
  bytes.set([...new TextEncoder().encode(type)], 12);
  view.setUint32(16, chunkPayload.length, true);
  bytes.set(chunkPayload, 20);
  return bytes;
}

describe('strict base64', () => {
  it('decodes canonical padded base64 and re-encodes byte-equal', () => {
    const decoded = decodeStrictBase64(PNG_1X1_BASE64);
    expect(decoded).not.toBeNull();
    expect(parseImageDataUrl(`data:image/png;base64,${PNG_1X1_BASE64}`)).toEqual({
      mime: 'image/png',
      base64: PNG_1X1_BASE64,
    });
  });

  it('rejects unpadded, URL-safe, whitespace and non-canonical input', () => {
    expect(decodeStrictBase64('aGVsbG8')).toBeNull(); // missing padding
    expect(decodeStrictBase64('aGVs bG8=')).toBeNull(); // whitespace
    expect(decodeStrictBase64('aGVs-bG8=')).toBeNull(); // URL-safe alphabet
    expect(decodeStrictBase64('AB A=')).toBeNull();
    expect(decodeStrictBase64('QR==')).toBeNull(); // non-canonical trailing bits
  });
});

describe('image container inspection', () => {
  it('inspects the fixture PNG and enforces bounds', () => {
    const decoded = decodeStrictBase64(PNG_1X1_BASE64) as Uint8Array;
    const inspected = inspectImage(decoded, 'image/png');
    expect(inspected.ok).toBe(true);
    if (inspected.ok) expect(inspected.value).toEqual({ width: 1, height: 1, mime: 'image/png' });
    expect(inspectImage(pngWithDimensions(2048, 2048), 'image/png').ok).toBe(true);
    const tooBig = inspectImage(pngWithDimensions(MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION), 'image/png');
    expect(tooBig.ok).toBe(false);
    expect(inspectImage(pngWithDimensions(0, 10), 'image/png').ok).toBe(false);
    expect(inspectImage(pngWithDimensions(100, 10), 'image/png').ok).toBe(true);
    expect(MAX_IMAGE_DIMENSION_PRODUCT).toBe(16_000_000);
  });

  it('rejects animated PNG (acTL) and truncated chunks', () => {
    expect(inspectImage(pngWithChunk('acTL', 8), 'image/png').ok).toBe(false);
    expect(inspectImage(pngWithChunk('IDAT', 4).slice(0, 20), 'image/png').ok).toBe(false);
    expect(inspectImage(new Uint8Array([0x89, 0x50]), 'image/png').ok).toBe(false);
  });

  it('scans JPEG markers through SOF0/1/2 and requires EOI', () => {
    for (const marker of [0xc0, 0xc1, 0xc2]) {
      const inspected = inspectImage(jpegBytes(marker), 'image/jpeg');
      expect(inspected.ok).toBe(true);
      if (inspected.ok) expect(inspected.value).toEqual({ width: 0x10, height: 0x10, mime: 'image/jpeg' });
    }
    expect(inspectImage(jpegBytes(0xc3), 'image/jpeg').ok).toBe(false);
    expect(inspectImage(jpegBytes(0xc0, false), 'image/jpeg').ok).toBe(false);
    expect(inspectImage(new Uint8Array([0xff, 0xd9]), 'image/jpeg').ok).toBe(false);
  });

  it('parses WebP VP8/VP8L/VP8X dimensions and rejects animation', () => {
    const vp8 = webpChunk('VP8 ', [0x9d, 0x01, 0x2a, 0x10, 0x00, 0x10, 0x00]);
    const inspected = inspectImage(vp8, 'image/webp');
    expect(inspected.ok).toBe(true);
    if (inspected.ok) expect(inspected.value).toEqual({ width: 16, height: 16, mime: 'image/webp' });

    const vp8l = webpChunk('VP8L', [0x2f, 0x0f, 0x00, 0x00, 0x0f, 0x00, 0x00]);
    expect(inspectImage(vp8l, 'image/webp').ok).toBe(true);

    const vp8x = webpChunk('VP8X', [0x00, 0x0f, 0x00, 0x00, 0x0f, 0x00, 0x00, 0x00]);
    const vp8xAnimated = webpChunk('VP8X', [0x02, 0x0f, 0x00, 0x00, 0x0f, 0x00, 0x00, 0x00]);
    expect(inspectImage(vp8x, 'image/webp').ok).toBe(true);
    expect(inspectImage(vp8xAnimated, 'image/webp').ok).toBe(false);
    expect(inspectImage(webpChunk('ANMF', [0, 0, 0]), 'image/webp').ok).toBe(false);
    expect(inspectImage(new Uint8Array(12), 'image/webp').ok).toBe(false);
  });
});

describe('image value contract (parse and apply)', () => {
  const op = (image: unknown, slot: unknown = { kind: 'featured' }) => ({
    op: 'set_material_image',
    materialId: 'material-exemplo',
    slot,
    image,
  });

  it('accepts uploaded/catalog/external/remove values', () => {
    expect(
      parseEditorialOperation(
        op({ kind: 'uploaded', mime: 'image/png', base64: PNG_1X1_BASE64, fileName: 'a.png', alt: 'A' }),
      ).ok,
    ).toBe(true);
    expect(parseEditorialOperation(op({ kind: 'catalog', imageId: 'classroom-1' })).ok).toBe(true);
    expect(parseEditorialOperation(op({ kind: 'external', url: 'https://a.bemtevi.org/x.png', alt: 'X' })).ok).toBe(
      true,
    );
    expect(parseEditorialOperation(op({ kind: 'remove' })).ok).toBe(true);
  });

  it('rejects invalid uploaded metadata and oversize payloads', () => {
    expect(
      parseEditorialOperation(
        op({ kind: 'uploaded', mime: 'image/gif', base64: PNG_1X1_BASE64, fileName: 'a.png', alt: '' }),
      ).ok,
    ).toBe(false);
    expect(
      parseEditorialOperation(op({ kind: 'uploaded', mime: 'image/png', base64: '!!!', fileName: 'a.png', alt: '' }))
        .ok,
    ).toBe(false);
    expect(
      parseEditorialOperation(
        op({ kind: 'uploaded', mime: 'image/png', base64: PNG_1X1_BASE64, fileName: 'a/b.png', alt: '' }),
      ).ok,
    ).toBe(false);
    expect(
      parseEditorialOperation(
        op({ kind: 'uploaded', mime: 'image/png', base64: PNG_1X1_BASE64, fileName: ''.padEnd(121, 'a'), alt: '' }),
      ).ok,
    ).toBe(false);
    expect(
      parseEditorialOperation(
        op({ kind: 'uploaded', mime: 'image/png', base64: PNG_1X1_BASE64, fileName: 'a.png', alt: 'x'.repeat(501) }),
      ).ok,
    ).toBe(false);
  });

  it('rejects catalog ids outside the list and unsafe external URLs', () => {
    expect(parseEditorialOperation(op({ kind: 'catalog', imageId: 'nope' })).ok).toBe(false);
    expect(parseEditorialOperation(op({ kind: 'external', url: 'http://a.bemtevi.org/x.png', alt: '' })).ok).toBe(
      false,
    );
    expect(
      parseEditorialOperation(op({ kind: 'external', url: 'https://user:pass@a.bemtevi.org/x.png', alt: '' })).ok,
    ).toBe(false);
    const tooLong = `https://a.bemtevi.org/${'x'.repeat(MAX_EXTERNAL_IMAGE_URL_LENGTH)}`;
    expect(parseEditorialOperation(op({ kind: 'external', url: tooLong, alt: '' })).ok).toBe(false);
  });

  it('rejects invalid slots', () => {
    expect(parseEditorialOperation(op({ kind: 'remove' }, { kind: 'body' })).ok).toBe(false);
    expect(parseEditorialOperation(op({ kind: 'remove' }, { kind: 'cover' })).ok).toBe(false);
  });

  it('maps every fixture image action onto the right payload slot', () => {
    for (const fixture of fixtureImageActionOperations) {
      const parsed = parseEditorialOperation(fixture.operation);
      expect(parsed.ok, `${fixture.name}: ${parsed.ok === false ? parsed.error.message : ''}`).toBe(true);
      const result = applyOperations(base(), [fixture.operation]);
      expect(result.ok, `${fixture.name} apply`).toBe(true);
      if (result.ok !== true) continue;
      const material = result.data.educationMaterials[0];
      const operation = fixture.operation as {
        slot: { kind: string; blockId?: string };
        image: { kind: string; url?: string; imageId?: string; alt?: string; fileName?: string };
      };
      if (operation.slot.kind === 'featured') {
        if (operation.image.kind === 'remove') expect(material.featuredImage).toBeUndefined();
        if (operation.image.kind === 'catalog')
          expect(material.featuredImage).toEqual({ kind: 'catalog', imageId: operation.image.imageId });
        if (operation.image.kind === 'external')
          expect(material.featuredImage).toEqual({
            kind: 'external',
            imageUrl: operation.image.url,
            alt: operation.image.alt,
          });
        if (operation.image.kind === 'uploaded')
          expect(material.featuredImage).toMatchObject({
            kind: 'uploaded',
            fileName: operation.image.fileName,
            alt: operation.image.alt,
          });
      }
      if (operation.slot.kind === 'legacy') {
        if (operation.image.kind === 'remove') {
          expect(material.imageUrl).toBeUndefined();
          expect(material.imageFileName).toBeUndefined();
        } else if (operation.image.kind === 'external') {
          expect(material.imageUrl).toBe(operation.image.url);
          expect(material.imageFileName).toBeUndefined();
        }
      }
      if (operation.slot.kind === 'body') {
        const block = material.body?.find((item) => item.id === operation.slot.blockId);
        expect(block).toBeDefined();
        if (operation.image.kind === 'remove') {
          expect(block?.imageUrl).toBeUndefined();
          expect(block?.imageFileName).toBeUndefined();
          expect(block?.alt).toBeUndefined();
        } else if (operation.image.kind === 'external') {
          expect(block?.imageUrl).toBe(operation.image.url);
          expect(block?.alt).toBe(operation.image.alt);
        }
      }
    }
  });

  it('refuses a non-empty alt on the legacy slot and catalog on body slots', () => {
    const legacyAlt: EditorialOperation = {
      op: 'set_material_image',
      materialId: 'material-exemplo',
      slot: { kind: 'legacy' },
      image: { kind: 'external', url: 'https://a.bemtevi.org/x.png', alt: 'com texto' },
    };
    const parsed = parseEditorialOperation(legacyAlt);
    expect(parsed.ok).toBe(true);
    const result = applyOperations(base(), [legacyAlt]);
    expect(result.ok).toBe(false);
    if (result.ok === false) expect(result.error.code).toBe('invalid_image');
    const bodyCatalog = applyOperations(base(), [
      {
        op: 'set_material_image',
        materialId: 'material-exemplo',
        slot: { kind: 'body', blockId: 'bloco-imagem' },
        image: { kind: 'catalog', imageId: 'classroom-1' },
      },
    ]);
    expect(bodyCatalog.ok).toBe(false);
  });

  it('requires an existing body block with kind image', () => {
    const result = applyOperations(base(), [
      {
        op: 'set_material_image',
        materialId: 'material-exemplo',
        slot: { kind: 'body', blockId: 'bloco-texto' },
        image: { kind: 'remove' },
      },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok === false) expect(result.error.message).toContain('kind "image"');
  });
});
