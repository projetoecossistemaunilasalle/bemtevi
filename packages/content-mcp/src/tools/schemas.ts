/**
 * Strict tool input JSON schemas (doc 04 "Tool Input And Output Catalog").
 * Every schema is a strict JSON Schema object: `additionalProperties: false`
 * plus the required keys below; the SDK `fromJsonSchema` adapter enforces them
 * before a handler runs. Nested operation `value`/`patch` payloads keep their
 * own frozen allowlist checks in content-core (parseEditorialOperation).
 */

export const SCOPE_ENUM = ['flows', 'educationMaterials', 'educationGroups', 'contacts', 'locations'] as const;

const GENERATION = { type: 'integer', minimum: 1, maximum: 9007199254740991 } as const;
const ID = { type: 'string', minLength: 1, maxLength: 200 } as const;
const OFFSET = { type: 'integer', minimum: 0, maximum: 9007199254740991, default: 0 } as const;
const LIST_LIMIT = { type: 'integer', minimum: 1, maximum: 100, default: 50 } as const;
const REFERENCES_LIMIT = { type: 'integer', minimum: 1, maximum: 100, default: 50 } as const;
const DIFF_LIMIT = { type: 'integer', minimum: 1, maximum: 100, default: 50 } as const;
const ITEM_LIMIT = { type: 'integer', minimum: 1, maximum: 16000, default: 8000 } as const;
const SCOPE = { type: 'string', enum: [...SCOPE_ENUM] } as const;

const IMAGE_SLOT = {
  anyOf: [
    { type: 'object', properties: { kind: { const: 'featured' } }, required: ['kind'], additionalProperties: false },
    { type: 'object', properties: { kind: { const: 'legacy' } }, required: ['kind'], additionalProperties: false },
    {
      type: 'object',
      properties: { kind: { const: 'body' }, blockId: ID },
      required: ['kind', 'blockId'],
      additionalProperties: false,
    },
  ],
} as const;

const IMAGE_VALUE = {
  anyOf: [
    {
      type: 'object',
      properties: {
        kind: { const: 'uploaded' },
        mime: { type: 'string', enum: ['image/png', 'image/jpeg', 'image/webp'] },
        base64: { type: 'string' },
        fileName: { type: 'string', minLength: 1, maxLength: 120 },
        alt: { type: 'string', maxLength: 500 },
      },
      required: ['kind', 'mime', 'base64', 'fileName', 'alt'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: { kind: { const: 'catalog' }, imageId: { type: 'string', minLength: 1 } },
      required: ['kind', 'imageId'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        kind: { const: 'external' },
        url: { type: 'string', minLength: 1, maxLength: 2048 },
        alt: { type: 'string', maxLength: 500 },
      },
      required: ['kind', 'url', 'alt'],
      additionalProperties: false,
    },
    { type: 'object', properties: { kind: { const: 'remove' } }, required: ['kind'], additionalProperties: false },
  ],
} as const;

const OPERATION_ITEM = {
  anyOf: [
    {
      type: 'object',
      properties: { op: { const: 'add' }, scope: SCOPE, value: { type: 'object' } },
      required: ['op', 'scope', 'value'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        op: { const: 'update' },
        scope: SCOPE,
        id: ID,
        patch: { type: 'object' },
        unset: { type: 'array', items: { type: 'string' } },
      },
      required: ['op', 'scope', 'id', 'patch', 'unset'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: { op: { const: 'delete' }, scope: SCOPE, id: ID, confirmation: { const: true } },
      required: ['op', 'scope', 'id', 'confirmation'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: { op: { const: 'reorder' }, scope: SCOPE, ids: { type: 'array', items: ID, minItems: 1 } },
      required: ['op', 'scope', 'ids'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: { op: { const: 'set_default_group_order' }, value: { type: 'integer' } },
      required: ['op', 'value'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: { op: { const: 'set_material_image' }, materialId: ID, slot: IMAGE_SLOT, image: IMAGE_VALUE },
      required: ['op', 'materialId', 'slot', 'image'],
      additionalProperties: false,
    },
  ],
} as const;

const OPERATIONS = { type: 'array', minItems: 1, maxItems: 200, items: OPERATION_ITEM } as const;

function toolSchema(properties: Record<string, unknown>, required: readonly string[]): Record<string, unknown> {
  return { type: 'object', properties, required: [...required], additionalProperties: false };
}

export const GET_EDITOR_CONTEXT_SCHEMA = toolSchema({}, []);

export const LIST_ITEMS_SCHEMA = toolSchema(
  { generation: GENERATION, scope: SCOPE, offset: OFFSET, limit: LIST_LIMIT },
  ['generation', 'scope'],
);

export const GET_ITEM_SCHEMA = toolSchema(
  {
    generation: GENERATION,
    scope: SCOPE,
    id: ID,
    field: { type: 'string', minLength: 1 },
    offset: OFFSET,
    limit: ITEM_LIMIT,
  },
  ['generation', 'scope', 'id'],
);

export const FIND_REFERENCES_SCHEMA = toolSchema(
  { generation: GENERATION, id: ID, offset: OFFSET, limit: REFERENCES_LIMIT },
  ['generation', 'id'],
);

export const APPLY_OPERATIONS_SCHEMA = toolSchema({ expectedGeneration: GENERATION, operations: OPERATIONS }, [
  'expectedGeneration',
  'operations',
]);

export const SET_MATERIAL_IMAGE_SCHEMA = toolSchema(
  { expectedGeneration: GENERATION, materialId: ID, slot: IMAGE_SLOT, image: IMAGE_VALUE },
  ['expectedGeneration', 'materialId', 'slot', 'image'],
);

export const GET_DIFF_SCHEMA = toolSchema({ generation: GENERATION, offset: OFFSET, limit: DIFF_LIMIT }, [
  'generation',
]);
