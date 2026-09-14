/** Representative semantic-invalid draft states (structural parse may accept them; apply rejects). */
export const fixtureSemanticInvalidOperations: Array<{ name: string; operation: unknown }> = [
  {
    name: 'add-existing-id',
    operation: { op: 'add', scope: 'educationGroups', value: { id: 'grupo-um', title: 'Duplicado', order: 9 } },
  },
  {
    name: 'update-missing-id',
    operation: { op: 'update', scope: 'contacts', id: 'inexistente', patch: { name: 'X' }, unset: [] },
  },
  { name: 'delete-missing-id', operation: { op: 'delete', scope: 'locations', id: 'inexistente', confirmation: true } },
  { name: 'reorder-not-permutation', operation: { op: 'reorder', scope: 'educationGroups', ids: ['grupo-um'] } },
  {
    name: 'material-image-block-change',
    operation: {
      op: 'update',
      scope: 'educationMaterials',
      id: 'material-exemplo',
      patch: {
        body: [
          {
            id: 'bloco-imagem',
            kind: 'image',
            imageUrl: 'https://troca.bemtevi.org/outra.png',
            alt: 'Imagem do corpo',
          },
        ],
      },
      unset: [],
    },
  },
  {
    name: 'flow-visuals-edit',
    operation: {
      op: 'update',
      scope: 'flows',
      id: 'fluxo-exemplo',
      patch: {
        nodes: {
          'no-um': {
            id: 'no-um',
            kind: 'choice',
            text: 'Como você está hoje?',
            options: [{ id: 'opcao-um', label: 'Preciso de apoio', next: 'no-dois' }],
          },
        },
      },
      unset: [],
    },
  },
  {
    name: 'missing-body-block',
    operation: {
      op: 'set_material_image',
      materialId: 'material-exemplo',
      slot: { kind: 'body', blockId: 'bloco-ausente' },
      image: { kind: 'remove' },
    },
  },
];
