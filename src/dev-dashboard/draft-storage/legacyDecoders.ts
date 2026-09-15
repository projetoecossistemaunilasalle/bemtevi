import type { PublishedContentPayload } from '../../app/content/publishedContent';

const LEGACY_DRAFT_VERSIONS = ['1.0.0', '2.0.0', '3.0.0', '4.0.0', '5.0.0', '6.0.0'];
const LEGACY_COLLECTION_KEYS = [
  'flowPatches',
  'educationMaterialPatches',
  'groupPatches',
  'contactPatches',
  'locationPatches',
  'addedFlows',
  'addedEducationMaterials',
  'addedGroups',
  'addedContacts',
  'addedLocations',
  'removedGroupIds',
  'removedFlowIds',
  'removedEducationMaterialIds',
  'removedContactIds',
  'removedLocationIds',
];
const INVALID_ENVELOPE = 'Arquivo de rascunho inválido ou versão desconhecida. O original foi preservado.';

export const LEGACY_WORKSPACE_SCHEMA_VERSION = 7;

export interface LegacyRecordPatch<T extends { id: string }> {
  id: string;
  sourceIndex?: number;
  sourceIdUnique?: boolean;
  patch: Partial<T>;
}

/** Structural shape of the old `DashboardDraftState` bytes (versions 1–6). */
export interface LegacyDraftState {
  schemaVersion: string;
  updatedAt: string | null;
  baseRevision?: number | null;
  basePayload?: PublishedContentPayload;
  defaultGroupOrder?: number;
  [key: string]: unknown;
}

/** Old workspace/checkpoint envelope (schemaVersion 7). Recovery metadata only. */
export interface LegacyWorkspaceEnvelope {
  schemaVersion: 7;
  workspaceId: string;
  /** Legacy LOCAL generation: never a Neon CAS generation. */
  generation: number;
  base: { revision: number | null; payload: PublishedContentPayload };
  local: PublishedContentPayload;
  updatedAt: string;
  archived?: boolean;
  legacyOriginal?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

export function positiveInt(value: unknown): number | null {
  return isSafeInteger(value) && value > 0 ? value : null;
}

export function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function toPatches<T extends { id: string }>(value: unknown): Array<LegacyRecordPatch<T>> {
  return toArray<LegacyRecordPatch<T>>(value).filter((entry) => isRecord(entry) && typeof entry.id === 'string');
}

function payloadShape(value: unknown): value is PublishedContentPayload {
  if (!isRecord(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    ['flows', 'educationMaterials', 'educationGroups', 'contacts', 'locations'].every(
      (key) =>
        Array.isArray(record[key]) &&
        (record[key] as unknown[]).every(
          (item) => item && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string',
        ),
    ) && typeof record.defaultGroupOrder === 'number'
  );
}

/** Decodes old DashboardDraftState bytes; null when the bytes are unusable. */
export function decodeLegacyDraftState(raw: string): LegacyDraftState | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || !LEGACY_DRAFT_VERSIONS.includes(String(parsed.schemaVersion))) return null;
  const order = parsed.defaultGroupOrder; // recovery never sanitizes legacy effects
  return {
    ...parsed,
    schemaVersion: String(parsed.schemaVersion),
    baseRevision: positiveInt(parsed.baseRevision),
    basePayload: payloadShape(parsed.basePayload) ? parsed.basePayload : undefined,
    defaultGroupOrder: typeof order === 'number' && order !== 0 ? order : undefined,
    updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
  };
}

export function legacyStateHasChanges(state: LegacyDraftState): boolean {
  return (
    state.defaultGroupOrder !== undefined ||
    LEGACY_COLLECTION_KEYS.some((key) => toArray<unknown>(state[key]).length > 0)
  );
}

/** Validates an old workspace/checkpoint envelope without rewriting identity. */
export function decodeLegacyWorkspaceEnvelope(raw: string): LegacyWorkspaceEnvelope {
  const parsed: unknown = JSON.parse(raw);
  const base = isRecord(parsed) && isRecord(parsed.base) ? (parsed.base as Record<string, unknown>) : null;
  if (
    !isRecord(parsed) ||
    parsed.schemaVersion !== LEGACY_WORKSPACE_SCHEMA_VERSION ||
    typeof parsed.workspaceId !== 'string' ||
    !isSafeInteger(parsed.generation) ||
    (parsed.generation as number) < 0 ||
    base === null ||
    !(base.revision === null || isSafeInteger(base.revision)) ||
    !payloadShape(base.payload) ||
    !payloadShape(parsed.local)
  )
    throw new Error(INVALID_ENVELOPE);
  return {
    schemaVersion: LEGACY_WORKSPACE_SCHEMA_VERSION,
    workspaceId: parsed.workspaceId as string,
    generation: parsed.generation as number,
    base: { revision: base.revision as number | null, payload: base.payload },
    local: parsed.local as PublishedContentPayload,
    updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
    archived: parsed.archived === true,
    legacyOriginal: typeof parsed.legacyOriginal === 'string' ? parsed.legacyOriginal : undefined,
  };
}
