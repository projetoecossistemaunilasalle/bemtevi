import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { PNG_1X1_BASE64, conformanceBasePayload } from '@bemtevi/content-core';
import type { EditExport } from '@bemtevi/content-core';
import { buildArchiveInstructions } from '../archiveInstructions';
import { createEditorialArchive } from '../createEditorialArchive';

function decodeBase64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function ownerExport(selection: EditExport['selection']): EditExport {
  const basePayload = conformanceBasePayload;
  return {
    exportId: '00000000-0000-4000-8000-000000000001',
    draftId: 'current',
    schemaVersion: '2.0.0',
    baseGeneration: 7,
    baseDigest: 'a'.repeat(64),
    publishedRevision: 42,
    basePayload,
    canonicalPayload: JSON.stringify(basePayload),
    createdBy: 'admin-1',
    createdAt: '2026-01-01T00:00:00Z',
    expiresAt: '2026-01-15T00:00:00Z',
    selection,
  };
}

describe('createEditorialArchive', () => {
  it('produces manifest.json, context.json, instructions.md and embedded image files', async () => {
    const exportRecord = ownerExport(null);
    const material = { ...exportRecord.basePayload.educationMaterials[0]! };
    material.imageUrl = `data:image/png;base64,${PNG_1X1_BASE64}`;
    exportRecord.basePayload = {
      ...exportRecord.basePayload,
      educationMaterials: [material],
    };

    const build = await createEditorialArchive(exportRecord, { now: new Date('2026-01-02T03:04:05Z') });
    expect(build.imageCount).toBe(1);

    const zip = await JSZip.loadAsync(build.zipData);
    const names = Object.keys(zip.files).sort();
    const imageNames = names.filter((name) => name.startsWith('images/') && !name.endsWith('/'));
    expect(names).toContain('manifest.json');
    expect(names).toContain('context.json');
    expect(names).toContain('instructions.md');
    expect(imageNames).toHaveLength(1);
    expect(imageNames[0]).toMatch(/^images\/[0-9a-f]{64}\.png$/);

    const manifest = JSON.parse((await zip.file('manifest.json')!.async('string'))!) as Record<string, unknown>;
    expect(manifest).toEqual({
      schemaVersion: '2.0.0',
      exportId: exportRecord.exportId,
      baseGeneration: 7,
      baseDigest: 'a'.repeat(64),
      expiresAt: '2026-01-15T00:00:00Z',
      selection: null,
    });

    const contextText = await zip.file('context.json')!.async('string');
    expect(contextText).not.toContain('data:image');
    expect(contextText).toContain(imageNames[0]!);

    const storedBytes = await zip.file(imageNames[0]!)!.async('uint8array');
    const expectedBytes = decodeBase64ToBytes(PNG_1X1_BASE64);
    expect([...storedBytes]).toEqual([...expectedBytes]);
  });

  it('keeps the same bytes for the same image referenced twice (single archive file)', async () => {
    const exportRecord = ownerExport(null);
    const [material] = exportRecord.basePayload.educationMaterials;
    exportRecord.basePayload = {
      ...exportRecord.basePayload,
      educationMaterials: [{ ...material!, imageUrl: `data:image/png;base64,${PNG_1X1_BASE64}` }],
      flows: exportRecord.basePayload.flows.map((flow) => ({
        ...flow,
        nodes: Object.fromEntries(
          Object.entries(flow.nodes).map(([id, node]) => [
            id,
            {
              ...node,
              visuals: node.visuals?.map((visual) => ({ ...visual, src: `data:image/png;base64,${PNG_1X1_BASE64}` })),
            },
          ]),
        ),
      })),
    };
    const build = await createEditorialArchive(exportRecord);
    expect(build.imageCount).toBe(1);
    const zip = await JSZip.loadAsync(build.zipData);
    expect(Object.keys(zip.files).filter((name) => name.startsWith('images/') && !name.endsWith('/'))).toHaveLength(1);
  });

  it('builds a scoped context of selected records only', async () => {
    const exportRecord = ownerExport({ scope: 'educationGroups', ids: ['grupo-dois'] });
    const build = await createEditorialArchive(exportRecord);
    const zip = await JSZip.loadAsync(build.zipData);
    const context = JSON.parse((await zip.file('context.json')!.async('string'))!) as Record<string, unknown>;
    expect(context['scope']).toBe('educationGroups');
    const items = context['items'] as Array<Record<string, unknown>>;
    expect(items).toEqual([{ id: 'grupo-dois', title: 'Grupo dois', order: 2 }]);
  });

  it('never downloads external or catalog assets (no images/ entries without embedded data)', async () => {
    const exportRecord = ownerExport(null);
    const build = await createEditorialArchive(exportRecord);
    expect(build.imageCount).toBe(0);
    const zip = await JSZip.loadAsync(build.zipData);
    expect(Object.keys(zip.files).some((name) => name.startsWith('images/') && !name.endsWith('/'))).toBe(false);
  });
});

describe('buildArchiveInstructions', () => {
  it('describes the V2 protocol in PT-BR with bindings and expiry', () => {
    const instructions = buildArchiveInstructions('00000000-0000-4000-8000-000000000001', '2026-01-15T00:00:00Z', null);
    expect(instructions).toContain('operations.json');
    expect(instructions).toContain('exportId: 00000000-0000-4000-8000-000000000001');
    expect(instructions).toContain('expira em 2026-01-15T00:00:00Z');
    expect(instructions).toContain('TODO o conteúdo');
    expect(instructions).toContain('"schemaVersion": "2.0.0"');
    expect(instructions).not.toContain('baseRevision');
  });

  it('states the scoped rules for partial exports', () => {
    const instructions = buildArchiveInstructions('x-export', '2026-01-15T00:00:00Z', {
      scope: 'contacts',
      ids: ['c1'],
    });
    expect(instructions).toContain('NÃO são aceitas nesta exportação parcial');
    expect(instructions).toContain('c1');
  });
});
