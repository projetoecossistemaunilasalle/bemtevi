import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import {
  FIXTURE_EXPORT_ID,
  PNG_1X1_BASE64,
  conformanceBasePayload,
  sameContent,
  sha256Text,
  type EditExport,
} from '@bemtevi/content-core';
import { parseEditorialArchive } from '../parseEditorialArchive';
import { importEditorialOperations } from '../importEditorialOperations';

const PAST = '2020-01-01T00:00:00Z';
const FUTURE = '2099-01-01T00:00:00Z';

function decodeBase64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function buildOwnerExport(
  overrides: Partial<EditExport> = {},
): Promise<{ exportRecord: EditExport; canonicalPayload: string; baseDigest: string }> {
  const basePayload = JSON.parse(JSON.stringify(conformanceBasePayload)) as EditExport['basePayload'];
  const canonicalPayload = JSON.stringify(basePayload);
  const baseDigest = await sha256Text(canonicalPayload);
  const exportRecord: EditExport = {
    exportId: FIXTURE_EXPORT_ID,
    draftId: 'current',
    schemaVersion: '2.0.0',
    baseGeneration: 7,
    baseDigest,
    publishedRevision: 42,
    basePayload,
    canonicalPayload,
    createdBy: 'admin-1',
    createdAt: '2026-01-01T00:00:00Z',
    expiresAt: FUTURE,
    selection: null,
    ...overrides,
  };
  return { exportRecord, canonicalPayload, baseDigest };
}

function envelopeRaw(
  operations: unknown[],
  bindings: { exportId: string; baseGeneration: number; baseDigest: string },
  schemaVersion: string = '2.0.0',
): Record<string, unknown> {
  return {
    schemaVersion,
    exportId: bindings.exportId,
    baseGeneration: bindings.baseGeneration,
    baseDigest: bindings.baseDigest,
    operations,
    selfCheck: {
      reviewed: true,
      noOutOfScopeChanges: true,
      noUnrequestedDeletes: true,
      noUnsupportedImagePaths: true,
      notes: ['conferido'],
    },
  };
}

function manifestFor(exportRecord: EditExport): Record<string, unknown> {
  return {
    schemaVersion: '2.0.0',
    exportId: exportRecord.exportId,
    baseGeneration: exportRecord.baseGeneration,
    baseDigest: exportRecord.baseDigest,
    expiresAt: exportRecord.expiresAt,
    selection: exportRecord.selection,
  };
}

async function imageHex(): Promise<string> {
  const bytes = decodeBase64ToBytes(PNG_1X1_BASE64);
  const digest = await crypto.subtle.digest('SHA-256', bytes.slice().buffer as ArrayBuffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function buildImageZip(
  exportRecord: EditExport,
  options: { manifest?: Record<string, unknown> | null; includeImage?: boolean } = {},
): Promise<Uint8Array> {
  const hex = await imageHex();
  const imagePath = `images/${hex}.png`;
  const operation = {
    op: 'set_material_image',
    materialId: 'material-exemplo',
    slot: { kind: 'featured' },
    image: { kind: 'uploaded', mime: 'image/png', imagePath, fileName: 'calma.png', alt: 'Respire com calma' },
  };
  const zip = new JSZip();
  zip.file('operations.json', JSON.stringify(envelopeRaw([operation], exportRecord)));
  if (options.manifest !== null)
    zip.file('manifest.json', JSON.stringify(options.manifest ?? manifestFor(exportRecord)));
  if (options.includeImage !== false) zip.file(imagePath, decodeBase64ToBytes(PNG_1X1_BASE64));
  return zip.generateAsync({ type: 'uint8array' });
}

describe('plain operations.json import', () => {
  it('replays a no-op operation into an unchanged candidate (idempotent reconciliation)', async () => {
    const { exportRecord, baseDigest } = await buildOwnerExport();
    const parsed = await parseEditorialArchive({
      kind: 'json',
      text: JSON.stringify(
        envelopeRaw(
          [{ op: 'update', scope: 'educationGroups', id: 'grupo-um', patch: { title: 'Grupo um' }, unset: [] }],
          { exportId: FIXTURE_EXPORT_ID, baseGeneration: 7, baseDigest },
        ),
      ),
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok === false) return;
    const result = await importEditorialOperations(parsed.data, exportRecord);
    expect(result.ok).toBe(true);
    if (result.ok === false) return;
    expect(sameContent(result.data.candidate, exportRecord.basePayload)).toBe(true);
    expect(result.data.changes).toEqual([]);
    expect(result.data.operationsCount).toBe(1);
    // Semantically invalid but structurally safe candidates are returned with
    // visible issues (fixture contact has an inconsistent phone link).
    expect(result.data.issues.length).toBeGreaterThan(0);
    expect(result.data.issues.some((issue) => issue.code === 'invalid-phone-href:contato-um:0')).toBe(true);
  });

  it('returns candidate, semantic diff and issues without hidden mutation', async () => {
    const { exportRecord, baseDigest } = await buildOwnerExport();
    const before = JSON.parse(JSON.stringify(exportRecord.basePayload)) as EditExport['basePayload'];
    const parsed = await parseEditorialArchive({
      kind: 'json',
      text: JSON.stringify(
        envelopeRaw(
          [
            {
              op: 'update',
              scope: 'educationGroups',
              id: 'grupo-um',
              patch: { description: 'Novo texto.' },
              unset: [],
            },
          ],
          { exportId: FIXTURE_EXPORT_ID, baseGeneration: 7, baseDigest },
        ),
      ),
    });
    if (parsed.ok === false) throw new Error(parsed.error.message);
    const result = await importEditorialOperations(parsed.data, exportRecord);
    expect(result.ok).toBe(true);
    if (result.ok === false) return;
    expect(result.data.changes.length).toBeGreaterThan(0);
    expect(result.data.candidate.educationGroups[0]!.description).toBe('Novo texto.');
    expect(sameContent(exportRecord.basePayload, before)).toBe(true);
  });

  it('rejects V1 envelopes with unsupported_schema and never reads baseRevision', async () => {
    const { exportRecord } = await buildOwnerExport();
    const v1 = {
      schemaVersion: '1.0.0',
      baseRevision: 7,
      operations: [],
      selfCheck: {
        reviewed: true,
        noOutOfScopeChanges: true,
        noUnrequestedDeletes: true,
        noUnsupportedImagePaths: true,
        notes: [],
      },
    };
    const parsed = await parseEditorialArchive({ kind: 'json', text: JSON.stringify(v1) });
    expect(parsed.ok).toBe(true);
    if (parsed.ok === false) return;
    const result = await importEditorialOperations(parsed.data, exportRecord);
    expect(result.ok).toBe(false);
    if (result.ok === true) return;
    expect(result.error.code).toBe('unsupported_schema');
  });

  it('rejects export content (context) submitted as operations', async () => {
    const { exportRecord } = await buildOwnerExport();
    const parsed = await parseEditorialArchive({
      kind: 'json',
      text: JSON.stringify({ scope: 'contacts', items: [] }),
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok === false) return;
    const result = await importEditorialOperations(parsed.data, exportRecord);
    expect(result.ok === false && ['invalid_operations', 'unsupported_schema'].includes(result.error.code)).toBe(true);
  });
});

describe('import bindings and durable base', () => {
  it('rejects expired exports on every attempt', async () => {
    const { exportRecord, baseDigest } = await buildOwnerExport({ expiresAt: PAST });
    const parsed = await parseEditorialArchive({
      kind: 'json',
      text: JSON.stringify(
        envelopeRaw(
          [{ op: 'update', scope: 'educationGroups', id: 'grupo-um', patch: { title: 'Grupo um' }, unset: [] }],
          { exportId: FIXTURE_EXPORT_ID, baseGeneration: 7, baseDigest },
        ),
      ),
    });
    if (parsed.ok === false) throw new Error(parsed.error.message);
    const result = await importEditorialOperations(parsed.data, exportRecord);
    expect(result.ok === false && result.error.code).toBe('export_base_unavailable');
  });

  it('rejects wrong exportId, generation and digest bindings', async () => {
    const { exportRecord, baseDigest } = await buildOwnerExport();
    const cases = [
      { exportId: '00000000-0000-4000-8000-0000000000ff', baseGeneration: 7, baseDigest },
      { exportId: FIXTURE_EXPORT_ID, baseGeneration: 8, baseDigest },
      { exportId: FIXTURE_EXPORT_ID, baseGeneration: 7, baseDigest: 'b'.repeat(64) },
    ];
    for (const bindings of cases) {
      const parsed = await parseEditorialArchive({
        kind: 'json',
        text: JSON.stringify(
          envelopeRaw(
            [{ op: 'update', scope: 'educationGroups', id: 'grupo-um', patch: { title: 'Grupo um' }, unset: [] }],
            bindings,
          ),
        ),
      });
      if (parsed.ok === false) throw new Error(parsed.error.message);
      const result = await importEditorialOperations(parsed.data, exportRecord);
      expect(result.ok === false && result.error.code).toBe('export_base_unavailable');
    }
  });

  it('verifies the captured canonical base before using it', async () => {
    const { exportRecord } = await buildOwnerExport({ canonicalPayload: '{"flows":[]}' });
    const parsed = await parseEditorialArchive({
      kind: 'json',
      text: JSON.stringify(
        envelopeRaw(
          [{ op: 'update', scope: 'educationGroups', id: 'grupo-um', patch: { title: 'Grupo um' }, unset: [] }],
          exportRecord,
        ),
      ),
    });
    if (parsed.ok === false) throw new Error(parsed.error.message);
    const result = await importEditorialOperations(parsed.data, exportRecord);
    expect(result.ok === false && result.error.code).toBe('export_base_unavailable');
  });

  it('rejects a manifest.json that differs from the envelope', async () => {
    const { exportRecord } = await buildOwnerExport();
    const bytes = await buildImageZip(exportRecord, { manifest: { ...manifestFor(exportRecord), exportId: 'outro' } });
    const parsed = await parseEditorialArchive({ kind: 'zip', bytes });
    expect(parsed.ok).toBe(true);
    if (parsed.ok === false) return;
    const result = await importEditorialOperations(parsed.data, exportRecord);
    expect(result.ok === false && result.error.code).toBe('invalid_input');
  });
});

describe('ZIP image roundtrip', () => {
  it('resolves imagePath to uploaded base64 using core semantics', async () => {
    const { exportRecord } = await buildOwnerExport();
    const bytes = await buildImageZip(exportRecord);
    const parsed = await parseEditorialArchive({ kind: 'zip', bytes });
    expect(parsed.ok).toBe(true);
    if (parsed.ok === false) return;
    expect(parsed.data.referencedImagePaths.size).toBe(1);
    const result = await importEditorialOperations(parsed.data, exportRecord);
    expect(result.ok).toBe(true);
    if (result.ok === false) return;
    const featured = result.data.candidate.educationMaterials[0]!.featuredImage;
    expect(featured).toMatchObject({ kind: 'uploaded', fileName: 'calma.png', alt: 'Respire com calma' });
    expect(featured && 'dataUrl' in featured && featured.dataUrl.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('rejects missing and unreferenced image files, subfolders and unsupported roots', async () => {
    const { exportRecord } = await buildOwnerExport();
    const missingImage = await buildImageZip(exportRecord, { includeImage: false });
    const missingParsed = await parseEditorialArchive({ kind: 'zip', bytes: missingImage });
    expect(missingParsed.ok === false && missingParsed.error.code).toBe('invalid_input');

    const hex = await imageHex();
    const extraZip = new JSZip();
    extraZip.file('operations.json', JSON.stringify(envelopeRaw([], exportRecord)));
    extraZip.file(`images/${hex}.png`, decodeBase64ToBytes(PNG_1X1_BASE64));
    const extraBytes = await extraZip.generateAsync({ type: 'uint8array' });
    const extraParsed = await parseEditorialArchive({ kind: 'zip', bytes: extraBytes });
    expect(extraParsed.ok === false && extraParsed.error.code).toBe('invalid_input');

    const subZip = new JSZip();
    subZip.file('operations.json', JSON.stringify(envelopeRaw([], exportRecord)));
    subZip.file('images/sub/x.png', decodeBase64ToBytes(PNG_1X1_BASE64));
    const subBytes = await subZip.generateAsync({ type: 'uint8array' });
    const subParsed = await parseEditorialArchive({ kind: 'zip', bytes: subBytes });
    expect(subParsed.ok === false && subParsed.error.code).toBe('invalid_input');

    const rootZip = new JSZip();
    rootZip.file('operations.json', JSON.stringify(envelopeRaw([], exportRecord)));
    rootZip.file('data.json', '{}');
    const rootBytes = await rootZip.generateAsync({ type: 'uint8array' });
    const rootParsed = await parseEditorialArchive({ kind: 'zip', bytes: rootBytes });
    expect(rootParsed.ok === false && rootParsed.error.code).toBe('invalid_input');

    const exportZip = new JSZip();
    exportZip.file('manifest.json', '{}');
    exportZip.file('context.json', '{}');
    exportZip.file('instructions.md', 'x');
    const exportBytes = await exportZip.generateAsync({ type: 'uint8array' });
    const exportParsed = await parseEditorialArchive({ kind: 'zip', bytes: exportBytes });
    expect(exportParsed.ok === false && exportParsed.error.code).toBe('invalid_input');
  });

  it('rejects imagePath outside uploaded image values and archive paths in other fields', async () => {
    const { exportRecord, baseDigest } = await buildOwnerExport();
    const badOp = {
      op: 'update',
      scope: 'educationGroups',
      id: 'grupo-um',
      patch: { description: 'images/x.png' },
      unset: [],
    };
    const parsed = await parseEditorialArchive({
      kind: 'json',
      text: JSON.stringify(envelopeRaw([badOp], { exportId: FIXTURE_EXPORT_ID, baseGeneration: 7, baseDigest })),
    });
    expect(parsed.ok === false && parsed.error.code).toBe('invalid_input');

    const wrongKind = {
      op: 'set_material_image',
      materialId: 'material-exemplo',
      slot: { kind: 'featured' },
      image: { kind: 'catalog', imagePath: 'images/x.png' },
    };
    const parsedKind = await parseEditorialArchive({
      kind: 'json',
      text: JSON.stringify(envelopeRaw([wrongKind], { exportId: FIXTURE_EXPORT_ID, baseGeneration: 7, baseDigest })),
    });
    expect(parsedKind.ok === false && parsedKind.error.code).toBe('invalid_input');
    expect(exportRecord.expiresAt).toBe(FUTURE);
  });

  it('rejects an imagePath image value in a plain JSON source at parse time (no throw)', async () => {
    const { exportRecord, baseDigest } = await buildOwnerExport();
    const uploadedWithPath = {
      op: 'set_material_image',
      materialId: 'material-exemplo',
      slot: { kind: 'featured' },
      image: {
        kind: 'uploaded',
        mime: 'image/png',
        imagePath: 'images/0000000000000000000000000000000000000000000000000000000000000000.png',
        fileName: 'calma.png',
        alt: 'Respire com calma',
      },
    };
    const parsed = await parseEditorialArchive({
      kind: 'json',
      text: JSON.stringify(
        envelopeRaw([uploadedWithPath], { exportId: FIXTURE_EXPORT_ID, baseGeneration: 7, baseDigest }),
      ),
    });
    expect(parsed.ok).toBe(false);
    if (parsed.ok === true) return;
    expect(parsed.error.code).toBe('invalid_input');
    expect(parsed.error.message).toContain('ZIP');
    expect(parsed.error.message).toContain('imagePath');
    expect(exportRecord.selection).toBe(null);
  });

  it('rejects a corrupted archive (CRC mismatch) and bytes outside the bounds', async () => {
    const { exportRecord } = await buildOwnerExport();
    const bytes = await buildImageZip(exportRecord);
    const corrupted = bytes.slice();
    // Corrupt one byte of the stored image content (inside the local entry data).
    const signature = new TextEncoder().encode('PK\x03\x04');
    let secondLocal = -1;
    let found = 0;
    for (let i = 0; i < corrupted.length - 4; i += 1) {
      if (
        corrupted[i] === signature[0] &&
        corrupted[i + 1] === signature[1] &&
        corrupted[i + 2] === signature[2] &&
        corrupted[i + 3] === signature[3]
      ) {
        found += 1;
        if (found === 2) {
          secondLocal = i;
          break;
        }
      }
    }
    expect(secondLocal).toBeGreaterThan(0);
    corrupted[secondLocal + 40] = (corrupted[secondLocal + 40]! + 1) % 256;
    const corruptedParsed = await parseEditorialArchive({ kind: 'zip', bytes: corrupted });
    expect(corruptedParsed.ok).toBe(false);

    const truncated = bytes.slice(0, bytes.length - 25);
    const truncatedParsed = await parseEditorialArchive({ kind: 'zip', bytes: truncated });
    expect(truncatedParsed.ok).toBe(false);
    expect(exportRecord.exportId).toBe(FIXTURE_EXPORT_ID);
  });
});

describe('scoped export rules', () => {
  it('rejects add/reorder/scalar operations and out-of-selection targets', async () => {
    const { exportRecord } = await buildOwnerExport({
      selection: { scope: 'educationGroups', ids: ['grupo-um'] },
    });
    const operations: unknown[] = [
      { op: 'add', scope: 'educationGroups', value: { id: 'novo', title: 'Novo' } },
      { op: 'set_default_group_order', value: 2 },
      { op: 'reorder', scope: 'educationGroups', ids: ['grupo-um', 'grupo-dois'] },
      { op: 'update', scope: 'educationGroups', id: 'grupo-dois', patch: { title: 'X' }, unset: [] },
    ];
    for (const operation of operations) {
      const parsed = await parseEditorialArchive({
        kind: 'json',
        text: JSON.stringify(envelopeRaw([operation], exportRecord)),
      });
      if (parsed.ok === false) throw new Error(parsed.error.message);
      const result = await importEditorialOperations(parsed.data, exportRecord);
      expect(result.ok === false && result.error.code).toBe('invalid_operations');
    }
  });

  it('accepts in-selection updates for partial exports', async () => {
    const { exportRecord, baseDigest } = await buildOwnerExport({
      selection: { scope: 'educationGroups', ids: ['grupo-um'] },
    });
    const parsed = await parseEditorialArchive({
      kind: 'json',
      text: JSON.stringify(
        envelopeRaw(
          [
            {
              op: 'update',
              scope: 'educationGroups',
              id: 'grupo-um',
              patch: { description: 'Dentro da seleção.' },
              unset: [],
            },
          ],
          { exportId: FIXTURE_EXPORT_ID, baseGeneration: 7, baseDigest },
        ),
      ),
    });
    if (parsed.ok === false) throw new Error(parsed.error.message);
    const result = await importEditorialOperations(parsed.data, exportRecord);
    expect(result.ok).toBe(true);
    if (result.ok === false) return;
    expect(result.data.candidate.educationGroups[0]!.description).toBe('Dentro da seleção.');
  });
});
