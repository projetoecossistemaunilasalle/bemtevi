import { parseGuidedFlow } from '../../domain/flow-engine/parseFlow';
import { validateFlow } from '../../domain/flow-engine/validateFlow';
import type { EducationResourceGroup } from '../../content/resources/groups';
import type { GuidedFlow } from '../../domain/flow-engine/types';
import type { EducationResource } from '../../domain/resources/types';
import type { ServiceDirectoryEntry } from '../../domain/services/types';

export const PUBLISHED_CONTENT_SCHEMA_VERSION = '1.0.0' as const;
export const MAX_PUBLISHED_PAYLOAD_BYTES = 5 * 1024 * 1024;

export interface PublishedContentPayload {
  flows: GuidedFlow[];
  educationMaterials: EducationResource[];
  educationGroups: EducationResourceGroup[];
  contacts: ServiceDirectoryEntry[];
  defaultGroupOrder: number;
}

export interface PublishedContentSnapshot {
  schemaVersion: typeof PUBLISHED_CONTENT_SCHEMA_VERSION;
  revision: number;
  payload: PublishedContentPayload;
  publishedAt: string;
  publishedBy: string;
}

export interface PublishedContentRow {
  id: 'current';
  schema_version: string;
  revision: number;
  payload: unknown;
  published_at: string;
  published_by: string;
}

export class PublishedContentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PublishedContentValidationError';
  }
}

const SUPPORTED_AUDIENCES = ['teachers', 'public_school_teachers', 'general'] as const;
const SUPPORTED_BADGE_TONES = ['primary', 'secondary', 'neutral'] as const;
const PAYLOAD_KEYS: (keyof PublishedContentPayload)[] = [
  'flows',
  'educationMaterials',
  'educationGroups',
  'contacts',
  'defaultGroupOrder',
];

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function validateFlows(flows: unknown): GuidedFlow[] {
  if (!Array.isArray(flows)) {
    throw new PublishedContentValidationError('O campo "flows" deve ser uma lista.');
  }
  return flows.map((flow, index) => {
    const label = isRecord(flow) && isNonEmptyString(flow.id) ? String(flow.id) : `índice ${index}`;
    const validation = validateFlow(flow);
    if (!validation.valid) {
      throw new PublishedContentValidationError(`Fluxo "${label}" inválido: ${validation.errors.join(' ')}`);
    }
    return parseGuidedFlow(flow);
  });
}

function validateEducationMaterials(materials: unknown): EducationResource[] {
  if (!Array.isArray(materials)) {
    throw new PublishedContentValidationError('O campo "educationMaterials" deve ser uma lista.');
  }
  return materials.map((material, index) => {
    if (!isRecord(material)) {
      throw new PublishedContentValidationError(`Recurso educacional no índice ${index} deve ser um objeto.`);
    }
    const label = isNonEmptyString(material.id) ? String(material.id) : `índice ${index}`;
    if (!isNonEmptyString(material.id)) {
      throw new PublishedContentValidationError(`Recurso educacional no índice ${index} precisa de um "id".`);
    }
    if (!isNonEmptyString(material.title)) {
      throw new PublishedContentValidationError(`Recurso "${label}" precisa de um "title".`);
    }
    if (!isNonEmptyString(material.source)) {
      throw new PublishedContentValidationError(`Recurso "${label}" precisa de um "source".`);
    }
    if (!isNonEmptyString(material.description)) {
      throw new PublishedContentValidationError(`Recurso "${label}" precisa de um "description".`);
    }
    if (!Array.isArray(material.tags) || material.tags.some((tag) => typeof tag !== 'string')) {
      throw new PublishedContentValidationError(`Recurso "${label}" precisa de "tags" como lista de textos.`);
    }
    if (!SUPPORTED_AUDIENCES.includes(material.audience as (typeof SUPPORTED_AUDIENCES)[number])) {
      throw new PublishedContentValidationError(`Recurso "${label}" tem "audience" inválido.`);
    }
    if (!isRecord(material.review)) {
      throw new PublishedContentValidationError(`Recurso "${label}" precisa de um objeto "review".`);
    }
    if (material.body !== undefined && !Array.isArray(material.body)) {
      throw new PublishedContentValidationError(`Recurso "${label}" tem "body" inválido.`);
    }
    return material as unknown as EducationResource;
  });
}

function validateEducationGroups(groups: unknown): EducationResourceGroup[] {
  if (!Array.isArray(groups)) {
    throw new PublishedContentValidationError('O campo "educationGroups" deve ser uma lista.');
  }
  return groups.map((group, index) => {
    if (!isRecord(group)) {
      throw new PublishedContentValidationError(`Grupo no índice ${index} deve ser um objeto.`);
    }
    const label = isNonEmptyString(group.id) ? String(group.id) : `índice ${index}`;
    if (!isNonEmptyString(group.id)) {
      throw new PublishedContentValidationError(`Grupo no índice ${index} precisa de um "id".`);
    }
    if (!isNonEmptyString(group.title)) {
      throw new PublishedContentValidationError(`Grupo "${label}" precisa de um "title".`);
    }
    if (!isFiniteNumber(group.order)) {
      throw new PublishedContentValidationError(`Grupo "${label}" precisa de um "order" numérico.`);
    }
    return group as unknown as EducationResourceGroup;
  });
}

function validateContacts(contacts: unknown): ServiceDirectoryEntry[] {
  if (!Array.isArray(contacts)) {
    throw new PublishedContentValidationError('O campo "contacts" deve ser uma lista.');
  }
  return contacts.map((contact, index) => {
    if (!isRecord(contact)) {
      throw new PublishedContentValidationError(`Contato no índice ${index} deve ser um objeto.`);
    }
    const label = isNonEmptyString(contact.id) ? String(contact.id) : `índice ${index}`;
    if (!isNonEmptyString(contact.id)) {
      throw new PublishedContentValidationError(`Contato no índice ${index} precisa de um "id".`);
    }
    if (!isNonEmptyString(contact.name)) {
      throw new PublishedContentValidationError(`Contato "${label}" precisa de um "name".`);
    }
    if (!isNonEmptyString(contact.type)) {
      throw new PublishedContentValidationError(`Contato "${label}" precisa de um "type".`);
    }
    if (!isNonEmptyString(contact.city)) {
      throw new PublishedContentValidationError(`Contato "${label}" precisa de um "city".`);
    }
    if (!isNonEmptyString(contact.state)) {
      throw new PublishedContentValidationError(`Contato "${label}" precisa de um "state".`);
    }
    if (!isNonEmptyString(contact.address)) {
      throw new PublishedContentValidationError(`Contato "${label}" precisa de um "address".`);
    }
    if (!isNonEmptyString(contact.phoneDisplay)) {
      throw new PublishedContentValidationError(`Contato "${label}" precisa de um "phoneDisplay".`);
    }
    if (!isNonEmptyString(contact.phoneHref)) {
      throw new PublishedContentValidationError(`Contato "${label}" precisa de um "phoneHref".`);
    }
    if (!SUPPORTED_BADGE_TONES.includes(contact.badgeTone as (typeof SUPPORTED_BADGE_TONES)[number])) {
      throw new PublishedContentValidationError(`Contato "${label}" tem "badgeTone" inválido.`);
    }
    if (!isRecord(contact.review)) {
      throw new PublishedContentValidationError(`Contato "${label}" precisa de um objeto "review".`);
    }
    return contact as unknown as ServiceDirectoryEntry;
  });
}

export function parsePayload(payload: unknown): PublishedContentPayload {
  if (!isRecord(payload)) {
    throw new PublishedContentValidationError('O payload publicado deve ser um objeto.');
  }
  const missingKeys = PAYLOAD_KEYS.filter((key) => !(key in payload));
  if (missingKeys.length > 0) {
    throw new PublishedContentValidationError(
      `O payload publicado está incompleto. Faltam: ${missingKeys.join(', ')}.`,
    );
  }
  if (!isFiniteNumber(payload.defaultGroupOrder)) {
    throw new PublishedContentValidationError('O campo "defaultGroupOrder" deve ser numérico.');
  }

  const flows = validateFlows(payload.flows);
  const educationMaterials = validateEducationMaterials(payload.educationMaterials);
  const educationGroups = validateEducationGroups(payload.educationGroups);
  const contacts = validateContacts(payload.contacts);

  return {
    flows,
    educationMaterials,
    educationGroups,
    contacts,
    defaultGroupOrder: payload.defaultGroupOrder,
  };
}

export function parsePublishedContentRow(row: PublishedContentRow): PublishedContentSnapshot {
  if (row.id !== 'current') {
    throw new PublishedContentValidationError('Apenas o registro "current" é suportado.');
  }
  if (row.schema_version !== PUBLISHED_CONTENT_SCHEMA_VERSION) {
    throw new PublishedContentValidationError(`Versão de esquema (schema) não suportada: ${row.schema_version}.`);
  }
  if (typeof row.revision !== 'number' || !Number.isSafeInteger(row.revision) || row.revision <= 0) {
    throw new PublishedContentValidationError('O "revision" deve ser um inteiro positivo.');
  }
  if (!isNonEmptyString(row.published_at)) {
    throw new PublishedContentValidationError('O "published_at" é obrigatório.');
  }
  if (!isNonEmptyString(row.published_by)) {
    throw new PublishedContentValidationError('O "published_by" é obrigatório.');
  }
  if (!isRecord(row.payload)) {
    throw new PublishedContentValidationError('O "payload" deve ser um objeto.');
  }

  const parsed = parsePayload(row.payload);

  return {
    schemaVersion: PUBLISHED_CONTENT_SCHEMA_VERSION,
    revision: row.revision,
    payload: parsed,
    publishedAt: row.published_at,
    publishedBy: row.published_by,
  };
}

export function getPublishedPayloadSize(payload: PublishedContentPayload): number {
  return new TextEncoder().encode(JSON.stringify(payload)).byteLength;
}

export function validatePublicationPayload(payload: PublishedContentPayload): PublishedContentPayload {
  const parsed = parsePayload(payload);
  if (getPublishedPayloadSize(parsed) > MAX_PUBLISHED_PAYLOAD_BYTES) {
    throw new PublishedContentValidationError('O conteúdo publicado não pode exceder 5 MiB.');
  }
  return parsed;
}
