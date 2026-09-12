import type { PublishedContentPayload, PublishedContentSnapshot } from '../../src/app/content/publishedContent';
import { contentSizeBytes, digestContent } from './digest';
import { ContentAgentError, parseCursor, parseScope, requiredString, type JsonRecord } from './contentAgentErrors';
import { MAX_PAGE_SIZE, type Scope } from './protocolInput';
import type { PublishedContentReader } from './publishedReader';

const MAX_RESULT_BYTES = 256 * 1024;

export async function loadPublishedSnapshot(reader: PublishedContentReader): Promise<PublishedContentSnapshot | null> {
  try {
    return await reader.loadPublishedContent();
  } catch {
    throw new ContentAgentError('unavailable', 'Não foi possível ler o conteúdo publicado.');
  }
}

export function currentPayload(snapshot: PublishedContentSnapshot | null): PublishedContentPayload {
  if (!snapshot) throw new ContentAgentError('unavailable', 'Não há conteúdo publicado disponível.');
  return snapshot.payload;
}

export class ContentReadTools {
  constructor(private readonly reader: PublishedContentReader) {}

  loadSnapshot(): Promise<PublishedContentSnapshot | null> {
    return loadPublishedSnapshot(this.reader);
  }

  async getPublishedRevision() {
    const snapshot = await this.loadSnapshot();
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

  async listPublishedItems(args: JsonRecord) {
    const snapshot = await this.loadSnapshot();
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

  async findMaterialReferences(args: JsonRecord) {
    const snapshot = await this.loadSnapshot();
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

  async getItem(args: JsonRecord, scope: 'flows' | 'educationMaterials') {
    const snapshot = await this.loadSnapshot();
    const id = requiredString(args.id, 'id');
    if (args.revision !== undefined && args.revision !== snapshot?.revision) {
      throw new ContentAgentError('revision_conflict', 'A revisão solicitada não é a revisão publicada atual.');
    }
    const item = currentPayload(snapshot)[scope].find((candidate) => candidate.id === id);
    if (!item) throw new ContentAgentError('unavailable', `Não foi encontrado item "${id}".`);
    return boundedReadResult({ revision: snapshot?.revision ?? null, scope, item });
  }
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

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
