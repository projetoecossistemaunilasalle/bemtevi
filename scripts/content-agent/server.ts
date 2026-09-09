import { createInterface } from 'node:readline';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyAiOperations, parseAiOperationsResponse } from '../../src/dev-dashboard/ai/aiOperations';
import { compareContent } from '../../src/dev-dashboard/publishing/semanticDiff';
import type { PublishedContentPayload, PublishedContentSnapshot } from '../../src/app/content/publishedContent';
import { inspectContent } from './contentValidation';
import { contentSizeBytes, digestContent } from './digest';
import { DraftStore, DraftStoreError, type ContentDraft, type PublicationAttempt } from './draftStore';
import {
  createDefaultPublishedContentReader,
  loadContentAgentEnv,
  type PublishedContentReader,
} from './publishedReader';
import { createVaultContentPublisher } from './neonPublisher';

const MAX_PAGE_SIZE = 100;
const MAX_RESULT_BYTES = 256 * 1024;
const SCOPES = ['flows', 'educationMaterials', 'educationGroups', 'contacts', 'locations'] as const;
type Scope = (typeof SCOPES)[number];
type JsonRecord = Record<string, unknown>;

export type ContentAgentErrorCode =
  | 'invalid_payload'
  | 'unauthorized'
  | 'stale_generation'
  | 'revision_conflict'
  | 'token_expired'
  | 'uncertain_outcome'
  | 'unavailable';

export class ContentAgentError extends Error {
  constructor(
    public readonly code: ContentAgentErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ContentAgentError';
  }
}

export interface McpServerOptions {
  reader: PublishedContentReader;
  store: DraftStore;
  publisher?: ContentPublisher;
}

export interface ContentAgentSession {
  publisherId: string;
  sessionId: string;
}

/** The publisher owns authentication; credentials never cross the tool boundary. */
export interface ContentPublisher {
  getSession(): Promise<ContentAgentSession | null>;
  publishContent(input: {
    payload: PublishedContentPayload;
    expectedRevision: number | null;
    publisherId: string;
  }): Promise<PublishedContentSnapshot>;
}

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: JsonRecord;
}

const textSchema = { type: 'string', minLength: 1 } as const;
const scopeSchema = { type: 'string', enum: [...SCOPES] } as const;
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

const tools = [
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

const toolArgumentKeys: Record<string, ReadonlySet<string>> = {
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

const announcedTools = tools.map((tool) => ({
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

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0)
    throw new ContentAgentError('invalid_payload', `${label} é obrigatório.`);
  return value.trim();
}

function parseScope(value: unknown): Scope {
  if (typeof value !== 'string' || !SCOPES.includes(value as Scope)) {
    throw new ContentAgentError('invalid_payload', 'O escopo informado não é suportado.');
  }
  return value as Scope;
}

function validateToolArguments(name: string, args: JsonRecord): void {
  const allowed = toolArgumentKeys[name];
  if (!allowed) throw new ContentAgentError('invalid_payload', `Ferramenta desconhecida: ${name}.`);
  const unknown = Object.keys(args).filter((key) => !allowed.has(key));
  if (unknown.length > 0) {
    throw new ContentAgentError('invalid_payload', `Argumentos desconhecidos: ${unknown.join(', ')}.`);
  }
  if (name === 'create_draft' || name === 'update_draft') {
    const variants = Number(Object.hasOwn(args, 'candidate')) + Number(Object.hasOwn(args, 'operations'));
    if (variants !== 1) {
      throw new ContentAgentError('invalid_payload', 'Informe exatamente um entre candidate e operations.');
    }
  }
  if (['get_flow', 'get_material'].includes(name) && args.revision !== undefined) {
    requiredPositiveInteger(args.revision, 'revision');
  }
  if (name === 'create_draft') {
    if (!Object.hasOwn(args, 'baseRevision')) {
      throw new ContentAgentError('invalid_payload', 'baseRevision é obrigatório.');
    }
    parseRevision(args.baseRevision);
  }
  if (['create_draft', 'update_draft'].includes(name) && args.idempotencyKey !== undefined) {
    const key = requiredString(args.idempotencyKey, 'idempotencyKey');
    if (key.length > 200) {
      throw new ContentAgentError('invalid_payload', 'idempotencyKey deve ter no máximo 200 caracteres.');
    }
  }
  if (
    name === 'get_draft_diff' &&
    args.against !== undefined &&
    !['base', 'published'].includes(String(args.against))
  ) {
    throw new ContentAgentError('invalid_payload', 'against precisa ser "base" ou "published".');
  }
}

function parseCursor(value: unknown): number {
  if (value === undefined) return 0;
  if (typeof value !== 'string' || !/^\d+$/.test(value))
    throw new ContentAgentError('invalid_payload', 'Cursor inválido.');
  const offset = Number(value);
  if (!Number.isSafeInteger(offset)) throw new ContentAgentError('invalid_payload', 'Cursor inválido.');
  return offset;
}

function currentPayload(snapshot: PublishedContentSnapshot | null): PublishedContentPayload {
  if (!snapshot) throw new ContentAgentError('unavailable', 'Não há conteúdo publicado disponível.');
  return snapshot.payload;
}

function operationCandidate(base: PublishedContentPayload, revision: number, raw: unknown): PublishedContentPayload {
  if (!Array.isArray(raw)) throw new ContentAgentError('invalid_payload', 'operations precisa ser uma lista.');
  try {
    const envelope = parseAiOperationsResponse({
      schemaVersion: '1.0.0',
      baseRevision: revision,
      operations: raw,
      selfCheck: {
        reviewed: true,
        noOutOfScopeChanges: true,
        noUnrequestedDeletes: true,
        noUnsupportedImagePaths: true,
        notes: [],
      },
    });
    return applyAiOperations(base, envelope, revision);
  } catch (error) {
    throw new ContentAgentError('invalid_payload', error instanceof Error ? error.message : 'Operações inválidas.');
  }
}

function inspectResult(candidate: unknown, base: PublishedContentPayload) {
  const inspection = inspectContent(candidate);
  const diff = inspection.payload
    ? compareContent(base, inspection.payload)
    : { ok: false as const, code: 'invalid_input' as const };
  return {
    candidate,
    candidateDigest: digestContent(candidate),
    validation: inspection.validation,
    diff: diff.ok ? diff.value : [],
  };
}

function summarizeDraft(draft: ContentDraft) {
  return {
    ...draft,
    status: draft.validation.valid ? 'valid' : 'invalid',
  };
}

function summarizeDraftMutation(draft: ContentDraft) {
  const compared = compareContent(draft.base.payload, draft.candidate);
  return {
    draftId: draft.draftId,
    generation: draft.generation,
    baseRevision: draft.base.revision,
    baseDigest: draft.base.digest,
    candidateDigest: draft.candidateDigest,
    validation: draft.validation,
    diff: compared.ok ? compared.value : [],
    status: draft.validation.valid ? 'valid' : 'invalid',
  };
}

function projectionFields(scope: Scope, fields: unknown): string[] {
  const defaults: Record<Scope, string[]> = {
    flows: ['title', 'purpose', 'version', 'status'],
    educationMaterials: ['title', 'description', 'source', 'group'],
    educationGroups: ['title', 'description', 'order'],
    contacts: ['name', 'type', 'city', 'state', 'locationId'],
    locations: ['city', 'state'],
  };
  const selected = fields === undefined ? defaults[scope] : fields;
  if (
    !Array.isArray(selected) ||
    selected.length > 20 ||
    selected.some((field) => typeof field !== 'string' || !field.trim())
  ) {
    throw new ContentAgentError('invalid_payload', 'fields precisa ser uma lista de nomes de campos.');
  }
  return [...new Set(['id', ...selected.map((field) => field.trim())])];
}

function projectItem(item: unknown, fields: string[]): JsonRecord {
  if (!isRecord(item)) return { id: '' };
  const result: JsonRecord = {};
  for (const field of fields) if (Object.hasOwn(item, field)) result[field] = item[field];
  return result;
}

function boundedReadResult<T>(value: T): T {
  if (contentSizeBytes(value) > MAX_RESULT_BYTES) {
    throw new ContentAgentError('unavailable', 'O item excede o limite de 256 KiB da leitura seletiva.');
  }
  return value;
}

function collectReferences(value: unknown, id: string, path = ''): Array<{ path: string }> {
  if (value === id) return [{ path }];
  if (Array.isArray(value)) return value.flatMap((entry, index) => collectReferences(entry, id, `${path}[${index}]`));
  if (!isRecord(value)) return [];
  return Object.entries(value).flatMap(([key, entry]) => {
    if (key === 'id') return [];
    return collectReferences(entry, id, path ? `${path}.${key}` : key);
  });
}

export class ContentMcpServer {
  private readonly preparedTokens = new Map<string, PreparedPublish>();
  private readonly publishingTokens = new Set<string>();

  constructor(private readonly options: McpServerOptions) {}

  async handle(request: JsonRpcRequest): Promise<JsonRecord | null> {
    if (request.jsonrpc !== '2.0' || typeof request.method !== 'string') {
      return this.errorResponse(request.id ?? null, -32600, 'Solicitação JSON-RPC inválida.');
    }
    if (request.method === 'notifications/initialized' || request.method === 'notifications/cancelled') return null;
    try {
      if (request.method === 'initialize')
        return this.response(request.id, {
          protocolVersion: '2025-06-18',
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'bemtevi-content', version: '1.0.0' },
        });
      if (request.method === 'ping') return this.response(request.id, {});
      if (request.method === 'tools/list') return this.response(request.id, { tools: announcedTools });
      if (request.method === 'tools/call') {
        const params = isRecord(request.params) ? request.params : {};
        const name = requiredString(params.name, 'name');
        return this.toolResponse(request.id, name, params.arguments ?? {});
      }
      return this.errorResponse(request.id ?? null, -32601, 'Método não encontrado.');
    } catch (_error) {
      return this.errorResponse(request.id ?? null, -32603, 'Falha interna no servidor MCP.');
    }
  }

  private async toolResponse(
    id: string | number | null | undefined,
    name: string,
    rawArgs: unknown,
  ): Promise<JsonRecord> {
    try {
      if (!isRecord(rawArgs)) throw new ContentAgentError('invalid_payload', 'arguments precisa ser um objeto.');
      validateToolArguments(name, rawArgs);
      const args = rawArgs;
      const value = await this.callTool(name, args);
      const serialized = JSON.stringify(value);
      const maximum = name === 'get_draft' ? 12 * 1024 * 1024 : 7 * 1024 * 1024;
      if (Buffer.byteLength(serialized, 'utf8') > maximum) {
        throw new ContentAgentError('unavailable', 'O resultado excede o limite permitido para esta ferramenta.');
      }
      return this.response(id, {
        content: [{ type: 'text', text: serialized }],
        structuredContent: value,
        isError: false,
      });
    } catch (error) {
      const mapped = this.mapError(error);
      const value = { error: { code: mapped.code, message: mapped.message } };
      return this.response(id, {
        content: [{ type: 'text', text: JSON.stringify(value) }],
        structuredContent: value,
        isError: true,
      });
    }
  }

  private async callTool(name: string, args: JsonRecord): Promise<unknown> {
    switch (name) {
      case 'get_published_revision':
        return this.getPublishedRevision(await this.loadSnapshot());
      case 'list_published_items':
        return this.listPublishedItems(await this.loadSnapshot(), args);
      case 'find_material_references':
        return this.findMaterialReferences(await this.loadSnapshot(), args);
      case 'get_flow':
        return this.getItem(await this.loadSnapshot(), args, 'flows');
      case 'get_material':
        return this.getItem(await this.loadSnapshot(), args, 'educationMaterials');
      case 'validate_content_patch':
        return this.validateContentPatch(await this.loadSnapshot(), args);
      case 'create_draft':
        return this.createDraft(await this.loadSnapshot(), args);
      case 'update_draft':
        return this.updateDraft(args);
      case 'get_draft':
        return this.getDraft(args);
      case 'get_draft_diff':
        return this.getDraftDiff(args.against === 'published' ? await this.loadSnapshot() : null, args);
      case 'prepare_publish':
        return this.preparePublish(args);
      case 'publish_draft':
        return this.publishDraft(args);
      default:
        throw new ContentAgentError('invalid_payload', `Ferramenta desconhecida: ${name}.`);
    }
  }

  private async loadSnapshot() {
    try {
      return await this.options.reader.loadPublishedContent();
    } catch {
      throw new ContentAgentError('unavailable', 'Não foi possível ler o conteúdo publicado.');
    }
  }

  private getPublishedRevision(snapshot: PublishedContentSnapshot | null) {
    if (!snapshot)
      return { revision: null, schemaVersion: null, digest: null, publishedAt: null, publishedBy: null, counts: {} };
    return {
      revision: snapshot.revision,
      schemaVersion: snapshot.schemaVersion,
      digest: digestContent(snapshot.payload),
      publishedAt: snapshot.publishedAt,
      publishedBy: snapshot.publishedBy,
      counts: {
        flows: snapshot.payload.flows.length,
        educationMaterials: snapshot.payload.educationMaterials.length,
        educationGroups: snapshot.payload.educationGroups.length,
        contacts: snapshot.payload.contacts.length,
        locations: snapshot.payload.locations.length,
      },
    };
  }

  private listPublishedItems(snapshot: PublishedContentSnapshot | null, args: JsonRecord) {
    const payload = currentPayload(snapshot);
    const scope = parseScope(args.scope);
    const fields = projectionFields(scope, args.fields);
    const offset = parseCursor(args.cursor);
    const requested = args.limit === undefined ? 20 : args.limit;
    if (
      typeof requested !== 'number' ||
      !Number.isSafeInteger(requested) ||
      requested < 1 ||
      requested > MAX_PAGE_SIZE
    ) {
      throw new ContentAgentError('invalid_payload', `limit deve estar entre 1 e ${MAX_PAGE_SIZE}.`);
    }
    const collection = payload[scope] as unknown as unknown[];
    if (offset > collection.length) throw new ContentAgentError('invalid_payload', 'Cursor fora do intervalo.');
    const page: JsonRecord[] = [];
    let index = offset;
    while (index < collection.length && page.length < requested) {
      const item = projectItem(collection[index], fields);
      const candidate = [...page, item];
      if (contentSizeBytes({ items: candidate }) > MAX_RESULT_BYTES) {
        if (page.length === 0) page.push({ id: item.id });
        break;
      }
      page.push(item);
      index += 1;
    }
    const hasMore = index < collection.length;
    return {
      revision: snapshot?.revision ?? null,
      scope,
      fields,
      items: page,
      nextCursor: hasMore ? String(index) : null,
      hasMore,
      bytes: contentSizeBytes({ items: page }),
    };
  }

  private findMaterialReferences(snapshot: PublishedContentSnapshot | null, args: JsonRecord) {
    const payload = currentPayload(snapshot);
    const id = requiredString(args.id, 'id');
    const references = [
      ...payload.flows.flatMap((flow) => collectReferences(flow, id, `flows.${flow.id}`)),
      ...payload.educationGroups.flatMap((group) => collectReferences(group, id, `educationGroups.${group.id}`)),
      ...payload.educationMaterials.flatMap((material) =>
        collectReferences(material, id, `educationMaterials.${material.id}`),
      ),
    ];
    return boundedReadResult({ revision: snapshot?.revision ?? null, id, references });
  }

  private getItem(snapshot: PublishedContentSnapshot | null, args: JsonRecord, scope: 'flows' | 'educationMaterials') {
    const current = snapshot;
    const id = requiredString(args.id, 'id');
    if (args.revision !== undefined && args.revision !== current?.revision) {
      throw new ContentAgentError('revision_conflict', 'A revisão solicitada não é a revisão publicada atual.');
    }
    const item = currentPayload(current)[scope].find((candidate) => candidate.id === id);
    if (!item) throw new ContentAgentError('unavailable', `Não foi encontrado item "${id}".`);
    return boundedReadResult({ revision: current?.revision ?? null, scope, item });
  }

  private validateContentPatch(snapshot: PublishedContentSnapshot | null, args: JsonRecord) {
    const current = currentPayload(snapshot);
    const revision = args.baseRevision;
    if (typeof revision !== 'number' || revision !== snapshot?.revision) {
      throw new ContentAgentError('revision_conflict', 'A revisão base não corresponde à publicação atual.');
    }
    const candidate = operationCandidate(current, revision, args.operations);
    return { baseRevision: revision, ...inspectResult(candidate, current) };
  }

  private async createDraft(snapshot: PublishedContentSnapshot | null, args: JsonRecord) {
    const current = currentPayload(snapshot);
    const baseRevision = args.baseRevision;
    if (baseRevision !== snapshot?.revision && !(baseRevision === null && snapshot === null)) {
      throw new ContentAgentError('revision_conflict', 'A revisão base não corresponde à publicação atual.');
    }
    const candidate =
      args.operations !== undefined ? operationCandidate(current, snapshot!.revision, args.operations) : args.candidate;
    if (candidate === undefined) throw new ContentAgentError('invalid_payload', 'Informe candidate ou operations.');
    try {
      const draft = await this.options.store.create({
        baseRevision: snapshot?.revision ?? null,
        basePayload: current,
        candidate,
        idempotencyKey: typeof args.idempotencyKey === 'string' ? args.idempotencyKey : undefined,
      });
      return summarizeDraftMutation(draft);
    } catch (error) {
      throw this.mapError(error);
    }
  }

  private async updateDraft(args: JsonRecord) {
    const draftId = requiredString(args.draftId, 'draftId');
    const expectedGeneration = args.expectedGeneration;
    if (typeof expectedGeneration !== 'number' || !Number.isSafeInteger(expectedGeneration) || expectedGeneration < 1) {
      throw new ContentAgentError('invalid_payload', 'expectedGeneration inválida.');
    }
    const current = await this.options.store.get(draftId);
    const candidate =
      args.operations !== undefined
        ? operationCandidate(current.candidate, current.base.revision ?? 1, args.operations)
        : args.candidate;
    if (candidate === undefined) throw new ContentAgentError('invalid_payload', 'Informe candidate ou operations.');
    try {
      const draft = await this.options.store.update({
        draftId,
        expectedGeneration,
        candidate,
        idempotencyKey: typeof args.idempotencyKey === 'string' ? args.idempotencyKey : undefined,
      });
      for (const [token, prepared] of this.preparedTokens) {
        if (prepared.draftId === draftId) this.preparedTokens.delete(token);
      }
      return summarizeDraftMutation(draft);
    } catch (error) {
      throw this.mapError(error);
    }
  }

  private async getDraft(args: JsonRecord) {
    const generation =
      args.generation === undefined ? undefined : requiredPositiveInteger(args.generation, 'generation');
    const draft = await this.options.store.get(requiredString(args.draftId, 'draftId'), generation);
    return summarizeDraft(draft);
  }

  private async getDraftDiff(snapshot: PublishedContentSnapshot | null, args: JsonRecord) {
    const generation =
      args.generation === undefined ? undefined : requiredPositiveInteger(args.generation, 'generation');
    const draft = await this.options.store.get(requiredString(args.draftId, 'draftId'), generation);
    const against = args.against === 'published' ? currentPayload(snapshot) : draft.base.payload;
    const result = inspectResult(draft.candidate, against);
    return {
      draftId: draft.draftId,
      generation: draft.generation,
      against: args.against === 'published' ? 'published' : 'base',
      againstRevision: args.against === 'published' ? (snapshot?.revision ?? null) : draft.base.revision,
      baseDigest: digestContent(against),
      candidateDigest: result.candidateDigest,
      validation: result.validation,
      diff: result.diff,
    };
  }

  private async preparePublish(args: JsonRecord) {
    const draftId = requiredString(args.draftId, 'draftId');
    const generation = requiredPositiveInteger(args.generation, 'generation');
    const expectedRevision = parseRevision(args.expectedRevision);
    const snapshot = await this.loadSnapshot();
    if (expectedRevision !== snapshot?.revision) {
      throw new ContentAgentError('revision_conflict', 'A revisão esperada não corresponde à publicação atual.');
    }
    const draft = await this.options.store.get(draftId);
    if (draft.generation !== generation) {
      throw new ContentAgentError('stale_generation', 'O rascunho foi alterado; prepare uma geração mais nova.');
    }
    if (draft.base.revision !== expectedRevision) {
      throw new ContentAgentError('revision_conflict', 'A base do rascunho não corresponde à publicação atual.');
    }
    if (!draft.validation.valid) {
      throw new ContentAgentError('invalid_payload', 'O rascunho contém erros de validação e não pode ser publicado.');
    }
    const publisher = this.options.publisher;
    if (!publisher) throw new ContentAgentError('unauthorized', 'Nenhuma sessão administrativa está disponível.');
    const session = await publisher.getSession();
    if (!session?.publisherId || !session.sessionId) {
      throw new ContentAgentError('unauthorized', 'A sessão administrativa não está autenticada.');
    }
    const diff = compareContent(snapshot!.payload, draft.candidate);
    if (!diff.ok || diff.value.length === 0) {
      throw new ContentAgentError('invalid_payload', 'O rascunho não contém alterações publicáveis.');
    }
    const publishToken = `btp_${cryptoRandomToken()}`;
    const expiresAt = Date.now() + 5 * 60 * 1000;
    this.expireTokens();
    this.preparedTokens.set(publishToken, {
      publishToken,
      draftId,
      generation,
      candidateDigest: draft.candidateDigest,
      expectedRevision,
      sessionId: session.sessionId,
      expiresAt,
    });
    return {
      draftId,
      generation,
      expectedRevision,
      candidateDigest: draft.candidateDigest,
      publishToken,
      expiresAt: new Date(expiresAt).toISOString(),
      diff: diff.value,
      summary: summarizeChanges(diff.value),
    };
  }

  private async publishDraft(args: JsonRecord) {
    const publishToken = requiredString(args.publishToken, 'publishToken');
    if (this.publishingTokens.has(publishToken)) {
      throw new ContentAgentError('uncertain_outcome', 'Esta publicação já está em andamento.');
    }
    this.publishingTokens.add(publishToken);
    try {
      return await this.publishDraftUnlocked(args);
    } finally {
      this.publishingTokens.delete(publishToken);
    }
  }

  private async publishDraftUnlocked(args: JsonRecord) {
    const draftId = requiredString(args.draftId, 'draftId');
    const generation = requiredPositiveInteger(args.generation, 'generation');
    const expectedRevision = parseRevision(args.expectedRevision);
    const publishToken = requiredString(args.publishToken, 'publishToken');
    this.expireTokens();
    const prepared = this.preparedTokens.get(publishToken);
    if (!prepared || prepared.expiresAt <= Date.now()) {
      this.preparedTokens.delete(publishToken);
      throw new ContentAgentError('token_expired', 'O token de publicação expirou ou não é válido.');
    }
    if (
      prepared.draftId !== draftId ||
      prepared.generation !== generation ||
      prepared.expectedRevision !== expectedRevision
    ) {
      throw new ContentAgentError('stale_generation', 'O token não corresponde à geração e revisão informadas.');
    }
    const publisher = this.options.publisher;
    if (!publisher) throw new ContentAgentError('unauthorized', 'Nenhuma sessão administrativa está disponível.');
    const session = await publisher.getSession();
    if (!session?.publisherId || !session.sessionId) {
      throw new ContentAgentError('unauthorized', 'A sessão administrativa não está autenticada.');
    }
    if (session.sessionId !== prepared.sessionId) {
      this.preparedTokens.delete(publishToken);
      throw new ContentAgentError('unauthorized', 'A sessão administrativa mudou depois da preparação.');
    }
    const priorAttempt = await this.options.store.findPublicationAttempt({
      draftId,
      generation,
      candidateDigest: prepared.candidateDigest,
      expectedRevision,
      publisherId: session.publisherId,
    });
    if (priorAttempt) {
      const confirmed = await this.confirmRemoteDigest(prepared.candidateDigest, expectedRevision, session.publisherId);
      if (confirmed) {
        this.preparedTokens.delete(publishToken);
        await this.options.store.clearPublicationAttempt(priorAttempt.attemptId);
        return {
          draftId,
          generation,
          revision: confirmed.revision,
          digest: prepared.candidateDigest,
          status: 'published',
          confirmed: true,
        };
      }
      throw new ContentAgentError('uncertain_outcome', 'A tentativa anterior ainda não pôde ser confirmada.');
    }
    const draft = await this.options.store.get(draftId);
    if (draft.generation !== generation || draft.candidateDigest !== prepared.candidateDigest) {
      this.preparedTokens.delete(publishToken);
      throw new ContentAgentError('stale_generation', 'O rascunho mudou depois da preparação.');
    }
    if (!draft.validation.valid) {
      this.preparedTokens.delete(publishToken);
      throw new ContentAgentError('invalid_payload', 'O rascunho contém erros de validação.');
    }
    const latest = await this.loadSnapshot();
    if ((latest?.revision ?? null) !== expectedRevision) {
      this.preparedTokens.delete(publishToken);
      throw new ContentAgentError('revision_conflict', 'A publicação mudou depois da preparação.');
    }
    const attempt: PublicationAttempt = {
      attemptId: cryptoRandomToken(),
      draftId,
      generation,
      candidateDigest: draft.candidateDigest,
      expectedRevision,
      publisherId: session.publisherId,
      createdAt: new Date().toISOString(),
    };
    await this.options.store.recordPublicationAttempt(attempt);
    try {
      const snapshot = await publisher.publishContent({
        payload: draft.candidate,
        expectedRevision,
        publisherId: session.publisherId,
      });
      this.preparedTokens.delete(publishToken);
      await this.options.store.clearPublicationAttempt(attempt.attemptId);
      return {
        draftId,
        generation,
        revision: snapshot.revision,
        digest: digestContent(snapshot.payload),
        status: 'published',
      };
    } catch (error) {
      if (error instanceof ContentAgentError && error.code === 'revision_conflict') {
        this.preparedTokens.delete(publishToken);
        await this.options.store.clearPublicationAttempt(attempt.attemptId);
        throw error;
      }
      if ((error as { code?: string })?.code === 'conflict') {
        this.preparedTokens.delete(publishToken);
        await this.options.store.clearPublicationAttempt(attempt.attemptId);
        throw new ContentAgentError('revision_conflict', 'Conflito de revisão ao publicar o conteúdo.');
      }
      const confirmed = await this.confirmRemoteDigest(draft.candidateDigest, expectedRevision, session.publisherId);
      if (confirmed) {
        this.preparedTokens.delete(publishToken);
        await this.options.store.clearPublicationAttempt(attempt.attemptId);
        return {
          draftId,
          generation,
          revision: confirmed.revision,
          digest: draft.candidateDigest,
          status: 'published',
          confirmed: true,
        };
      }
      throw new ContentAgentError('uncertain_outcome', 'O resultado da publicação não pôde ser confirmado.');
    }
  }

  private async confirmRemoteDigest(
    candidateDigest: string,
    expectedRevision: number | null,
    publisherId: string,
  ): Promise<PublishedContentSnapshot | null> {
    try {
      const snapshot = await this.options.reader.loadPublishedContent();
      return snapshot &&
        snapshot.revision === (expectedRevision ?? 0) + 1 &&
        snapshot.publishedBy === publisherId &&
        digestContent(snapshot.payload) === candidateDigest
        ? snapshot
        : null;
    } catch {
      return null;
    }
  }

  private expireTokens() {
    const now = Date.now();
    for (const [token, prepared] of this.preparedTokens) {
      if (prepared.expiresAt <= now) this.preparedTokens.delete(token);
    }
  }

  private mapError(error: unknown): ContentAgentError {
    if (error instanceof ContentAgentError) return error;
    if (error instanceof DraftStoreError) return new ContentAgentError(error.code, error.message);
    return new ContentAgentError('unavailable', 'Não foi possível concluir a operação.');
  }

  private response(id: string | number | null | undefined, result: unknown): JsonRecord {
    return { jsonrpc: '2.0', id: id ?? null, result };
  }

  private errorResponse(id: string | number | null, code: number, message: string): JsonRecord {
    return { jsonrpc: '2.0', id, error: { code, message } };
  }
}

interface PreparedPublish {
  publishToken: string;
  draftId: string;
  generation: number;
  candidateDigest: string;
  expectedRevision: number | null;
  sessionId: string;
  expiresAt: number;
}

function cryptoRandomToken(): string {
  return randomBytes(32).toString('base64url');
}

function requiredPositiveInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new ContentAgentError('invalid_payload', `${label} precisa ser um inteiro positivo.`);
  }
  return value;
}

function parseRevision(value: unknown): number | null {
  if (value === null) return null;
  return requiredPositiveInteger(value, 'expectedRevision');
}

function summarizeChanges(changes: Array<{ kind: string }>) {
  return changes.reduce<Record<string, number>>((summary, change) => {
    summary[change.kind] = (summary[change.kind] ?? 0) + 1;
    return summary;
  }, {});
}

export function createDefaultContentMcpServer(): ContentMcpServer {
  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const env = loadContentAgentEnv(projectRoot);
  return new ContentMcpServer({
    reader: createDefaultPublishedContentReader(projectRoot),
    store: new DraftStore(path.join(projectRoot, '.bemtevi', 'content-drafts')),
    ...(env.BEMTEVI_CONTENT_AGENT_PUBLISH_ENABLED === 'true' ? { publisher: createVaultContentPublisher() } : {}),
  });
}

export async function runStdioServer(server = createDefaultContentMcpServer()) {
  const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of input) {
    if (!line.trim()) continue;
    let request: JsonRpcRequest;
    try {
      request = JSON.parse(line) as JsonRpcRequest;
    } catch {
      process.stdout.write(
        `${JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON inválido.' } })}\n`,
      );
      continue;
    }
    const response = await server.handle(request);
    if (response) process.stdout.write(`${JSON.stringify(response)}\n`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runStdioServer().catch(() => (process.exitCode = 1));
}
