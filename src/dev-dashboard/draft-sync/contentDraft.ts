import type { PublishedContentPayload } from '../../app/content/publishedContent';

/** A validation problem returned by the local DraftStore. */
export interface ContentValidationIssue {
  code?: string;
  path?: string;
  message: string;
  /** DraftStore uses `level`; `severity` is accepted for older clients. */
  level?: 'error' | 'warning';
  severity?: 'error' | 'warning';
}

/**
 * Stable envelope shared by the MCP DraftStore and the administrative panel.
 * The candidate is intentionally kept even when validation fails so an admin
 * can recover and correct a draft instead of losing the agent's work.
 */
export interface ContentDraft {
  schemaVersion: 1;
  draftId: string;
  generation: number;
  base: {
    revision: number | null;
    digest: string;
    payload: PublishedContentPayload;
  };
  candidate: PublishedContentPayload;
  candidateDigest: string;
  validation: {
    valid: boolean;
    issues: ContentValidationIssue[];
  };
  createdAt: string;
  updatedAt: string;
}

export function isContentDraft(value: unknown): value is ContentDraft {
  if (!isRecord(value) || value.schemaVersion !== 1) return false;
  if (!isNonEmptyString(value.draftId) || !isGeneration(value.generation)) return false;
  if (!isRecord(value.base) || !isRevision(value.base.revision) || !isNonEmptyString(value.base.digest)) return false;
  if (!isPayloadShape(value.base.payload) || !isRecord(value.candidate)) return false;
  if (!isNonEmptyString(value.candidateDigest)) return false;
  if (!isRecord(value.validation) || typeof value.validation.valid !== 'boolean') return false;
  if (!Array.isArray(value.validation.issues) || value.validation.issues.some((issue) => !isIssue(issue))) return false;
  return isNonEmptyString(value.createdAt) && isNonEmptyString(value.updatedAt);
}

/** Allows the dashboard to reject an unrecoverable candidate before opening its editors. */
export function isRecoverableDraftPayload(value: unknown): value is PublishedContentPayload {
  if (!isRecord(value)) return false;
  return ['flows', 'educationMaterials', 'educationGroups', 'contacts', 'locations'].every(
    (key) =>
      Array.isArray(value[key]) &&
      value[key].every((item) => isRecord(item) && typeof item.id === 'string' && item.id.trim().length > 0),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isGeneration(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;
}

function isRevision(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isSafeInteger(value) && value > 0);
}

/** Structural validation only for the trusted published base. */
function isPayloadShape(value: unknown): value is PublishedContentPayload {
  if (!isRecord(value)) return false;
  const collections = ['flows', 'educationMaterials', 'educationGroups', 'contacts', 'locations'];
  return (
    collections.every(
      (key) =>
        Array.isArray(value[key]) &&
        value[key].every((item) => isRecord(item) && typeof item.id === 'string' && item.id.trim().length > 0),
    ) &&
    typeof value.defaultGroupOrder === 'number' &&
    Number.isFinite(value.defaultGroupOrder)
  );
}

function isIssue(value: unknown): value is ContentValidationIssue {
  return (
    isRecord(value) &&
    isNonEmptyString(value.message) &&
    (value.code === undefined || typeof value.code === 'string') &&
    (value.path === undefined || typeof value.path === 'string') &&
    (value.level === undefined || value.level === 'error' || value.level === 'warning') &&
    (value.severity === undefined || value.severity === 'error' || value.severity === 'warning')
  );
}
