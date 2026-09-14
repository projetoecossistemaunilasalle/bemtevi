import type { JsonValue } from '../contracts/operations';
import type { PublishedContentPayload } from '../model/publishedContent';
import { contentIdentity, equal, field, idsOf, keyed, mapById, object, slot, value } from './types';
import type { ComparisonResult, ContentPath, SemanticChange, ValueSlot } from './types';

export function assertComparable(input: unknown): asserts input is PublishedContentPayload {
  const seen = new WeakSet<object>();
  function visit(v: unknown, path: ContentPath, depth: number) {
    if (depth > 150) throw new Error('invalid_input');
    if (v === undefined || v === null || typeof v === 'string' || typeof v === 'boolean') return;
    if (typeof v === 'number' && Number.isFinite(v)) return;
    if (typeof v !== 'object' || seen.has(v)) throw new Error('invalid_input');
    seen.add(v);
    if (Array.isArray(v)) {
      if (keyed(path)) {
        const ids = new Set<string>();
        for (const entry of v) {
          if (!object(entry) || typeof entry.id !== 'string' || !entry.id || ids.has(entry.id))
            throw new Error('invalid_input');
          ids.add(entry.id);
        }
      }
      v.forEach((entry) => visit(entry, [], depth + 1));
    } else {
      const record = v as Record<string, unknown>;
      for (const [key, entry] of Object.entries(record)) {
        if (key === 'nodes' && object(entry)) {
          for (const [id, node] of Object.entries(entry)) {
            if (!object(node) || node.id !== id) throw new Error('invalid_input');
          }
        }
        visit(entry, [field(key)], depth + 1);
      }
    }
    seen.delete(v);
  }
  if (
    !object(input) ||
    !['flows', 'educationMaterials', 'educationGroups', 'contacts', 'locations'].every((key) =>
      Array.isArray(input[key]),
    ) ||
    typeof input.defaultGroupOrder !== 'number'
  )
    throw new Error('invalid_input');
  visit(input, [], 0);
}

function safe<T>(inputs: unknown[], run: () => T): ComparisonResult<T> {
  try {
    inputs.forEach(assertComparable);
  } catch {
    return { ok: false, code: 'invalid_input' };
  }
  try {
    return { ok: true, value: run() };
  } catch {
    return { ok: false, code: 'comparison_failed' };
  }
}

export function compareContent(
  before: PublishedContentPayload,
  after: PublishedContentPayload,
): ComparisonResult<SemanticChange[]> {
  return safe([before, after], () => {
    const changes: SemanticChange[] = [];
    function walk(a: ValueSlot, b: ValueSlot, path: ContentPath, recordLabel?: string) {
      if (equal(a, b)) return;
      const av = value(a),
        bv = value(b);
      if (object(av) && object(bv)) {
        for (const key of new Set([...Object.keys(av), ...Object.keys(bv)]))
          walk(slot(av[key] as JsonValue), slot(bv[key] as JsonValue), [...path, field(key)], recordLabel);
        return;
      }
      if (Array.isArray(av) && Array.isArray(bv) && keyed(path)) {
        const am = mapById(av),
          bm = mapById(bv);
        for (const id of new Set([...am.keys(), ...bm.keys()])) {
          const record = bm.get(id) ?? am.get(id);
          const name = object(record) ? (record.title ?? record.name ?? record.label) : undefined;
          walk(
            slot(am.get(id)),
            slot(bm.get(id)),
            [...path, { kind: 'record', id }],
            typeof name === 'string' ? name : recordLabel,
          );
        }
        const ai = idsOf(av).filter((id) => bm.has(id)),
          bi = idsOf(bv).filter((id) => am.has(id));
        if (contentIdentity(ai) !== contentIdentity(bi)) {
          const orderPath: ContentPath = [...path, { kind: 'order' }];
          changes.push({
            id: JSON.stringify(orderPath),
            path: orderPath,
            kind: 'moved',
            before: slot(idsOf(av)),
            after: slot(idsOf(bv)),
          });
        }
        return;
      }
      changes.push({
        id: JSON.stringify(path),
        path,
        kind: !a.present ? 'added' : !b.present ? 'removed' : 'edited',
        before: a,
        after: b,
        recordLabel,
      });
    }
    walk(slot(before as unknown as JsonValue), slot(after as unknown as JsonValue), []);
    return changes;
  });
}
