import { describe, expect, it } from 'vitest';
import type { PublishedContentPayload } from '../../../app/content/publishedContent';
import { applyAiOperations, parseAiOperationsResponse } from '../aiOperations';

const payload: PublishedContentPayload = {
  flows: [],
  educationMaterials: [],
  educationGroups: [
    { id: 'grupo-um', title: 'Grupo um', order: 1 },
    { id: 'grupo-dois', title: 'Grupo dois', order: 2 },
  ],
  contacts: [],
  locations: [],
  defaultGroupOrder: 0,
};

function envelope(operations: unknown[]) {
  return {
    schemaVersion: '1.0.0',
    baseRevision: 39,
    operations,
    selfCheck: {
      reviewed: true,
      noOutOfScopeChanges: true,
      noUnrequestedDeletes: true,
      noUnsupportedImagePaths: true,
      notes: ['IDs e referências conferidos.'],
    },
  };
}

describe('operações de IA', () => {
  it('aplica apenas updates explícitos e preserva os itens ausentes', () => {
    const operations = parseAiOperationsResponse(
      envelope([{ op: 'update', scope: 'educationGroups', id: 'grupo-um', patch: { title: 'Grupo revisado' } }]),
    );

    const result = applyAiOperations(payload, operations, 39);

    expect(result.educationGroups).toEqual([
      { id: 'grupo-um', title: 'Grupo revisado', order: 1 },
      { id: 'grupo-dois', title: 'Grupo dois', order: 2 },
    ]);
  });

  it('só remove um item por uma operação delete explicitamente confirmada', () => {
    const operations = parseAiOperationsResponse(
      envelope([{ op: 'delete', scope: 'educationGroups', id: 'grupo-um', confirmation: true }]),
    );

    const result = applyAiOperations(payload, operations, 39);

    expect(result.educationGroups.map((group) => group.id)).toEqual(['grupo-dois']);
  });

  it('rejeita campos desconhecidos, confirmação ausente e paths de imagem de arquivo', () => {
    expect(() =>
      parseAiOperationsResponse(
        envelope([{ op: 'update', scope: 'educationGroups', id: 'grupo-um', patch: { titulo: 'Inválido' } }]),
      ),
    ).toThrow('não permitido');

    expect(() =>
      parseAiOperationsResponse(
        envelope([{ op: 'delete', scope: 'educationGroups', id: 'grupo-um', confirmation: false }]),
      ),
    ).toThrow('confirmation');

    expect(() =>
      parseAiOperationsResponse(
        envelope([{ op: 'update', scope: 'educationMaterials', id: 'x', patch: { imageUrl: './images/x.png' } }]),
      ),
    ).toThrow('Imagens não podem ser alteradas pela IA');
  });

  it('rejeita uma resposta preparada para outra revisão e conteúdo final inválido', () => {
    const operations = parseAiOperationsResponse(
      envelope([{ op: 'update', scope: 'educationGroups', id: 'grupo-um', patch: { title: '' } }]),
    );

    expect(() => applyAiOperations(payload, operations, 40)).toThrow('revisão 39');
    expect(() => applyAiOperations(payload, operations, 39)).toThrow('precisa de um "title"');
  });
});
