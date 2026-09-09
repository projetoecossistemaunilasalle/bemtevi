import { describe, expect, it } from 'vitest';
import type { PublishedContentPayload } from '../../../app/content/publishedContent';
import { compareContent, contentIdentity, reconcileContent } from '../semanticDiff';

const payload = (groups: Array<{ id: string; title: string; order: number }> = []): PublishedContentPayload => ({
  flows: [],
  educationMaterials: [],
  educationGroups: groups,
  contacts: [],
  locations: [],
  defaultGroupOrder: 0,
});
const group = (id: string, title = id) => ({ id, title, order: 0 });

describe('semantic reconciliation', () => {
  it('preserves inputs and satisfies three-way merge identities', () => {
    const b = payload([group('a')]),
      l = payload([group('a', 'local'), group('b')]);
    const before = JSON.stringify([b, l]);
    for (const args of [
      [b, l, b],
      [b, b, l],
      [b, l, l],
    ] as const) {
      const result = reconcileContent(...args);
      expect(result).toMatchObject({ ok: true, value: { kind: 'complete', candidate: l } });
    }
    expect(JSON.stringify([b, l])).toBe(before);
  });
  it('combines independent fields and distinguishes missing from null', () => {
    const b = payload([group('id.with[punctuation]')]);
    const l = structuredClone(b),
      r = structuredClone(b);
    l.educationGroups[0].title = 'local';
    r.educationGroups[0].order = 2;
    expect(reconcileContent(b, l, r)).toMatchObject({
      ok: true,
      value: { kind: 'complete', candidate: { educationGroups: [{ ...l.educationGroups[0], order: 2 }] } },
    });
    const change = compareContent(b, {
      ...b,
      educationGroups: [{ ...b.educationGroups[0], description: null }],
    } as unknown as PublishedContentPayload);
    expect(change).toMatchObject({
      ok: true,
      value: [{ before: { present: false }, after: { present: true, value: null } }],
    });
  });
  it('resolves edit/delete reversibly and deterministically across JSON export', () => {
    const b = payload([group('a.b[c]')]),
      l = payload([group('a.b[c]', 'local')]),
      r = payload();
    const result = reconcileContent(b, l, r);
    if (!result.ok) throw new Error('comparison');
    expect(result.value.kind).toBe('incomplete');
    const conflict = result.value.conflicts[0];
    expect(conflict.path).toEqual([
      { kind: 'field', key: 'educationGroups' },
      { kind: 'record', id: 'a.b[c]' },
    ]);
    const decisions = JSON.parse(JSON.stringify({ [conflict.id]: conflict.remote }));
    expect(reconcileContent(b, l, r, decisions)).toMatchObject({ ok: true, value: { kind: 'complete', candidate: r } });
    expect(reconcileContent(b, l, r)).toEqual(result);
  });
  it('does not reuse a choice for different conflict inputs', () => {
    const b = payload([group('a')]),
      l = payload([group('a', 'local')]),
      r = payload([group('a', 'remote')]);
    const first = reconcileContent(b, l, r);
    if (!first.ok) throw new Error();
    const conflict = first.value.conflicts[0];
    expect(reconcileContent(b, l, payload([group('a', 'remote 2')]), { [conflict.id]: conflict.local })).toMatchObject({
      ok: true,
      value: { kind: 'incomplete' },
    });
  });
  it('fails closed on duplicate IDs, inconsistent nodes and cyclic inputs', () => {
    expect(compareContent(payload(), payload([group('a'), group('a')]))).toEqual({ ok: false, code: 'invalid_input' });
    const invalid = {
      ...payload(),
      flows: [{ id: 'flow', nodes: { first: { id: 'other' } } }],
    } as unknown as PublishedContentPayload;
    expect(reconcileContent(invalid, invalid, invalid)).toEqual({ ok: false, code: 'invalid_input' });
    const cyclic = payload();
    Object.assign(cyclic, { cyclic });
    expect(compareContent(payload(), cyclic)).toEqual({ ok: false, code: 'invalid_input' });
  });
  it('reports unilateral moves rather than record replacement', () => {
    const b = payload([group('a'), group('b')]),
      l = payload([group('b'), group('a')]);
    expect(compareContent(b, l)).toMatchObject({
      ok: true,
      value: [{ kind: 'moved', path: [{ kind: 'field', key: 'educationGroups' }, { kind: 'order' }] }],
    });
  });
  it('combines unambiguous insertions but exposes ambiguous insertion order', () => {
    const b = payload([group('a'), group('b')]);
    expect(
      reconcileContent(b, payload([group('a'), group('x'), group('b')]), payload([group('a'), group('b'), group('y')])),
    ).toMatchObject({
      ok: true,
      value: { kind: 'complete', candidate: payload([group('a'), group('x'), group('b'), group('y')]) },
    });
    expect(
      reconcileContent(b, payload([group('a'), group('x'), group('b')]), payload([group('a'), group('y'), group('b')])),
    ).toMatchObject({
      ok: true,
      value: {
        kind: 'incomplete',
        conflicts: [{ path: [{ kind: 'field', key: 'educationGroups' }, { kind: 'order' }] }],
      },
    });
  });
  it('treats arrays without identity as atomic and preserves order', () => {
    const b = payload(),
      l = payload(),
      r = payload();
    Object.assign(b, { effects: ['a', 'b'] });
    Object.assign(l, { effects: ['b', 'a'] });
    Object.assign(r, { effects: ['a', 'c'] });
    expect(reconcileContent(b, l, r)).toMatchObject({
      ok: true,
      value: { kind: 'incomplete', conflicts: [{ local: { present: true, value: ['b', 'a'] } }] },
    });
    expect(contentIdentity(['a', 'b'])).not.toBe(contentIdentity(['b', 'a']));
  });
  it('combines compatible bilateral moves without preferring either side', () => {
    const b = payload(['a', 'b', 'c', 'd'].map((id) => group(id)));
    const l = payload(['b', 'a', 'c', 'd'].map((id) => group(id)));
    const r = payload(['a', 'b', 'd', 'c'].map((id) => group(id)));
    expect(reconcileContent(b, l, r)).toMatchObject({
      ok: true,
      value: { kind: 'complete', candidate: payload(['b', 'a', 'd', 'c'].map((id) => group(id))) },
    });
  });
});
