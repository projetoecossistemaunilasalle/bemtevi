import type { EducationResourceGroup } from './groups';
import type { GuidedFlow } from './flowTypes';
import type { EducationResource } from './resources';
import type { ServiceDirectoryEntry, ServiceLocation } from './services';

export const PUBLISHED_CONTENT_SCHEMA_VERSION = '1.0.0' as const;
export const MAX_PUBLISHED_PAYLOAD_BYTES = 5 * 1024 * 1024;

export interface PublishedContentPayload {
  flows: GuidedFlow[];
  educationMaterials: EducationResource[];
  educationGroups: EducationResourceGroup[];
  contacts: ServiceDirectoryEntry[];
  locations: ServiceLocation[];
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
