import { describe, expect, it } from 'vitest';
import type { EditorialOperation, EditorialEnvelope } from '@bemtevi/content-core';
import {
  EDITORIAL_SCOPES,
  applyOperations,
  conformanceBasePayload,
  encodeOperations,
  fixtureAddValues,
  fixtureNoopOperations,
  fixtureSemanticInvalidOperations,
  fixtureUnsetOperations,
  parseEditorialOperation,
  parseOperationsEnvelope,
  buildFixtureEnvelope,
  FIXTURE_BASE_GENERATION,
} from '@bemtevi/content-core';

const base = () => JSON.parse(JSON.stringify(conformanceBasePayload)) as typeof conformanceBasePayload;

const VALID_EXPORT = {
  schemaVersion: '2.0.0',
  exportId: '00000000-0000-4000-8000-000000000001',
  baseGeneration: 1,
  baseDigest: 'a'.repeat(64),
  selfCheck: {
    reviewed: true,
    noOutOfScopeChanges: true,
    noUnrequestedDeletes: true,
    noUnsupportedImagePaths: true,
    notes: [],
  },
} as const;

function envelope(operations: unknown[]): Record<string, unknown> {
  return { ...VALID_EXPORT, operations };
}

function expectInvalid(
  result: { ok: boolean; error?: { code: string; message: string } },
  code: string,
  fragment?: string,
) {
  expect(result.ok).toBe(false);
  expect(result.error?.code).toBe(code);
  if (fragment) expect(result.error?.message).toContain(fragment);
}

describe('literal allowlists (parse)', () => {
  it('accepts an add covering every allowed key of every scope', () => {
    for (const scope of EDITORIAL_SCOPES) {
      const parsed = parseEditorialOperation({ op: 'add', scope, value: fixtureAddValues[scope] });
      expect(parsed.ok, `${scope}: ${parsed.ok === false ? parsed.error.message : ''}`).toBe(true);
    }
  });

  it('rejects unknown add keys and missing id for every scope', () => {
    for (const scope of EDITORIAL_SCOPES) {
      const value = { ...fixtureAddValues[scope], campoEstranho: 1 };
      expectInvalid(parseEditorialOperation({ op: 'add', scope, value }), 'invalid_operations', 'não permitido');
      const withoutId = { ...fixtureAddValues[scope] };
      delete withoutId.id;
      expectInvalid(parseEditorialOperation({ op: 'add', scope, value: withoutId }), 'invalid_operations', 'id');
    }
  });

  it('rejects material add values that set protected top-level image fields', () => {
    expectInvalid(
      parseEditorialOperation({
        op: 'add',
        scope: 'educationMaterials',
        value: { ...fixtureAddValues.educationMaterials, imageUrl: 'https://x.bemtevi.org/a.png' },
      }),
      'invalid_operations',
      'não permitido',
    );
  });

  it('rejects unknown patch keys and unknown unset keys for every scope', () => {
    for (const scope of EDITORIAL_SCOPES) {
      expectInvalid(
        parseEditorialOperation({ op: 'update', scope, id: 'x', patch: { campoEstranho: 1 }, unset: [] }),
        'invalid_operations',
        'não permitido',
      );
      expectInvalid(
        parseEditorialOperation({ op: 'update', scope, id: 'x', patch: {}, unset: ['campoEstranho'] }),
        'invalid_operations',
        'não permitido',
      );
    }
  });

  it('rejects protected image keys in material updates and locations unset', () => {
    expectInvalid(
      parseEditorialOperation({
        op: 'update',
        scope: 'educationMaterials',
        id: 'material-exemplo',
        patch: { featuredImage: { kind: 'catalog', imageId: 'classroom-1' } },
        unset: [],
      }),
      'invalid_operations',
    );
    expectInvalid(
      parseEditorialOperation({
        op: 'update',
        scope: 'educationMaterials',
        id: 'material-exemplo',
        patch: {},
        unset: ['imageUrl'],
      }),
      'invalid_operations',
    );
    expectInvalid(
      parseEditorialOperation({ op: 'update', scope: 'locations', id: 'local-um', patch: {}, unset: ['city'] }),
      'invalid_operations',
    );
  });

  it('rejects patch/unset overlap, duplicates and empty updates', () => {
    expectInvalid(
      parseEditorialOperation({
        op: 'update',
        scope: 'educationGroups',
        id: 'grupo-um',
        patch: { description: 'A' },
        unset: ['description'],
      }),
      'invalid_operations',
      'patch" e "unset',
    );
    expectInvalid(
      parseEditorialOperation({
        op: 'update',
        scope: 'educationGroups',
        id: 'grupo-um',
        patch: {},
        unset: ['description', 'description'],
      }),
      'invalid_operations',
      'repetidos',
    );
    expectInvalid(
      parseEditorialOperation({ op: 'update', scope: 'educationGroups', id: 'grupo-um', patch: {}, unset: [] }),
      'invalid_operations',
      'vazio',
    );
  });

  it('rejects prototype keys, non-finite numbers and unknown ops', () => {
    const value = JSON.parse('{"id":"x","title":"T","__proto__":{}}');
    expectInvalid(parseEditorialOperation({ op: 'add', scope: 'educationGroups', value }), 'invalid_operations');
    expectInvalid(
      parseEditorialOperation({ op: 'update', scope: 'educationGroups', id: 'x', patch: { title: NaN }, unset: [] }),
      'invalid_operations',
    );
    expectInvalid(parseEditorialOperation({ op: 'upsell', scope: 'flows' }), 'invalid_operations', 'op');
  });

  it('validates delete confirmation, reorder ids and scalar bounds', () => {
    expectInvalid(
      parseEditorialOperation({ op: 'delete', scope: 'locations', id: 'x', confirmation: false }),
      'invalid_operations',
      'confirmation',
    );
    expectInvalid(parseEditorialOperation({ op: 'reorder', scope: 'locations', ids: [] }), 'invalid_operations');
    expectInvalid(
      parseEditorialOperation({ op: 'reorder', scope: 'locations', ids: ['a', 'a'] }),
      'invalid_operations',
      'distintos',
    );
    expectInvalid(
      parseEditorialOperation({ op: 'set_default_group_order', value: 1.5 }),
      'invalid_operations',
      'inteiro',
    );
    expect(parseEditorialOperation({ op: 'set_default_group_order', value: 3 }).ok).toBe(true);
  });
});

describe('envelope parsing and bounds', () => {
  it('rejects a V1 response with unsupported_schema', () => {
    const v1 = {
      schemaVersion: '1.0.0',
      baseRevision: 39,
      operations: [{ op: 'update', scope: 'educationGroups', id: 'grupo-um', patch: { title: 'T' } }],
      selfCheck: VALID_EXPORT.selfCheck,
    };
    expectInvalid(parseOperationsEnvelope(v1), 'unsupported_schema');
  });

  it('rejects unknown envelope keys, bad digests, empty and oversized batches', () => {
    expectInvalid(parseOperationsEnvelope({ ...envelope([]), extra: 1 }), 'invalid_operations');
    expectInvalid(
      parseOperationsEnvelope({
        ...envelope([fixtureAddValues.educationGroups ? { op: 'set_default_group_order', value: 1 } : null]),
        baseDigest: 'XYZ',
      }),
      'invalid_operations',
    );
    expectInvalid(parseOperationsEnvelope(envelope([])), 'invalid_operations');
    const oversized: unknown[] = Array.from({ length: 201 }, () => ({ op: 'set_default_group_order', value: 1 }));
    expectInvalid(parseOperationsEnvelope(envelope(oversized)), 'invalid_operations', '200');
  });

  it('validates selfCheck shape and notes bounds', () => {
    const missingFlags = { ...envelope([{ op: 'set_default_group_order', value: 1 }]) };
    (missingFlags.selfCheck as Record<string, unknown>) = { ...VALID_EXPORT.selfCheck, reviewed: false };
    expectInvalid(parseOperationsEnvelope(missingFlags), 'invalid_operations');
    const manyNotes = {
      ...envelope([{ op: 'set_default_group_order', value: 1 }]),
      selfCheck: { ...VALID_EXPORT.selfCheck, notes: Array.from({ length: 21 }, () => 'x') },
    };
    expectInvalid(parseOperationsEnvelope(manyNotes), 'invalid_operations');
  });

  it('parses a well-formed envelope and preserves operations', () => {
    const operations: EditorialOperation[] = [
      { op: 'set_default_group_order', value: 2 },
      ...fixtureUnsetOperations.flows,
    ];
    const parsed = parseOperationsEnvelope(envelope(operations));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.data.operations).toEqual(operations);
  });
});

describe('apply semantics', () => {
  it('applies add/update/unset/delete and preserves explicit order', () => {
    const operations: EditorialOperation[] = [
      { op: 'add', scope: 'educationGroups', value: { id: 'grupo-novo', title: 'Novo', order: 3 } },
      { op: 'update', scope: 'educationGroups', id: 'grupo-um', patch: { title: 'Revisado' }, unset: [] },
      { op: 'update', scope: 'educationGroups', id: 'grupo-dois', patch: {}, unset: ['description'] },
      { op: 'delete', scope: 'educationGroups', id: 'grupo-dois', confirmation: true },
    ];
    const result = applyOperations(base(), operations);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.educationGroups).toEqual([
        { id: 'grupo-um', title: 'Revisado', description: 'Primeiro grupo.', order: 1 },
        { id: 'grupo-novo', title: 'Novo', order: 3 },
      ]);
    }
  });

  it('requires reorder to be a permutation and applies the new order', () => {
    const result = applyOperations(base(), [
      { op: 'reorder', scope: 'educationGroups', ids: ['grupo-dois', 'grupo-um'] },
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.educationGroups.map((g) => g.id)).toEqual(['grupo-dois', 'grupo-um']);
    expectInvalid(
      applyOperations(base(), [{ op: 'reorder', scope: 'educationGroups', ids: ['grupo-um'] }]),
      'invalid_operations',
      'permutação',
    );
  });

  it('rejects duplicate adds, missing ids and duplicate base ids', () => {
    expectInvalid(
      applyOperations(base(), [{ op: 'add', scope: 'educationGroups', value: { id: 'grupo-um', order: 9 } }]),
      'invalid_operations',
      'já existe',
    );
    expectInvalid(
      applyOperations(base(), [{ op: 'delete', scope: 'educationGroups', id: 'fantasma', confirmation: true }]),
      'invalid_operations',
      'não existe',
    );
  });

  it('preserves protected image slots through generic operations', () => {
    const operations: EditorialOperation[] = [
      { op: 'update', scope: 'educationMaterials', id: 'material-exemplo', patch: { title: 'Novo título' }, unset: [] },
      { op: 'update', scope: 'educationMaterials', id: 'material-exemplo', patch: {}, unset: ['href'] },
      { op: 'update', scope: 'educationMaterials', id: 'material-exemplo', patch: {}, unset: ['body'] },
    ];
    const result = applyOperations(base(), operations);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const material = result.data.educationMaterials[0];
      expect(material.title).toBe('Novo título');
      expect(material.featuredImage).toEqual({ kind: 'catalog', imageId: 'classroom-1' });
      expect(material.imageUrl).toBe('https://exemplo.bemtevi.org/legado.png');
      expect(material.imageFileName).toBe('legado.png');
    }
  });

  it('rejects generic changes to retained body image blocks and new image data', () => {
    for (const fixture of fixtureSemanticInvalidOperations) {
      const operations = [fixture.operation];
      const parsed = parseOperationsEnvelope(envelope(operations));
      if (parsed.ok) {
        const applied = applyOperations(base(), parsed.data.operations);
        expect(applied.ok).toBe(false);
        if (applied.ok === false) {
          expect(['invalid_operations', 'invalid_image']).toContain(applied.error.code);
        }
      }
    }
  });

  it('accepts an no-op update without changing the payload', () => {
    const result = applyOperations(base(), fixtureNoopOperations);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual(base());
  });
});

describe('encode/apply roundtrip', () => {
  it('produces an empty list for an unchanged candidate', () => {
    const encoded = encodeOperations(base(), base());
    expect(encoded.ok).toBe(true);
    if (encoded.ok) expect(encoded.data).toEqual([]);
  });

  it('encodes a title-only change omitting unchanged body/image fields', () => {
    const candidate = base();
    candidate.educationMaterials[0].title = 'Só o título mudou';
    const encoded = encodeOperations(base(), candidate);
    expect(encoded.ok).toBe(true);
    if (encoded.ok) {
      expect(encoded.data).toHaveLength(1);
      const operation = encoded.data[0] as Extract<EditorialOperation, { op: 'update' }>;
      expect(operation.op).toBe('update');
      expect(operation.patch).toEqual({ title: 'Só o título mudou' });
      expect(operation.unset).toEqual([]);
      expect(Object.keys(operation.patch).some((key) => key.includes('image') || key === 'body')).toBe(false);
    }
  });

  it('roundtrips add/update/unset/delete/reorder/scalar exactly', () => {
    const candidate = base();
    candidate.educationGroups = [
      { id: 'grupo-dois', title: 'Grupo dois', order: 2 },
      { id: 'grupo-novo', title: 'Novo', description: 'D', order: 3 },
      { id: 'grupo-um', title: 'Grupo um', order: 1 },
    ];
    candidate.defaultGroupOrder = 2;
    candidate.contacts[0].hours = undefined;
    const encoded = encodeOperations(base(), candidate);
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;
    const applied = applyOperations(base(), encoded.data);
    expect(applied.ok).toBe(true);
    if (applied.ok) {
      expect(applied.data).toEqual(candidate);
      const reorder = encoded.data.find((op) => op.op === 'reorder') as { ids: string[] } | undefined;
      expect(reorder?.ids).toEqual(['grupo-dois', 'grupo-novo', 'grupo-um']);
    }
  });

  it('encodes retained image changes only through set_material_image', () => {
    const candidate = base();
    candidate.educationMaterials[0].featuredImage = {
      kind: 'external',
      imageUrl: 'https://novo.bemtevi.org/x.png',
      alt: 'X',
    };
    candidate.educationMaterials[0].imageUrl = undefined;
    candidate.educationMaterials[0].imageFileName = undefined;
    const encoded = encodeOperations(base(), candidate);
    expect(encoded.ok).toBe(true);
    if (encoded.ok) {
      const imageOps = encoded.data.filter((op) => op.op === 'set_material_image');
      expect(imageOps).toHaveLength(2);
      expect(encoded.data.every((op) => op.op === 'set_material_image' || op.op === 'update')).toBe(true);
      const updates = encoded.data.filter((op) => op.op === 'update') as Array<{ patch: Record<string, unknown> }>;
      expect(updates.every((op) => !('imageUrl' in op.patch) && !('featuredImage' in op.patch))).toBe(true);
    }
  });

  it('rejects flow visuals changes as unrepresentable', () => {
    const candidate = base();
    const node = (candidate.flows[0].nodes as unknown as Record<string, Record<string, unknown>>)['no-um'];
    node.visuals = [{ id: 'visual-dois', alt: 'Outra', src: 'https://x.bemtevi.org/y.png' }];
    expectInvalid(encodeOperations(base(), candidate), 'invalid_operations', 'visuals');
  });

  it('rejects more than 200 encoded operations', () => {
    const candidate = base();
    const operations: EditorialOperation[] = [];
    for (let index = 0; index < 201; index += 1) {
      operations.push({ op: 'add', scope: 'locations', value: { id: `local-${index}`, city: 'C', state: 'PR' } });
      (candidate.locations as unknown[]).push({ id: `local-${index}`, city: 'C', state: 'PR' });
    }
    const encoded = encodeOperations(base(), candidate);
    expectInvalid(encoded, 'invalid_operations', '200');
  });
});

describe('envelope helper fixtures', () => {
  it('builds a deterministic stale-generation envelope', () => {
    const envelopeFixture: EditorialEnvelope = buildFixtureEnvelope([{ op: 'set_default_group_order', value: 2 }]);
    expect(envelopeFixture.baseGeneration).toBe(FIXTURE_BASE_GENERATION);
    expect(parseOperationsEnvelope({ ...envelopeFixture, baseGeneration: FIXTURE_BASE_GENERATION + 1 }).ok).toBe(true);
  });
});
