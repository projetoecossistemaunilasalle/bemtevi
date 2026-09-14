import { describe, expect, it } from 'vitest';
import type { PublishedContentPayload } from '@bemtevi/content-core';

import type { DraftBaseSnapshot } from '../draftTypes';
import {
  CACHE_FAILED_LABEL,
  TIMINGS,
  initialSaveState,
  mergeOutcome,
  remoteMatchesCandidate,
  saveStatusLabel,
  toBaseSnapshot,
  toClean,
  toConflict,
  toDirty,
  toError,
  toSaving,
} from '../saveTransitions';

const material = (title: string): PublishedContentPayload['educationMaterials'][number] =>
  ({ id: 'm1', title }) as unknown as PublishedContentPayload['educationMaterials'][number];

const payload = (title: string): PublishedContentPayload => ({
  flows: [],
  educationMaterials: [material(title)],
  educationGroups: [],
  contacts: [],
  locations: [],
  defaultGroupOrder: 0,
});

const head = (generation: number) => ({
  id: 'current' as const,
  schemaVersion: '1.0.0' as const,
  baseRevision: 5,
  generation,
  digest: `dg-${generation}`,
  updatedAt: '2026-01-01T00:00:00Z',
  lastActor: { kind: 'admin' as const, principalUserId: 'admin-a', connectionId: null },
});

const baseOf = (generation: number, title: string): DraftBaseSnapshot => ({
  ...head(generation),
  payload: payload(title),
});

describe('TIMINGS', () => {
  it('freezes the dossier timings 250/750/5000/15000', () => {
    expect(TIMINGS.cacheDebounceMs).toBe(250);
    expect(TIMINGS.saveDebounceMs).toBe(750);
    expect(TIMINGS.maxWaitMs).toBe(5000);
    expect(TIMINGS.pollIntervalMs).toBe(15000);
  });
});

describe('saveStatusLabel', () => {
  it('uses the exact doc-16 labels per phase', () => {
    expect(saveStatusLabel(initialSaveState())).toBe('Carregando rascunho...');
    expect(saveStatusLabel({ ...initialSaveState(), phase: 'dirty' })).toBe('Alterações pendentes');
    expect(saveStatusLabel({ ...initialSaveState(), phase: 'saving' })).toBe('Salvando...');
    expect(saveStatusLabel({ ...initialSaveState(), phase: 'clean' })).toBe('Salvo no BemTeVi');
    expect(saveStatusLabel({ ...initialSaveState(), phase: 'offline' })).toBe('Sem conexão. Salvo neste dispositivo');
    expect(saveStatusLabel({ ...initialSaveState(), phase: 'conflict' })).toBe('Conflito: revise as alterações');
    expect(saveStatusLabel({ ...initialSaveState(), phase: 'error' })).toBe('Não foi possível salvar');
  });

  it('never claims a local save when the cache failed', () => {
    for (const phase of ['dirty', 'offline', 'error'] as const) {
      const state = { ...initialSaveState(), phase, cacheAvailable: false };
      expect(saveStatusLabel(state)).toBe(CACHE_FAILED_LABEL);
    }
    expect(saveStatusLabel({ ...initialSaveState(), phase: 'clean', cacheAvailable: false })).toBe('Salvo no BemTeVi');
  });
});

describe('transitions', () => {
  it('builds the initial loading state', () => {
    expect(initialSaveState()).toEqual({
      phase: 'loading',
      base: null,
      local: null,
      conflicts: [],
      error: null,
      cacheAvailable: true,
    });
  });

  it('toDirty stores the local candidate and clears conflict/error', () => {
    const base = baseOf(1, 'base');
    const previous = {
      ...initialSaveState(),
      phase: 'conflict' as const,
      base,
      error: { code: 'retry_required' as const },
    };
    const next = toDirty(previous, payload('local'));
    expect(next.phase).toBe('dirty');
    expect(next.local).toEqual(payload('local'));
    expect(next.base).toBe(base);
    expect(next.conflicts).toEqual([]);
    expect(next.error).toBeNull();
  });

  it('toSaving, toClean, toConflict and toError keep base/local', () => {
    const base = baseOf(2, 'remote');
    const dirty = toDirty({ ...initialSaveState(), base }, payload('local'));
    const saving = toSaving(dirty);
    expect(saving.phase).toBe('saving');
    expect(saving.local).toEqual(payload('local'));
    const clean = toClean(saving, base);
    expect(clean.phase).toBe('clean');
    expect(clean.local).toBeNull();
    const conflict = toConflict(
      dirty,
      [{ id: 'c1', path: [], base: { present: false }, local: { present: false }, remote: { present: false } }],
      {
        code: 'retry_required',
      },
    );
    expect(conflict.phase).toBe('conflict');
    expect(conflict.error).toEqual({ code: 'retry_required' });
    expect(conflict.local).toEqual(payload('local'));
    const error = toError(dirty, { code: 'unavailable' }, true);
    expect(error.phase).toBe('offline');
    expect(error.error).toEqual({ code: 'unavailable' });
    expect(toError(dirty, { code: 'unavailable' }, false).phase).toBe('error');
  });

  it('toBaseSnapshot keeps the head fields plus the payload', () => {
    const snapshot = toBaseSnapshot(head(7), payload('x'));
    expect(snapshot.generation).toBe(7);
    expect(snapshot.digest).toBe('dg-7');
    expect(snapshot.payload).toEqual(payload('x'));
  });
});

describe('mergeOutcome', () => {
  it('completes when only one side changed a value', () => {
    const outcome = mergeOutcome(payload('base'), payload('local'), payload('base'));
    expect(outcome.kind).toBe('complete');
    if (outcome.kind === 'complete') {
      expect(outcome.candidate).toEqual(payload('local'));
    }
  });

  it('reports an incomplete merge when both sides changed differently', () => {
    const outcome = mergeOutcome(payload('base'), payload('local'), payload('remote'));
    expect(outcome.kind).toBe('incomplete');
    if (outcome.kind === 'incomplete') {
      expect(outcome.conflicts).toHaveLength(1);
      expect(outcome.conflicts[0]?.local).toEqual({ present: true, value: 'local' });
      expect(outcome.conflicts[0]?.remote).toEqual({ present: true, value: 'remote' });
    }
  });

  it('fails closed for structurally invalid input', () => {
    const broken = { ...payload('x'), flows: 'nope' } as unknown as PublishedContentPayload;
    expect(mergeOutcome(broken, payload('local'), payload('base')).kind).toBe('invalid');
  });
});

describe('remoteMatchesCandidate', () => {
  it('is key-order insensitive and array-order sensitive', () => {
    const a: PublishedContentPayload = { ...payload('x'), educationMaterials: [material('x')] };
    const reordered = {
      educationMaterials: [{ title: 'x', id: 'm1' }],
      contacts: [],
      educationGroups: [],
      locations: [],
      flows: [],
      defaultGroupOrder: 0,
    } as unknown as PublishedContentPayload;
    expect(remoteMatchesCandidate(a, reordered)).toBe(true);
    const reorderedItems = {
      ...payload('x'),
      educationMaterials: [material('x'), material('x')],
    } as unknown as PublishedContentPayload;
    expect(remoteMatchesCandidate(a, reorderedItems)).toBe(false);
  });
});
