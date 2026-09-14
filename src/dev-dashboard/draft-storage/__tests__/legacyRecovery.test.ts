import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublishedContentPayload } from '../../../app/content/publishedContent';
import {
  LEGACY_BACKUP_DB_NAME,
  LEGACY_DRAFT_STORAGE_KEY,
  LEGACY_WORKSPACE_DB_NAME,
  decodeLegacyDraftState,
  decodeLegacyWorkspaceEnvelope,
  exportLegacyRecovery,
  legacyStateHasChanges,
  listLegacyRecoveries,
  planLegacyImport,
  type LegacyDraftState,
} from '../legacyRecovery';

const BASE: PublishedContentPayload = {
  flows: [],
  educationMaterials: [{ id: 'm1', title: 'base' }],
  educationGroups: [{ id: 'g1', title: 'Grupo', order: 1 }],
  contacts: [{ id: 'c1', name: 'Contato' }],
  locations: [],
  defaultGroupOrder: 0,
} as unknown as PublishedContentPayload;

const stateWithChanges = (overrides: Partial<LegacyDraftState> = {}): LegacyDraftState => ({
  schemaVersion: '6.0.0',
  updatedAt: '2026-05-22T00:00:00.000Z',
  baseRevision: 3,
  basePayload: BASE,
  defaultGroupOrder: 2,
  ...overrides,
});

// --- Minimal read-only IndexedDB fake (records never mutated) -----------------

type FakeRecord = { store: string; value: unknown };

function fakeIndexedDB(databases: Record<string, FakeRecord[]>) {
  const deletes: string[] = [];
  const modes: string[] = [];
  const factory = {
    open: (name: string) => {
      const db = {
        close: () => undefined,
        transaction: (storeNames: string[], mode?: string) => {
          modes.push(`${name}:${mode ?? 'readonly'}`);
          const records = databases[name]?.filter((record) => record.store === storeNames[0]) ?? [];
          const tx = {
            objectStore: (storeName: string) => ({
              get: (key: string) => {
                const found = databases[name]?.find(
                  (record) => record.store === storeName && (record.value as { key?: string } | undefined)?.key === key,
                );
                const request = { result: found?.value ?? undefined, onsuccess: null as (() => void) | null };
                queueMicrotask(() => {
                  request.onsuccess?.();
                  queueMicrotask(() => tx.oncomplete?.());
                });
                return request;
              },
              getAll: () => {
                const request = {
                  result: records.map((record) => record.value),
                  onsuccess: null as (() => void) | null,
                };
                queueMicrotask(() => {
                  request.onsuccess?.();
                  queueMicrotask(() => tx.oncomplete?.());
                });
                return request;
              },
            }),
            oncomplete: null as (() => void) | null,
            onerror: null,
            onabort: null,
          };
          return tx;
        },
      };
      const request = { result: db, onsuccess: null as (() => void) | null, onerror: null, onblocked: null };
      queueMicrotask(() => request.onsuccess?.());
      return request;
    },
    deleteDatabase: (name: string) => {
      deletes.push(name);
      const request = { onsuccess: null, onerror: null };
      queueMicrotask(() => request.onsuccess?.());
      return request;
    },
  };
  return { factory, deletes, modes };
}

function workspaceEnvelope(workspaceId: string, generation: number, archived = false): Record<string, unknown> {
  return {
    schemaVersion: 7,
    workspaceId,
    generation,
    base: { revision: 3, payload: BASE },
    local: { ...BASE, defaultGroupOrder: 9 },
    updatedAt: '2026-06-01T00:00:00.000Z',
    archived,
  };
}

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('legacyRecovery decoders', () => {
  it('decodes old draft state bytes and detects changes', () => {
    const raw = JSON.stringify(stateWithChanges());
    const state = decodeLegacyDraftState(raw);
    expect(state).not.toBeNull();
    expect(legacyStateHasChanges(state!)).toBe(true);
    expect(state!.basePayload).toEqual(BASE);
  });

  it('rejects unusable bytes and empty drafts', () => {
    expect(decodeLegacyDraftState('{')).toBeNull();
    expect(decodeLegacyDraftState('{"schemaVersion":"9.9.9"}')).toBeNull();
    const empty = decodeLegacyDraftState(JSON.stringify({ schemaVersion: '6.0.0', updatedAt: null, flowPatches: [] }));
    expect(empty).not.toBeNull();
    expect(legacyStateHasChanges(empty!)).toBe(false);
  });

  it('validates old workspace envelopes without rewriting identity and metadata generation', () => {
    const envelope = workspaceEnvelope('ws-1', 42);
    const decoded = decodeLegacyWorkspaceEnvelope(JSON.stringify(envelope));
    expect(decoded.workspaceId).toBe('ws-1');
    expect(decoded.generation).toBe(42); // recovery metadata only
    for (const invalid of [
      '{',
      '{}',
      JSON.stringify({ ...envelope, schemaVersion: 8 }),
      JSON.stringify({ ...envelope, local: null }),
    ]) {
      expect(() => decodeLegacyWorkspaceEnvelope(invalid)).toThrow();
    }
  });
});

describe('listLegacyRecoveries (explicit selection, read-only)', () => {
  it('offers multiple caches and never picks one automatically', async () => {
    const raw = JSON.stringify(stateWithChanges());
    localStorage.setItem(LEGACY_DRAFT_STORAGE_KEY, raw);
    const { factory, deletes } = fakeIndexedDB({
      [LEGACY_WORKSPACE_DB_NAME]: [
        { store: 'workspaces', value: workspaceEnvelope('ws-1', 7) },
        { store: 'workspaces', value: workspaceEnvelope('ws-2', 9) },
        { store: 'workspaces', value: workspaceEnvelope('ws-archived', 3, true) },
      ],
    });
    vi.stubGlobal('indexedDB', factory);
    const options = await listLegacyRecoveries();
    expect(options.map((option) => option.sourceId)).toEqual(['local-storage', 'workspace:ws-1', 'workspace:ws-2']);
    // Each option keeps verbatim original bytes for download.
    expect(options[0]!.raw).toBe(raw);
    expect(options[1]!.legacyGeneration).toBe(7);
    expect(deletes).toEqual([]); // never deletes any browser store
  });

  it('preserves the original localStorage bytes and offers the IndexedDB backup read-only', async () => {
    const raw = JSON.stringify(stateWithChanges({ defaultGroupOrder: 5 }));
    localStorage.setItem(LEGACY_DRAFT_STORAGE_KEY, raw);
    const { factory, modes, deletes } = fakeIndexedDB({
      [LEGACY_BACKUP_DB_NAME]: [{ store: 'drafts', value: { key: 'current_draft', state: stateWithChanges() } }],
      [LEGACY_WORKSPACE_DB_NAME]: [],
    });
    vi.stubGlobal('indexedDB', factory);
    const options = await listLegacyRecoveries();
    expect(options.map((option) => option.sourceId)).toEqual(['local-storage', 'indexed-db-backup']);
    expect(localStorage.getItem(LEGACY_DRAFT_STORAGE_KEY)).toBe(raw); // no automatic overwrite
    expect(modes.every((mode) => mode.endsWith('readonly'))).toBe(true);
    expect(deletes).toEqual([]);
    expect(exportLegacyRecovery(options[0]!)).toBe(raw);
  });

  it('offers nothing when every source is empty or unreadable', async () => {
    const { factory } = fakeIndexedDB({});
    vi.stubGlobal('indexedDB', factory);
    expect(await listLegacyRecoveries()).toEqual([]);
  });
});

describe('planLegacyImport (explicit one-time import)', () => {
  it('applies recorded patches onto the legacy base payload', () => {
    const raw = JSON.stringify(
      stateWithChanges({
        basePayload: BASE,
        groupPatches: [{ id: 'g1', sourceIndex: 0, sourceIdUnique: true, patch: { title: 'Novo nome' } }],
        addedContacts: [{ id: 'c2', name: 'Novo contato' }],
        removedEducationMaterialIds: ['m1'],
      }),
    );
    const plan = planLegacyImport({ sourceId: 'local-storage', kind: 'local-storage', raw, updatedAt: null });
    expect(plan.kind).toBe('merge');
    if (plan.kind !== 'merge') return;
    expect(plan.candidate.educationGroups).toEqual([{ id: 'g1', title: 'Novo nome', order: 1 }]);
    expect(plan.candidate.contacts).toHaveLength(2);
    expect(plan.candidate.educationMaterials).toEqual([]);
    expect(plan.candidate.defaultGroupOrder).toBe(2);
    // A legacy import plan NEVER carries a local generation for Neon CAS.
    expect(Object.hasOwn(plan, 'generation')).toBe(false);
  });

  it('stays download-only when the legacy state has no base payload', () => {
    const raw = JSON.stringify({ schemaVersion: '2.0.0', flowPatches: [{ id: 'f1', patch: {} }], updatedAt: null });
    const plan = planLegacyImport({ sourceId: 'local-storage', kind: 'local-storage', raw, updatedAt: null });
    expect(plan).toEqual({ kind: 'download-only', sourceId: 'local-storage', reason: 'no-base-payload' });
  });

  it('reports unusable bytes without inferring a base or throwing', () => {
    const plan = planLegacyImport({ sourceId: 'local-storage', kind: 'local-storage', raw: '{', updatedAt: null });
    expect(plan).toEqual({ kind: 'download-only', sourceId: 'local-storage', reason: 'unusable-state' });
  });

  it('offers an old workspace candidate as a merge while its generation stays metadata', () => {
    const option = {
      sourceId: 'workspace:ws-1',
      kind: 'workspace-envelope' as const,
      raw: JSON.stringify(workspaceEnvelope('ws-1', 42)),
      updatedAt: null,
      legacyGeneration: 42,
    };
    const plan = planLegacyImport(option);
    expect(plan.kind).toBe('merge');
    if (plan.kind !== 'merge') return;
    expect(plan.candidate).toEqual({ ...BASE, defaultGroupOrder: 9 });
    expect(Object.hasOwn(plan, 'generation')).toBe(false);
  });

  it('stays download-only for a corrupt workspace envelope', () => {
    const plan = planLegacyImport({
      sourceId: 'workspace:bad',
      kind: 'workspace-envelope',
      raw: '{',
      updatedAt: null,
    });
    expect(plan).toEqual({ kind: 'download-only', sourceId: 'workspace:bad', reason: 'unusable-state' });
  });
});
