// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  assertComparable,
  compareContent,
  contentIdentity,
  describePath,
  reconcileContent,
  type ComparisonResult,
  type ConflictDecisions,
  type JsonValue,
  type PublishedContentPayload,
  type ValueSlot,
} from '../index';

// The reconciler operates structurally on JSON, so tests use minimal records
// that satisfy the shape it traverses (id/title/name fields) rather than the
// full published model types.
function payload(overrides: Record<string, unknown> = {}): PublishedContentPayload {
  return {
    flows: [],
    educationMaterials: [],
    educationGroups: [],
    contacts: [],
    locations: [],
    defaultGroupOrder: 1,
    ...overrides,
  } as unknown as PublishedContentPayload;
}

// Canonical mirror of the (unexported) fingerprint used in conflict IDs, so the
// tests pin the exact conflict IDs produced by the reconciler.
function fingerprint(input: unknown): string {
  const text = contentIdentity(input);
  let a = 0x811c9dc5,
    b = 0x9e3779b9;
  for (let i = 0; i < text.length; i++) {
    a = Math.imul(a ^ text.charCodeAt(i), 16777619);
    b = Math.imul(b ^ text.charCodeAt(i), 2246822519);
  }
  return `${text.length}:${a >>> 0}:${b >>> 0}`;
}

const slot = (v: unknown): ValueSlot => ({ present: true, value: v as JsonValue });
const absent: ValueSlot = { present: false };

describe('contentIdentity', () => {
  it('is key-order-insensitive but array-order-sensitive', () => {
    expect(contentIdentity({ a: 1, b: 2 })).toBe(contentIdentity({ b: 2, a: 1 }));
    expect(contentIdentity([1, 2])).not.toBe(contentIdentity([2, 1]));
  });

  it('treats null and missing as distinct, and null as significant', () => {
    expect(contentIdentity(null)).toBe('null');
    expect(contentIdentity(undefined)).toBe('missing');
    expect(contentIdentity(null)).not.toBe(contentIdentity(undefined));
  });
});

describe('compareContent', () => {
  it('detects an edited scalar with the canonical path id', () => {
    const before = payload({ flows: [{ id: 'f1', title: 'A' }] });
    const after = payload({ flows: [{ id: 'f1', title: 'B' }] });
    const result = compareContent(before, after);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
    expect(result.value[0]).toMatchObject({
      id: '[{"kind":"field","key":"flows"},{"kind":"record","id":"f1"},{"kind":"field","key":"title"}]',
      kind: 'edited',
    });
  });

  it('distinguishes added, removed and unchanged order', () => {
    const before = payload({ contacts: [{ id: 'c1', name: 'Ana' }] });
    const after = payload({
      contacts: [
        { id: 'c1', name: 'Ana' },
        { id: 'c2', name: 'Bruno' },
      ],
    });
    const result = compareContent(before, after);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual([
      {
        id: '[{"kind":"field","key":"contacts"},{"kind":"record","id":"c2"}]',
        path: [
          { kind: 'field', key: 'contacts' },
          { kind: 'record', id: 'c2' },
        ],
        kind: 'added',
        before: absent,
        after: slot({ id: 'c2', name: 'Bruno' }),
        recordLabel: 'Bruno',
      },
    ]);
  });

  it('reports an ordering change as a moved change', () => {
    const before = payload({ contacts: [{ id: 'c1' }, { id: 'c2' }] });
    const after = payload({ contacts: [{ id: 'c2' }, { id: 'c1' }] });
    const result = compareContent(before, after);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual([
      {
        id: '[{"kind":"field","key":"contacts"},{"kind":"order"}]',
        path: [{ kind: 'field', key: 'contacts' }, { kind: 'order' }],
        kind: 'moved',
        before: slot(['c1', 'c2']),
        after: slot(['c2', 'c1']),
      },
    ]);
  });

  it('rejects invalid input with invalid_input and never throws', () => {
    const expectInvalid = (result: ComparisonResult<unknown>) => {
      expect(result.ok).toBe(false);
      if (result.ok === false) expect(result.code).toBe('invalid_input');
    };
    const broken = { ...payload(), flows: 'nope' };
    expectInvalid(compareContent(broken as unknown as PublishedContentPayload, payload()));
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expectInvalid(compareContent(cyclic as unknown as PublishedContentPayload, payload()));
    expect(() => assertComparable(broken)).toThrow('invalid_input');
  });
});

describe('reconcileContent', () => {
  it('merges distinct-field edits from both sides (complete)', () => {
    const base = payload({
      flows: [{ id: 'f1', title: 'Original' }],
      educationMaterials: [{ id: 'm1', title: 'Material' }],
    });
    const local = payload({
      flows: [{ id: 'f1', title: 'Local' }],
      educationMaterials: [{ id: 'm1', title: 'Material' }],
    });
    const remote = payload({
      flows: [{ id: 'f1', title: 'Original' }],
      educationMaterials: [{ id: 'm1', title: 'Remoto' }],
    });
    const result = reconcileContent(base, local, remote);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.kind).toBe('complete');
    if (result.value.kind !== 'complete') return;
    expect(result.value.conflicts).toEqual([]);
    expect(result.value.candidate.flows[0].title).toBe('Local');
    expect(result.value.candidate.educationMaterials[0].title).toBe('Remoto');
  });

  it('reports an overlapping value conflict and keeps local in the preview', () => {
    const base = payload({ flows: [{ id: 'f1', title: 'Original' }] });
    const local = payload({ flows: [{ id: 'f1', title: 'Local' }] });
    const remote = payload({ flows: [{ id: 'f1', title: 'Remoto' }] });
    const result = reconcileContent(base, local, remote);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.kind).toBe('incomplete');
    expect(result.value.conflicts).toHaveLength(1);
    const conflict = result.value.conflicts[0];
    expect(conflict.path).toEqual([
      { kind: 'field', key: 'flows' },
      { kind: 'record', id: 'f1' },
      { kind: 'field', key: 'title' },
    ]);
    expect(conflict.base).toEqual(slot('Original'));
    expect(conflict.local).toEqual(slot('Local'));
    expect(conflict.remote).toEqual(slot('Remoto'));
    expect(conflict.id).toBe(
      `${JSON.stringify(conflict.path)}:${fingerprint([slot('Original'), slot('Local'), slot('Remoto')])}`,
    );
    // Preview keeps the local value while the conflict is unresolved.
    expect(result.value.candidate.flows[0].title).toBe('Local');
  });

  it('reports a delete/edit conflict when one side removes the record', () => {
    const base = payload({ contacts: [{ id: 'c1', name: 'Ana' }] });
    const local = payload({ contacts: [] });
    const remote = payload({ contacts: [{ id: 'c1', name: 'Ana Souza' }] });
    const result = reconcileContent(base, local, remote);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.kind).toBe('incomplete');
    expect(result.value.conflicts).toHaveLength(1);
    const conflict = result.value.conflicts[0];
    // Canonical behavior (verified against the legacy dashboard tests): a
    // delete/edit of a whole record conflicts at the record path, not the leaf.
    expect(conflict.path).toEqual([
      { kind: 'field', key: 'contacts' },
      { kind: 'record', id: 'c1' },
    ]);
    expect(conflict.base).toEqual(slot({ id: 'c1', name: 'Ana' }));
    expect(conflict.local).toEqual(absent);
    expect(conflict.remote).toEqual(slot({ id: 'c1', name: 'Ana Souza' }));
    expect(conflict.id).toBe(
      `${JSON.stringify(conflict.path)}:${fingerprint([
        slot({ id: 'c1', name: 'Ana' }),
        absent,
        slot({ id: 'c1', name: 'Ana Souza' }),
      ])}`,
    );
  });

  it('reports an ordering conflict when both sides reorder incompatibly', () => {
    const base = payload({ contacts: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }] });
    const local = payload({ contacts: [{ id: 'c3' }, { id: 'c1' }, { id: 'c2' }] });
    const remote = payload({ contacts: [{ id: 'c2' }, { id: 'c3' }, { id: 'c1' }] });
    const result = reconcileContent(base, local, remote);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.kind).toBe('incomplete');
    const orderConflicts = result.value.conflicts.filter((c) => c.path.at(-1)?.kind === 'order');
    expect(orderConflicts.length).toBeGreaterThan(0);
    for (const conflict of orderConflicts) {
      expect(conflict.id).toBe(
        `${JSON.stringify(conflict.path)}:${fingerprint([conflict.base, conflict.local, conflict.remote])}`,
      );
    }
    // All records survive in the preview, ordered by the (unresolved) local choice.
    expect(result.value.candidate.contacts.map((c) => c.id)).toEqual(['c3', 'c1', 'c2']);
  });

  it('applies a decision only while the conflict identity still matches', () => {
    const base = payload({ flows: [{ id: 'f1', title: 'Original' }] });
    const local = payload({ flows: [{ id: 'f1', title: 'Local' }] });
    const remoteA = payload({ flows: [{ id: 'f1', title: 'Remoto A' }] });
    const remoteB = payload({ flows: [{ id: 'f1', title: 'Remoto B' }] });

    const first = reconcileContent(base, local, remoteA);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const conflict = first.value.kind === 'incomplete' ? first.value.conflicts[0] : undefined;
    expect(conflict).toBeDefined();

    const decisions: ConflictDecisions = { [conflict!.id]: slot('Escolhido') };
    const resolved = reconcileContent(base, local, remoteA, decisions);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.value.kind).toBe('complete');
    expect(resolved.value.candidate.flows[0].title).toBe('Escolhido');

    // The same decision must NOT be reused after an overlapping remote edit:
    // the fingerprint of (base, local, remote) changes, so the conflict ID is
    // invalidated and a new conflict is reported.
    const invalidated = reconcileContent(base, local, remoteB, decisions);
    expect(invalidated.ok).toBe(true);
    if (!invalidated.ok) return;
    expect(invalidated.value.kind).toBe('incomplete');
    expect(invalidated.value.conflicts).toHaveLength(1);
    expect(invalidated.value.conflicts[0].id).not.toBe(conflict!.id);
    expect(invalidated.value.conflicts[0].remote).toEqual(slot('Remoto B'));
  });

  it('treats null as a value and missing as absence without conflating them', () => {
    const base = payload({ flows: [{ id: 'f1', title: 'Original', description: null }] });
    const local = payload({ flows: [{ id: 'f1', title: 'Original', description: 'Texto' }] });
    const remote = payload({ flows: [{ id: 'f1', title: 'Original', description: null }] });
    const result = reconcileContent(base, local, remote);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Only local changed the (null) field, so remote is taken elsewhere and the
    // local edit applies cleanly.
    expect(result.value.kind).toBe('complete');
    const description = (result.value.candidate.flows[0] as { description?: unknown }).description;
    expect(description).toBe('Texto');
  });

  it('conflicts when one side removes a field and the other nulls it', () => {
    const local = payload({ flows: [{ id: 'f1', title: 'Original', note: null }] });
    const remote = payload({ flows: [{ id: 'f1', title: 'Original' }] });
    // Both sides changed relative to an older base where note existed.
    const older = payload({ flows: [{ id: 'f1', title: 'Original', note: 'antiga' }] });
    const result = reconcileContent(older, local, remote);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.kind).toBe('incomplete');
    expect(result.value.conflicts[0].path).toEqual([
      { kind: 'field', key: 'flows' },
      { kind: 'record', id: 'f1' },
      { kind: 'field', key: 'note' },
    ]);
    expect(result.value.conflicts[0].local).toEqual(slot(null));
    expect(result.value.conflicts[0].remote).toEqual(absent);
  });

  it('takes the unchanged side for missing values (one-sided add/delete)', () => {
    const base = payload({ flows: [{ id: 'f1', title: 'Original' }] });
    const local = payload({
      flows: [
        { id: 'f1', title: 'Original' },
        { id: 'f2', title: 'Novo' },
      ],
    });
    const remote = payload({ flows: [{ id: 'f1', title: 'Original' }] });
    const result = reconcileContent(base, local, remote);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.kind).toBe('complete');
    expect(result.value.candidate.flows.map((f) => f.id)).toEqual(['f1', 'f2']);

    const deleted = reconcileContent(base, remote, local);
    expect(deleted.ok).toBe(true);
    if (!deleted.ok) return;
    expect(deleted.value.kind).toBe('complete');
    expect(deleted.value.candidate.flows.map((f) => f.id)).toEqual(['f1', 'f2']);
  });

  it('describes paths with the canonical PT-BR labels', () => {
    expect(
      describePath([
        { kind: 'field', key: 'flows' },
        { kind: 'record', id: 'f1' },
        { kind: 'field', key: 'title' },
      ]),
    ).toBe('Fluxos / f1 / Título');
    expect(describePath([{ kind: 'field', key: 'contacts' }, { kind: 'order' }])).toBe('Contatos / Ordem dos itens');
    expect(describePath([{ kind: 'field', key: 'defaultGroupOrder' }])).toBe('Ordem padrão dos grupos');
    expect(describePath([{ kind: 'field', key: 'unknownKey' }])).toBe('unknownKey');
  });
});
