import type { GuidedFlow } from '../../domain/flow-engine/types';
import type { EducationResource } from '../../domain/resources/types';
import type { ServiceDirectoryEntry, ServiceLocation } from '../../domain/services/types';
import { deriveLocationsFromContacts, normalizeContactLocations } from '../../domain/services/locations';
import type { EducationResourceGroup } from '../../content/resources/groups';
import type { PublishedContentPayload } from '../../app/content/publishedContent';
import {
  decodeLegacyDraftState,
  decodeLegacyWorkspaceEnvelope,
  legacyStateHasChanges,
  positiveInt,
  toArray,
  toPatches,
  type LegacyRecordPatch,
} from './legacyDecoders';
export {
  decodeLegacyDraftState,
  decodeLegacyWorkspaceEnvelope,
  legacyStateHasChanges,
  LEGACY_WORKSPACE_SCHEMA_VERSION,
} from './legacyDecoders';
export type { LegacyDraftState, LegacyRecordPatch, LegacyWorkspaceEnvelope } from './legacyDecoders';

/**
 * One-time legacy recovery adapter (doc 16 "IndexedDB Recovery"; DASHBOARD-03).
 * Read-only by construction: it DECODES the old browser bytes and never writes
 * or deletes any browser store. Original user bytes are preserved verbatim and
 * stay downloadable. Import is always explicit; a legacy local generation is
 * recovery metadata ONLY and never becomes a Neon CAS generation. It must
 * survive LEGACY-01 (which deletes the old storage modules), so every decoder
 * lives here; the old draft state stays a loose record (versions 1–6 vary).
 */

export const LEGACY_DRAFT_STORAGE_KEY = 'bemtevi:dev-dashboard:drafts:v1';
export const LEGACY_BACKUP_DB_NAME = 'bemtevi_dashboard_db';
export const LEGACY_BACKUP_STORE_NAME = 'drafts';
export const LEGACY_BACKUP_RECORD_KEY = 'current_draft';
export const LEGACY_WORKSPACE_DB_NAME = 'bemtevi_dashboard_workspaces';

export interface LegacyRecoveryOption {
  /** Stable identifier of the offered source (used for explicit selection). */
  sourceId: string;
  kind: 'local-storage' | 'indexed-db-backup' | 'workspace-envelope';
  /** Original bytes (verbatim) for download; never rewritten. */
  raw: string;
  updatedAt: string | null;
  workspaceId?: string;
  /** Legacy local generation metadata; NEVER usable as a Neon generation. */
  legacyGeneration?: number;
}

export type LegacyImportPlan =
  | { kind: 'merge'; sourceId: string; candidate: PublishedContentPayload }
  | { kind: 'download-only'; sourceId: string; reason: 'no-base-payload' | 'unusable-state' };

function openLegacyDatabase(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('storage_unavailable'));
    const request = indexedDB.open(name);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('storage_unavailable'));
    request.onblocked = () => reject(new Error('storage_unavailable'));
  });
}

function readOnce<T>(
  db: IDBDatabase,
  storeName: string,
  run: (store: IDBObjectStore) => IDBRequest,
): Promise<T | null> {
  return new Promise((resolve, reject) => {
    let result: T | null = null;
    const tx = db.transaction([storeName], 'readonly'); // recovery never opens a readwrite transaction
    const request = run(tx.objectStore(storeName));
    request.onsuccess = () => {
      result = request.result as T;
    };
    tx.oncomplete = () => {
      db.close();
      resolve(result);
    };
    tx.onerror = tx.onabort = () => {
      db.close();
      reject(tx.error ?? new Error('storage_unavailable'));
    };
  });
}

function localStorageOption(): LegacyRecoveryOption | null {
  try {
    const raw = localStorage.getItem(LEGACY_DRAFT_STORAGE_KEY);
    const state = raw === null ? null : decodeLegacyDraftState(raw);
    if (raw === null || state === null || !legacyStateHasChanges(state)) return null;
    return { sourceId: 'local-storage', kind: 'local-storage', raw, updatedAt: state.updatedAt };
  } catch {
    return null; // Storage may be unavailable; other sources still apply.
  }
}

async function backupOption(): Promise<LegacyRecoveryOption | null> {
  const db = await openLegacyDatabase(LEGACY_BACKUP_DB_NAME);
  try {
    const record = await readOnce<{ state: unknown; savedAt: number }>(db, LEGACY_BACKUP_STORE_NAME, (store) =>
      store.get(LEGACY_BACKUP_RECORD_KEY),
    );
    if (record?.state === undefined) return null;
    const raw = JSON.stringify(record.state),
      state = decodeLegacyDraftState(raw),
      savedAt = positiveInt(record.savedAt);
    if (state === null || !legacyStateHasChanges(state)) return null;
    const option: LegacyRecoveryOption = {
      sourceId: 'indexed-db-backup',
      kind: 'indexed-db-backup',
      raw,
      updatedAt: state.updatedAt ?? (savedAt !== null ? new Date(savedAt).toISOString() : null),
    };
    return option;
  } finally {
    db.close();
  }
}

async function workspaceOptions(): Promise<LegacyRecoveryOption[]> {
  const db = await openLegacyDatabase(LEGACY_WORKSPACE_DB_NAME);
  try {
    const workspaces = await readOnce<unknown[]>(db, 'workspaces', (store) => store.getAll());
    const options: LegacyRecoveryOption[] = [];
    for (const workspace of toArray<Record<string, unknown>>(workspaces)) {
      const raw = JSON.stringify(workspace);
      try {
        // Unreadable envelopes are skipped, never deleted.
        const envelope = decodeLegacyWorkspaceEnvelope(raw);
        if (!envelope.archived) {
          options.push({
            sourceId: `workspace:${envelope.workspaceId}`,
            kind: 'workspace-envelope',
            raw,
            updatedAt: envelope.updatedAt,
            workspaceId: envelope.workspaceId,
            legacyGeneration: envelope.generation,
          });
        }
      } catch {
        /* skip */
      }
    }
    return options;
  } finally {
    db.close();
  }
}

/** Read-only listing of every offered legacy cache; selection is explicit. */
export async function listLegacyRecoveries(): Promise<LegacyRecoveryOption[]> {
  const offered = [
    localStorageOption(),
    await backupOption().catch(() => null),
    ...(await workspaceOptions().catch(() => [])),
  ];
  return offered.filter((option): option is LegacyRecoveryOption => option !== null);
}

/** Returns the verbatim original bytes for download/recovery export. */
export function exportLegacyRecovery(option: LegacyRecoveryOption): string {
  return option.raw;
}

function mergeRecords<T extends { id: string }>(
  shipped: T[],
  patches: Array<LegacyRecordPatch<T>>,
  additions: T[],
): T[] {
  const indexed = patches.filter((record) => typeof record.sourceIndex === 'number');
  const bySource = new Map(indexed.map((record) => [`${record.id}:${record.sourceIndex}`, record]));
  const count = (records: Array<{ id: string }>) => {
    const counts = new Map<string, number>();
    for (const record of records) counts.set(record.id, (counts.get(record.id) ?? 0) + 1);
    return counts;
  };
  const shippedCounts = count(shipped),
    patchCounts = count(indexed);
  const indexedById = new Map(indexed.map((record) => [record.id, record]));
  const legacyById = new Map(
    patches.filter((record) => typeof record.sourceIndex !== 'number').map((record) => [record.id, record.patch]),
  );
  const usedIndexed = new Set<LegacyRecordPatch<T>>(),
    usedLegacy = new Set<string>();
  return [
    ...shipped.map((record, sourceIndex) => {
      const sourcePatch = bySource.get(`${record.id}:${sourceIndex}`);
      const exact =
        sourcePatch?.sourceIdUnique === false && shippedCounts.get(record.id) === 1 ? undefined : sourcePatch;
      const idPatch = indexedById.get(record.id);
      const canFallback =
        !exact &&
        shippedCounts.get(record.id) === 1 &&
        patchCounts.get(record.id) === 1 &&
        idPatch?.sourceIdUnique === true;
      const candidate = exact ?? (canFallback ? idPatch : undefined);
      const indexedPatch = candidate && !usedIndexed.has(candidate) ? candidate : undefined;
      const legacyPatch = indexedPatch || usedLegacy.has(record.id) ? undefined : legacyById.get(record.id);
      if (indexedPatch) usedIndexed.add(indexedPatch);
      if (legacyPatch) usedLegacy.add(record.id);
      return { ...record, ...(indexedPatch?.patch ?? legacyPatch) };
    }),
    ...additions,
  ];
}

/**
 * Builds the explicit import plan for ONE selected legacy option. With a
 * legacy basePayload the recorded patches are applied to that base and the
 * coordinator reconciles the candidate against the Neon draft as a normal
 * conditional save. WITHOUT a base the import is download-only: no base is
 * ever inferred and nothing overwrites the current draft. The legacy local
 * generation never appears in the plan.
 */
export function planLegacyImport(option: LegacyRecoveryOption): LegacyImportPlan {
  if (option.kind === 'workspace-envelope') {
    try {
      const envelope = decodeLegacyWorkspaceEnvelope(option.raw);
      return { kind: 'merge', sourceId: option.sourceId, candidate: envelope.local };
    } catch {
      return { kind: 'download-only', sourceId: option.sourceId, reason: 'unusable-state' };
    }
  }
  const state = decodeLegacyDraftState(option.raw);
  if (state === null || !state.basePayload) {
    // No legacy base: recovery stays download-only, no inferred base.
    return {
      kind: 'download-only',
      sourceId: option.sourceId,
      reason: state === null ? 'unusable-state' : 'no-base-payload',
    };
  }
  const base = state.basePayload;
  const p = <T extends { id: string }>(key: string) => toPatches<T>(state[key]);
  const a = <T>(key: string) => toArray<T>(state[key]);
  const removedIds = (key: string) => new Set(a<string>(key));
  const educationGroups = mergeRecords(
    base.educationGroups,
    p<EducationResourceGroup>('groupPatches'),
    a<EducationResourceGroup>('addedGroups'),
  ).filter((group) => !removedIds('removedGroupIds').has(group.id));
  const flows = mergeRecords(base.flows, p<GuidedFlow>('flowPatches'), a<GuidedFlow>('addedFlows')).filter(
    (flow) => !removedIds('removedFlowIds').has(flow.id),
  );
  const contacts = mergeRecords(
    base.contacts,
    p<ServiceDirectoryEntry>('contactPatches'),
    a<ServiceDirectoryEntry>('addedContacts'),
  ).filter((contact) => !removedIds('removedContactIds').has(contact.id));
  const shippedLocations = Array.isArray(base.locations) ? base.locations : deriveLocationsFromContacts(base.contacts);
  const locations = mergeRecords(
    shippedLocations,
    p<ServiceLocation>('locationPatches'),
    a<ServiceLocation>('addedLocations'),
  ).filter((location) => !removedIds('removedLocationIds').has(location.id));
  const legacyLocationPatchIds = new Set(
    p<ServiceDirectoryEntry>('contactPatches')
      .filter(
        ({ patch }) =>
          !Object.hasOwn(patch, 'locationId') && (Object.hasOwn(patch, 'city') || Object.hasOwn(patch, 'state')),
      )
      .map(({ id }) => id),
  );
  const explicitlyPatched = new Set(p<ServiceLocation>('locationPatches').map(({ id }) => id)),
    preserved = new Set<number>();
  contacts.forEach((contact, index) => {
    const locationId = typeof contact.locationId === 'string' ? contact.locationId : '';
    if (legacyLocationPatchIds.has(contact.id) && !explicitlyPatched.has(locationId)) preserved.add(index);
  });
  const normalized = normalizeContactLocations(contacts, locations, {
    allowDerivation: !Array.isArray(base.locations) && legacyLocationPatchIds.size === 0,
    preserveDenormalizedContactIndexes: preserved,
  });
  const materials = mergeRecords(
    base.educationMaterials,
    p<EducationResource>('educationMaterialPatches'),
    a<EducationResource>('addedEducationMaterials'),
  ).filter((material) => !removedIds('removedEducationMaterialIds').has(material.id));
  return {
    kind: 'merge',
    sourceId: option.sourceId,
    candidate: {
      flows,
      educationMaterials: materials,
      educationGroups: [...educationGroups].sort((left, right) => left.order - right.order),
      contacts: normalized.contacts,
      locations: normalized.locations,
      defaultGroupOrder: state.defaultGroupOrder ?? base.defaultGroupOrder ?? 0,
    },
  };
}
