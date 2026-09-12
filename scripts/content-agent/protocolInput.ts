export const MAX_PAGE_SIZE = 100;
export const SCOPES = ['flows', 'educationMaterials', 'educationGroups', 'contacts', 'locations'] as const;
export type Scope = (typeof SCOPES)[number];

export const textSchema = { type: 'string', minLength: 1 } as const;
export const scopeSchema = { type: 'string', enum: [...SCOPES] } as const;
const operationSchema = {
  type: 'array',
  minItems: 1,
  items: {
    oneOf: [
      {
        type: 'object',
        additionalProperties: false,
        required: ['op', 'scope', 'value'],
        properties: {
          op: { const: 'add' },
          scope: scopeSchema,
          value: { type: 'object' },
        },
      },
      {
        type: 'object',
        additionalProperties: false,
        required: ['op', 'scope', 'id', 'patch'],
        properties: {
          op: { const: 'update' },
          scope: scopeSchema,
          id: textSchema,
          patch: { type: 'object', minProperties: 1 },
        },
      },
      {
        type: 'object',
        additionalProperties: false,
        required: ['op', 'scope', 'id', 'confirmation'],
        properties: {
          op: { const: 'delete' },
          scope: scopeSchema,
          id: textSchema,
          confirmation: { const: true },
        },
      },
    ],
  },
} as const;

export const mcpTools = [
  {
    name: 'get_published_revision',
    description: 'Retorna metadados mínimos da revisão publicada atual.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {} },
  },
  {
    name: 'list_published_items',
    description: 'Lista itens publicados com projeção, paginação e limite de 100 itens.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['scope'],
      properties: {
        scope: scopeSchema,
        fields: { type: 'array', maxItems: 20, items: textSchema },
        cursor: { type: 'string', minLength: 1 },
        limit: { type: 'integer', minimum: 1, maximum: MAX_PAGE_SIZE },
      },
    },
  },
  {
    name: 'find_material_references',
    description: 'Localiza referências exatas a um identificador no conteúdo publicado.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['id'],
      properties: { id: textSchema },
    },
  },
  {
    name: 'get_flow',
    description: 'Obtém um fluxo completo pelo ID na revisão publicada atual.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['id'],
      properties: { id: textSchema, revision: { type: 'integer', minimum: 1 } },
    },
  },
  {
    name: 'get_material',
    description: 'Obtém um material completo pelo ID na revisão publicada atual.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['id'],
      properties: { id: textSchema, revision: { type: 'integer', minimum: 1 } },
    },
  },
  {
    name: 'validate_content_patch',
    description: 'Aplica operações em memória e retorna candidato, digest, validação e diff.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['baseRevision', 'operations'],
      properties: { baseRevision: { type: 'integer', minimum: 1 }, operations: operationSchema },
    },
  },
  {
    name: 'create_draft',
    description: 'Cria um rascunho versionado no DraftStore local.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['baseRevision'],
      oneOf: [
        { required: ['candidate'], not: { required: ['operations'] } },
        { required: ['operations'], not: { required: ['candidate'] } },
      ],
      properties: {
        baseRevision: { type: ['integer', 'null'], minimum: 1 },
        operations: operationSchema,
        candidate: { type: 'object' },
        idempotencyKey: { type: 'string', minLength: 1, maxLength: 200 },
      },
    },
  },
  {
    name: 'update_draft',
    description: 'Atualiza um rascunho usando expectedGeneration, sem last-write-wins.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['draftId', 'expectedGeneration'],
      oneOf: [
        { required: ['candidate'], not: { required: ['operations'] } },
        { required: ['operations'], not: { required: ['candidate'] } },
      ],
      properties: {
        draftId: textSchema,
        expectedGeneration: { type: 'integer', minimum: 1 },
        operations: operationSchema,
        candidate: { type: 'object' },
        idempotencyKey: { type: 'string', minLength: 1, maxLength: 200 },
      },
    },
  },
  {
    name: 'get_draft',
    description: 'Obtém um rascunho e sua validação, opcionalmente em uma geração exata.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['draftId'],
      properties: { draftId: textSchema, generation: { type: 'integer', minimum: 1 } },
    },
  },
  {
    name: 'get_draft_diff',
    description: 'Compara um rascunho com a base ou com a revisão publicada atual.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['draftId'],
      properties: {
        draftId: textSchema,
        generation: { type: 'integer', minimum: 1 },
        against: { type: 'string', enum: ['base', 'published'] },
      },
    },
  },
  {
    name: 'prepare_publish',
    description: 'Recarrega a publicação, valida e congela uma geração para publicação.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['draftId', 'generation', 'expectedRevision'],
      properties: {
        draftId: textSchema,
        generation: { type: 'integer', minimum: 1 },
        expectedRevision: { type: ['integer', 'null'], minimum: 1 },
      },
    },
  },
  {
    name: 'publish_draft',
    description: 'Publica uma geração preparada; é destrutiva, não idempotente e exige aprovação do host.',
    annotations: { destructiveHint: true, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['draftId', 'generation', 'expectedRevision', 'publishToken'],
      properties: {
        draftId: textSchema,
        generation: { type: 'integer', minimum: 1 },
        expectedRevision: { type: ['integer', 'null'], minimum: 1 },
        publishToken: textSchema,
      },
    },
  },
] as const;

export const toolArgumentKeys: Record<string, ReadonlySet<string>> = {
  get_published_revision: new Set(),
  list_published_items: new Set(['scope', 'fields', 'cursor', 'limit']),
  find_material_references: new Set(['id']),
  get_flow: new Set(['id', 'revision']),
  get_material: new Set(['id', 'revision']),
  validate_content_patch: new Set(['baseRevision', 'operations']),
  create_draft: new Set(['baseRevision', 'operations', 'candidate', 'idempotencyKey']),
  update_draft: new Set(['draftId', 'expectedGeneration', 'operations', 'candidate', 'idempotencyKey']),
  get_draft: new Set(['draftId', 'generation']),
  get_draft_diff: new Set(['draftId', 'generation', 'against']),
  prepare_publish: new Set(['draftId', 'generation', 'expectedRevision']),
  publish_draft: new Set(['draftId', 'generation', 'expectedRevision', 'publishToken']),
};
