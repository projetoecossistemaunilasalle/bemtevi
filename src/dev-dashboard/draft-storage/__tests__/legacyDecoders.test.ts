import { describe, expect, it } from 'vitest';
import type { PublishedContentPayload } from '../../../app/content/publishedContent';
import { decodeLegacyDraftState, decodeLegacyWorkspaceEnvelope, legacyStateHasChanges } from '../legacyDecoders';

const BASE: PublishedContentPayload = {
  flows: [],
  educationMaterials: [{ id: 'm1', title: 'base' }],
  educationGroups: [{ id: 'g1', title: 'Grupo', order: 1 }],
  contacts: [{ id: 'c1', name: 'Contato' }],
  locations: [],
  defaultGroupOrder: 0,
} as unknown as PublishedContentPayload;

describe('legacyDecoders', () => {
  it('normalizes supported draft versions without rewriting unknown recovery data', () => {
    const state = decodeLegacyDraftState(
      JSON.stringify({
        schemaVersion: '4.0.0',
        updatedAt: 42,
        baseRevision: -1,
        basePayload: BASE,
        customRecoveryValue: 'keep-me',
        groupPatches: [{ id: 'g1', patch: { title: 'Novo' } }],
      }),
    );

    expect(state).toMatchObject({
      schemaVersion: '4.0.0',
      updatedAt: null,
      baseRevision: null,
      basePayload: BASE,
      customRecoveryValue: 'keep-me',
    });
    expect(legacyStateHasChanges(state!)).toBe(true);
  });

  it('does not expose malformed payloads as mergeable base data', () => {
    const state = decodeLegacyDraftState(
      JSON.stringify({
        schemaVersion: '6.0.0',
        updatedAt: null,
        basePayload: { ...BASE, contacts: [{ name: 'missing id' }] },
        defaultGroupOrder: 0,
      }),
    );

    expect(state).not.toBeNull();
    expect(state?.basePayload).toBeUndefined();
    expect(legacyStateHasChanges(state!)).toBe(false);
  });

  it('accepts a valid workspace envelope and rejects invalid identity or payload', () => {
    const envelope = {
      schemaVersion: 7,
      workspaceId: 'ws-1',
      generation: 3,
      base: { revision: null, payload: BASE },
      local: { ...BASE, defaultGroupOrder: 2 },
      updatedAt: '2026-06-01T00:00:00.000Z',
    };

    expect(decodeLegacyWorkspaceEnvelope(JSON.stringify(envelope))).toMatchObject(envelope);
    expect(() =>
      decodeLegacyWorkspaceEnvelope(
        JSON.stringify({ ...envelope, workspaceId: '', base: { ...envelope.base, payload: null } }),
      ),
    ).toThrow(/Arquivo de rascunho inválido/);
  });
});
