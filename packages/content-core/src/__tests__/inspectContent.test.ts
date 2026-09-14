import { describe, expect, it } from 'vitest';
import { inspectContent } from '../index';
import type { PublishedContentPayload } from '../index';

function validPayload(): PublishedContentPayload {
  return {
    flows: [
      {
        id: 'fluxo',
        version: '1.0.0',
        locale: 'pt-BR',
        title: 'Fluxo',
        type: 'guided_conversation',
        status: 'approved',
        entry: { nodeId: 'inicio', enteringPhrases: ['oi'], transitionMessage: 'vamos' },
        nodes: {
          inicio: {
            id: 'inicio',
            kind: 'choice',
            text: 'Como você está?',
            options: [{ id: 'op1', label: 'Ok', next: 'fim' }],
          },
          fim: { id: 'fim', kind: 'result', text: 'Tudo bem.', recommendations: [] },
        },
      },
    ],
    educationMaterials: [
      {
        id: 'm1',
        title: 'Material',
        source: 'Fonte',
        description: 'Descrição',
        tags: ['tag'],
        audience: 'teachers',
        featuredImage: { kind: 'catalog', imageId: 'classroom-1' },
        review: { status: 'approved', reviewedBy: null, reviewedAt: null, notes: '' },
      },
    ],
    educationGroups: [],
    contacts: [],
    locations: [],
    defaultGroupOrder: 1,
  };
}

describe('inspectContent', () => {
  it('returns the payload and valid=true for a semantically valid candidate', () => {
    const inspection = inspectContent(validPayload());
    expect(inspection.payload).not.toBeNull();
    expect(inspection.validation.valid).toBe(true);
    // Empty locations are structurally valid; the contacts validator only adds
    // the deterministic "no-locations" warning for them.
    expect(inspection.validation.issues).toEqual([
      {
        code: 'no-locations',
        level: 'warning',
        message: 'Nenhuma cidade cadastrada — contatos sem local aparecerão como nacionais.',
      },
    ]);
  });

  it('returns a single invalid_payload issue when publication parsing throws', () => {
    const inspection = inspectContent({ flows: 'não é uma lista' });
    expect(inspection.payload).toBeNull();
    expect(inspection.validation.valid).toBe(false);
    expect(inspection.validation.issues).toHaveLength(1);
    expect(inspection.validation.issues[0]?.code).toBe('invalid_payload');
    expect(inspection.validation.issues[0]?.level).toBe('error');
  });

  it('keeps structurally valid but semantically invalid candidates and reports the issues', () => {
    const candidate = validPayload() as unknown as Record<string, unknown>;
    const material = { ...(candidate.educationMaterials as Array<Record<string, unknown>>)[0]! };
    material.featuredImage = { kind: 'catalog', imageId: 'imagem-inexistente' };
    material.tags = [];
    (candidate.educationMaterials as Array<Record<string, unknown>>)[0] = material;

    const inspection = inspectContent(candidate);
    expect(inspection.payload).not.toBeNull();
    expect(inspection.validation.valid).toBe(false);
    const ids = inspection.validation.issues.map((issue) => issue.code);
    expect(ids).toContain('unknown-featured-image:m1');
    expect(ids).toContain('empty-tags:m1');
    expect(inspection.validation.issues.every((issue) => typeof issue.message === 'string')).toBe(true);
  });

  it('does not normalize or replace the candidate payload it returns', () => {
    const candidate = validPayload();
    const inspection = inspectContent(candidate);
    expect(inspection.payload).toEqual(candidate);
  });
});
