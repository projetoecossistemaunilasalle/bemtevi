import { mcpTools, scopeSchema, textSchema } from './protocolInput';

type JsonRecord = Record<string, unknown>;

const nullableIntegerSchema = { type: ['integer', 'null'] } as const;
const nullableStringSchema = { type: ['string', 'null'] } as const;
const digestSchema = { type: 'string', pattern: '^[a-f0-9]{64}$' } as const;
const validationSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['valid', 'issues'],
  properties: {
    valid: { type: 'boolean' },
    issues: { type: 'array', items: { type: 'object' } },
  },
} as const;
const mutationOutputSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['draftId', 'generation', 'baseRevision', 'baseDigest', 'candidateDigest', 'validation', 'diff', 'status'],
  properties: {
    draftId: textSchema,
    generation: { type: 'integer' },
    baseRevision: nullableIntegerSchema,
    baseDigest: digestSchema,
    candidateDigest: digestSchema,
    validation: validationSchema,
    diff: { type: 'array', items: { type: 'object' } },
    status: { type: 'string', enum: ['valid', 'invalid'] },
  },
} as const;

const outputSchemas: Record<string, JsonRecord> = {
  get_published_revision: {
    type: 'object',
    additionalProperties: false,
    required: ['revision', 'schemaVersion', 'digest', 'publishedAt', 'publishedBy', 'counts'],
    properties: {
      revision: nullableIntegerSchema,
      schemaVersion: nullableStringSchema,
      digest: { type: ['string', 'null'], pattern: '^[a-f0-9]{64}$' },
      publishedAt: nullableStringSchema,
      publishedBy: nullableStringSchema,
      counts: { type: 'object', additionalProperties: { type: 'integer' } },
    },
  },
  list_published_items: {
    type: 'object',
    additionalProperties: false,
    required: ['revision', 'scope', 'fields', 'items', 'nextCursor', 'hasMore', 'bytes'],
    properties: {
      revision: nullableIntegerSchema,
      scope: scopeSchema,
      fields: { type: 'array', items: textSchema },
      items: { type: 'array', items: { type: 'object' } },
      nextCursor: nullableStringSchema,
      hasMore: { type: 'boolean' },
      bytes: { type: 'integer' },
    },
  },
  find_material_references: {
    type: 'object',
    additionalProperties: false,
    required: ['revision', 'id', 'references'],
    properties: {
      revision: nullableIntegerSchema,
      id: textSchema,
      references: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['path'],
          properties: { path: { type: 'string' } },
        },
      },
    },
  },
  get_flow: itemOutputSchema('flows'),
  get_material: itemOutputSchema('educationMaterials'),
  validate_content_patch: {
    type: 'object',
    additionalProperties: false,
    required: ['baseRevision', 'candidate', 'candidateDigest', 'validation', 'diff'],
    properties: {
      baseRevision: { type: 'integer' },
      candidate: { type: 'object' },
      candidateDigest: digestSchema,
      validation: validationSchema,
      diff: { type: 'array', items: { type: 'object' } },
    },
  },
  create_draft: mutationOutputSchema,
  update_draft: mutationOutputSchema,
  get_draft: {
    type: 'object',
    additionalProperties: false,
    required: [
      'schemaVersion',
      'draftId',
      'generation',
      'base',
      'candidate',
      'candidateDigest',
      'validation',
      'createdAt',
      'updatedAt',
      'status',
    ],
    properties: {
      schemaVersion: { const: 1 },
      draftId: textSchema,
      generation: { type: 'integer' },
      base: { type: 'object' },
      candidate: { type: 'object' },
      candidateDigest: digestSchema,
      validation: validationSchema,
      createdAt: textSchema,
      updatedAt: textSchema,
      status: { type: 'string', enum: ['valid', 'invalid'] },
    },
  },
  get_draft_diff: {
    type: 'object',
    additionalProperties: false,
    required: [
      'draftId',
      'generation',
      'against',
      'againstRevision',
      'baseDigest',
      'candidateDigest',
      'validation',
      'diff',
    ],
    properties: {
      draftId: textSchema,
      generation: { type: 'integer' },
      against: { type: 'string', enum: ['base', 'published'] },
      againstRevision: nullableIntegerSchema,
      baseDigest: digestSchema,
      candidateDigest: digestSchema,
      validation: validationSchema,
      diff: { type: 'array', items: { type: 'object' } },
    },
  },
  prepare_publish: {
    type: 'object',
    additionalProperties: false,
    required: [
      'draftId',
      'generation',
      'expectedRevision',
      'candidateDigest',
      'publishToken',
      'expiresAt',
      'diff',
      'summary',
    ],
    properties: {
      draftId: textSchema,
      generation: { type: 'integer' },
      expectedRevision: nullableIntegerSchema,
      candidateDigest: digestSchema,
      publishToken: textSchema,
      expiresAt: textSchema,
      diff: { type: 'array', items: { type: 'object' } },
      summary: { type: 'object', additionalProperties: { type: 'integer' } },
    },
  },
  publish_draft: {
    type: 'object',
    additionalProperties: false,
    required: ['draftId', 'generation', 'revision', 'digest', 'status'],
    properties: {
      draftId: textSchema,
      generation: { type: 'integer' },
      revision: { type: 'integer' },
      digest: digestSchema,
      status: { const: 'published' },
      confirmed: { type: 'boolean' },
    },
  },
};

export const announcedTools = mcpTools.map((tool) => ({
  ...tool,
  outputSchema: outputSchemas[tool.name],
  ...(tool.name === 'publish_draft'
    ? { annotations: { destructiveHint: true, idempotentHint: false, openWorldHint: true } }
    : {
        annotations: {
          readOnlyHint: !['create_draft', 'update_draft', 'prepare_publish'].includes(tool.name),
          openWorldHint: false,
        },
      }),
}));

function itemOutputSchema(scope: 'flows' | 'educationMaterials'): JsonRecord {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['revision', 'scope', 'item'],
    properties: {
      revision: nullableIntegerSchema,
      scope: { const: scope },
      item: { type: 'object' },
    },
  };
}
