import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createZip } from '../../src/dev-dashboard/export/createZip';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

describe('parse-export-zip.py', () => {
  it('generates import-backed resources and removes dashboard-only image helper fields', () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), 'bemtevi-export-'));
    const zipPath = path.join(tempDir, 'export.zip');
    const assetsDir = path.join(tempDir, 'assets');
    const tsPath = path.join(tempDir, 'generated-resources.ts');
    const bundle = {
      changes: {
        educationMaterials: [
          {
            id: 'material-one',
            title: 'Material',
            source: 'Equipe BemTeVi',
            description: 'Descrição.',
            imageUrl: './images/material-one-thumbnail-thumb.png',
            imageFileName: 'thumb.png',
            featuredImage: {
              kind: 'uploaded',
              dataUrl: './images/material-one-featured-main.png',
              fileName: 'main.png',
              alt: 'Principal',
            },
            body: [
              {
                id: 'body-image',
                kind: 'image',
                imageUrl: './images/material-one-block-body.png',
                imageFileName: 'body.png',
                alt: 'Interna',
              },
            ],
            tags: ['teste'],
            audience: 'teachers',
            review: { status: 'pending_review', reviewedBy: null, reviewedAt: null, notes: '' },
          },
        ],
      },
    };
    const zip = createZip([
      { name: 'data.json', data: new TextEncoder().encode(JSON.stringify(bundle)) },
      { name: 'images/material-one-thumbnail-thumb.png', data: new Uint8Array([1]) },
      { name: 'images/material-one-featured-main.png', data: new Uint8Array([2]) },
      { name: 'images/material-one-block-body.png', data: new Uint8Array([3]) },
    ]);
    writeFileSync(zipPath, Buffer.from(zip));

    const result = spawnSync('python', ['scripts/parse-export-zip.py', zipPath, assetsDir, tsPath], {
      cwd: repoRoot,
      encoding: 'utf8',
    });

    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    const generated = readFileSync(tsPath, 'utf8');
    expect(generated).toContain('import type { EducationResource }');
    expect(generated).toContain('export const generatedResources =');
    expect(generated).toContain('satisfies EducationResource[]');
    expect(generated).toContain('imageUrl: img_material_one_thumbnail_thumb');
    expect(generated).toContain('featuredImage: {');
    expect(generated).toContain('kind: "external"');
    expect(generated).toContain('imageUrl: img_material_one_featured_main');
    expect(generated).toContain('imageUrl: img_material_one_block_body');
    expect(generated).not.toContain('imageFileName');
    expect(generated).not.toContain('fileName');
  });
});
