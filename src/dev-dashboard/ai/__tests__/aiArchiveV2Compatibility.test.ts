import { describe, expect, it } from 'vitest';
import {
  createEditorialArchiveV2,
  createExportRepository,
  importEditorialOperationsV2,
  parseEditorialArchiveV2,
  buildArchiveInstructions,
} from '../aiArchive';
import { createEditorialArchive as createCore } from '../files/createEditorialArchive';
import { createExportRepository as createRepositoryCore } from '../files/exportRepository';
import { importEditorialOperations as importCore } from '../files/importEditorialOperations';
import { parseEditorialArchive as parseCore } from '../files/parseEditorialArchive';
import { buildArchiveInstructions as instructionsCore } from '../files/archiveInstructions';
import { parseAiArchiveFile } from '../aiArchive';
import { parseOperationsEnvelope } from '@bemtevi/content-core';

const V2_ENVELOPE = {
  schemaVersion: '2.0.0',
  exportId: '00000000-0000-4000-8000-000000000001',
  baseGeneration: 7,
  baseDigest: 'a'.repeat(64),
  operations: [{ op: 'update', scope: 'educationGroups', id: 'grupo-um', patch: { title: 'Grupo um' }, unset: [] }],
  selfCheck: {
    reviewed: true,
    noOutOfScopeChanges: true,
    noUnrequestedDeletes: true,
    noUnsupportedImagePaths: true,
    notes: [],
  },
};

describe('aiArchive V2 compatibility facade', () => {
  it('re-exports the V2 file helpers by identity', () => {
    expect(createEditorialArchiveV2).toBe(createCore);
    expect(createExportRepository).toBe(createRepositoryCore);
    expect(importEditorialOperationsV2).toBe(importCore);
    expect(parseEditorialArchiveV2).toBe(parseCore);
    expect(buildArchiveInstructions).toBe(instructionsCore);
  });

  it('no longer exposes the V1 whole-payload prompt builder', async () => {
    const prompts = (await import('../aiPrompts')) as unknown as Record<string, unknown>;
    expect(prompts['buildFullPayloadPrompt']).toBeUndefined();
    expect(prompts['buildFullPayloadPromptForArchive']).toBeTypeOf('function');
  });

  it('keeps the V1 and V2 file parsers distinct: V2 envelopes never pass as V1', async () => {
    const v2File = new File([JSON.stringify(V2_ENVELOPE)], 'operations.json', { type: 'application/json' });
    await expect(parseAiArchiveFile(v2File)).rejects.toThrow();

    const v1Envelope = {
      schemaVersion: '1.0.0',
      baseRevision: 7,
      operations: [{ op: 'update', scope: 'educationGroups', id: 'grupo-um', patch: { title: 'Grupo um' } }],
      selfCheck: {
        reviewed: true,
        noOutOfScopeChanges: true,
        noUnrequestedDeletes: true,
        noUnsupportedImagePaths: true,
        notes: [],
      },
    };
    const v1File = new File([JSON.stringify(v1Envelope)], 'operations.json', { type: 'application/json' });
    await expect(parseAiArchiveFile(v1File)).resolves.toMatchObject({ schemaVersion: '1.0.0' });

    const v2Result = parseOperationsEnvelope(V2_ENVELOPE);
    expect(v2Result.ok).toBe(true);
    const v1AsV2 = parseOperationsEnvelope(v1Envelope);
    expect(v1AsV2.ok === false && v1AsV2.error.code).toBe('unsupported_schema');
  });
});
