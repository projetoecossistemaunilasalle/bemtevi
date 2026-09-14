import { MAX_PUBLISHED_PAYLOAD_BYTES, PUBLISHED_CONTENT_SCHEMA_VERSION } from '../model/publishedContent';
import type { PublishedContentPayload, PublishedContentRow, PublishedContentSnapshot } from '../model/publishedContent';
import { deriveLocationsFromContacts, normalizeContactLocations } from '../model/locations';
import { validateContacts, validateContactRecords, validateLocations } from './publishedContentContacts';
import { validateEducationGroups, validateEducationMaterials, validateFlows } from './publishedContentMaterials';
import { isFiniteNumber, isNonEmptyString, isRecord } from './publishedContentGuards';
import { PublishedContentValidationError } from '../model/publishedContent';

const PAYLOAD_KEYS: (keyof PublishedContentPayload)[] = [
  'flows',
  'educationMaterials',
  'educationGroups',
  'contacts',
  'defaultGroupOrder',
];

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
  const rawContacts = validateContactRecords(payload.contacts);
  const hasExplicitLocations = payload.locations !== undefined;
  const initialLocations = hasExplicitLocations
    ? validateLocations(payload.locations)
    : validateLocations(deriveLocationsFromContacts(rawContacts));
  const normalized = normalizeContactLocations(rawContacts, initialLocations, {
    allowDerivation: !hasExplicitLocations,
  });
  const locations = validateLocations(normalized.locations);
  const contacts = validateContacts(normalized.contacts, locations);

  return {
    flows,
    educationMaterials,
    educationGroups,
    contacts,
    locations,
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
