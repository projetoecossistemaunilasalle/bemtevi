import { validatePublicationPayload, type PublishedContentPayload } from '../../app/content/publishedContent';

export const AI_OPERATIONS_SCHEMA_VERSION = '1.0.0' as const;

export const aiOperationScopes = ['flows', 'educationMaterials', 'educationGroups', 'contacts', 'locations'] as const;

export type AiOperationScope = (typeof aiOperationScopes)[number];

type JsonRecord = Record<string, unknown>;

export interface AiSelfCheckReport {
  reviewed: true;
  noOutOfScopeChanges: true;
  noUnrequestedDeletes: true;
  noUnsupportedImagePaths: true;
  notes: string[];
}

export interface AiAddOperation {
  op: 'add';
  scope: AiOperationScope;
  value: JsonRecord;
}

export interface AiUpdateOperation {
  op: 'update';
  scope: AiOperationScope;
  id: string;
  patch: JsonRecord;
}

export interface AiDeleteOperation {
  op: 'delete';
  scope: AiOperationScope;
  id: string;
  confirmation: true;
}

export type AiContentOperation = AiAddOperation | AiUpdateOperation | AiDeleteOperation;

export interface AiOperationEnvelope {
  schemaVersion: typeof AI_OPERATIONS_SCHEMA_VERSION;
  baseRevision: number;
  operations: AiContentOperation[];
  selfCheck: AiSelfCheckReport;
}

const ITEM_KEYS: Record<AiOperationScope, readonly string[]> = {
  flows: ['id', 'version', 'locale', 'title', 'type', 'purpose', 'status', 'entry', 'nodes', 'nodeOrder'],
  educationMaterials: [
    'id',
    'title',
    'source',
    'description',
    'imageUrl',
    'imageFileName',
    'featuredImage',
    'tags',
    'audience',
    'body',
    'embed',
    'href',
    'group',
    'groupOrder',
    'review',
  ],
  educationGroups: ['id', 'title', 'description', 'order'],
  contacts: [
    'id',
    'name',
    'type',
    'badgeTone',
    'city',
    'state',
    'locationId',
    'address',
    'phoneDisplay',
    'phoneHref',
    'hours',
    'notes',
    'lat',
    'lng',
    'review',
  ],
  locations: ['id', 'city', 'state'],
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertExactKeys(value: JsonRecord, allowed: readonly string[], label: string) {
  const unexpected = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unexpected.length > 0) {
    throw new Error(`${label} contém campo(s) não permitido(s): ${unexpected.join(', ')}.`);
  }
}

function assertNoArchiveImagePath(value: unknown, path = ''): void {
  if (typeof value === 'string') {
    if (value.startsWith('./images/') || value.startsWith('data:image/')) {
      throw new Error(
        `Imagens não podem ser alteradas pela IA (${path || 'campo de imagem'}). Use o painel para enviar ou trocar a imagem.`,
      );
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoArchiveImagePath(item, `${path}[${index}]`));
    return;
  }
  if (isRecord(value)) {
    Object.entries(value).forEach(([key, item]) => assertNoArchiveImagePath(item, path ? `${path}.${key}` : key));
  }
}

function parseScope(value: unknown, label: string): AiOperationScope {
  if (typeof value !== 'string' || !aiOperationScopes.includes(value as AiOperationScope)) {
    throw new Error(`${label} precisa informar um escopo válido: ${aiOperationScopes.join(', ')}.`);
  }
  return value as AiOperationScope;
}

function parseOperation(value: unknown, index: number): AiContentOperation {
  const label = `Operação ${index + 1}`;
  if (!isRecord(value)) throw new Error(`${label} deve ser um objeto.`);
  const scope = parseScope(value.scope, label);
  const op = value.op;

  if (op === 'add') {
    assertExactKeys(value, ['op', 'scope', 'value'], label);
    if (!isRecord(value.value)) throw new Error(`${label} (add) precisa de um "value" em formato de objeto.`);
    assertExactKeys(value.value, ITEM_KEYS[scope], `${label} (add)`);
    if (!isNonEmptyString(value.value.id)) throw new Error(`${label} (add) precisa de um "value.id" válido.`);
    assertNoArchiveImagePath(value.value);
    return { op, scope, value: value.value };
  }

  if (op === 'update') {
    assertExactKeys(value, ['op', 'scope', 'id', 'patch'], label);
    if (!isNonEmptyString(value.id)) throw new Error(`${label} (update) precisa de um "id" válido.`);
    if (!isRecord(value.patch) || Object.keys(value.patch).length === 0) {
      throw new Error(`${label} (update) precisa de um "patch" não vazio.`);
    }
    assertExactKeys(
      value.patch,
      ITEM_KEYS[scope].filter((key) => key !== 'id'),
      `${label} (update)`,
    );
    assertNoArchiveImagePath(value.patch);
    return { op, scope, id: value.id.trim(), patch: value.patch };
  }

  if (op === 'delete') {
    assertExactKeys(value, ['op', 'scope', 'id', 'confirmation'], label);
    if (!isNonEmptyString(value.id)) throw new Error(`${label} (delete) precisa de um "id" válido.`);
    if (value.confirmation !== true) {
      throw new Error(`${label} (delete) exige "confirmation": true para evitar exclusão acidental.`);
    }
    return { op, scope, id: value.id.trim(), confirmation: true };
  }

  throw new Error(`${label} tem "op" inválido. Use add, update ou delete.`);
}

/** Parses only the safe operation protocol returned by an AI assistant. */
export function parseAiOperationsResponse(response: unknown): AiOperationEnvelope {
  if (!isRecord(response)) throw new Error('A resposta da IA deve ser um objeto JSON de operações.');
  assertExactKeys(response, ['schemaVersion', 'baseRevision', 'operations', 'selfCheck'], 'Resposta da IA');
  if (response.schemaVersion !== AI_OPERATIONS_SCHEMA_VERSION) {
    throw new Error(`A resposta da IA precisa usar schemaVersion "${AI_OPERATIONS_SCHEMA_VERSION}".`);
  }
  const baseRevision = response.baseRevision;
  if (typeof baseRevision !== 'number' || !Number.isSafeInteger(baseRevision) || baseRevision <= 0) {
    throw new Error('A resposta da IA precisa informar uma "baseRevision" inteira positiva.');
  }
  if (!Array.isArray(response.operations)) throw new Error('A resposta da IA precisa conter "operations" como lista.');
  if (response.operations.length === 0) throw new Error('A resposta da IA não contém nenhuma operação para revisar.');
  if (!isRecord(response.selfCheck)) throw new Error('A resposta da IA precisa incluir o relatório "selfCheck".');
  assertExactKeys(
    response.selfCheck,
    ['reviewed', 'noOutOfScopeChanges', 'noUnrequestedDeletes', 'noUnsupportedImagePaths', 'notes'],
    'Relatório selfCheck',
  );
  if (
    response.selfCheck.reviewed !== true ||
    response.selfCheck.noOutOfScopeChanges !== true ||
    response.selfCheck.noUnrequestedDeletes !== true ||
    response.selfCheck.noUnsupportedImagePaths !== true
  ) {
    throw new Error('A IA não confirmou todas as verificações obrigatórias. Revise a solicitação antes de aplicar.');
  }
  if (!Array.isArray(response.selfCheck.notes) || response.selfCheck.notes.some((note) => typeof note !== 'string')) {
    throw new Error('O relatório selfCheck precisa conter "notes" como lista de textos.');
  }

  const operations = response.operations.map((operation, index) => parseOperation(operation, index));
  return {
    schemaVersion: AI_OPERATIONS_SCHEMA_VERSION,
    baseRevision,
    operations,
    selfCheck: {
      reviewed: true,
      noOutOfScopeChanges: true,
      noUnrequestedDeletes: true,
      noUnsupportedImagePaths: true,
      notes: response.selfCheck.notes,
    },
  };
}

function clonePayload(payload: PublishedContentPayload): PublishedContentPayload {
  return JSON.parse(JSON.stringify(payload)) as PublishedContentPayload;
}

function getCollection(payload: PublishedContentPayload, scope: AiOperationScope): Array<{ id: string }> {
  return payload[scope] as Array<{ id: string }>;
}

function findUniqueIndex(collection: Array<{ id: string }>, id: string, operation: AiContentOperation): number {
  const indexes = collection.reduce<number[]>((found, item, index) => (item.id === id ? [...found, index] : found), []);
  if (indexes.length === 0)
    throw new Error(`Não foi possível aplicar ${operation.op}: o item "${id}" não existe em ${operation.scope}.`);
  if (indexes.length > 1)
    throw new Error(`Não foi possível aplicar ${operation.op}: o ID "${id}" está duplicado em ${operation.scope}.`);
  return indexes[0];
}

/**
 * Applies only explicit operations to a copy of the supplied payload. Missing items are always preserved.
 * The resulting complete payload is validated before it is returned.
 */
export function applyAiOperations(
  basePayload: PublishedContentPayload,
  envelope: AiOperationEnvelope,
  expectedBaseRevision?: number,
): PublishedContentPayload {
  if (expectedBaseRevision !== undefined && envelope.baseRevision !== expectedBaseRevision) {
    throw new Error(
      `A resposta da IA foi criada para a revisão ${envelope.baseRevision}, mas o painel está na revisão ${expectedBaseRevision}. Recarregue o conteúdo antes de tentar novamente.`,
    );
  }
  const next = clonePayload(basePayload);

  for (const operation of envelope.operations) {
    const collection = getCollection(next, operation.scope);
    if (operation.op === 'add') {
      if (collection.some((item) => item.id === operation.value.id)) {
        throw new Error(`Não foi possível adicionar: o ID "${operation.value.id}" já existe em ${operation.scope}.`);
      }
      collection.push(operation.value as { id: string });
      continue;
    }

    const index = findUniqueIndex(collection, operation.id, operation);
    if (operation.op === 'delete') {
      collection.splice(index, 1);
      continue;
    }

    collection[index] = { ...collection[index], ...operation.patch };
  }

  return validatePublicationPayload(next);
}
