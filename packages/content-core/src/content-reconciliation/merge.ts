import type { JsonValue } from '../contracts/operations';
import type { PublishedContentPayload } from '../model/publishedContent';
import { compareSafe } from './safe';
import { contentIdentity, equal, field, fingerprint, idsOf, keyed, mapById, object, slot, value } from './types';
import type {
  ComparisonResult,
  ConflictDecisions,
  ContentPath,
  SemanticConflict,
  SemanticMerge,
  ValueSlot,
} from './types';

function combineOrder(base: string[], local: string[], remote: string[], remaining: Set<string>): string[] | null {
  const filter = (ids: string[]) => ids.filter((id) => remaining.has(id));
  base = filter(base);
  local = filter(local);
  remote = filter(remote);
  if (contentIdentity(local) === contentIdentity(remote)) return local;
  if (contentIdentity(base) === contentIdentity(local)) return remote;
  if (contentIdentity(base) === contentIdentity(remote)) return local;
  const edges = new Map([...remaining].map((id) => [id, new Set<string>()]));
  const incoming = new Map([...remaining].map((id) => [id, 0]));
  const positions = (ids: string[]) => new Map(ids.map((id, index) => [id, index]));
  const bp = positions(base),
    lp = positions(local),
    rp = positions(remote);
  for (const order of [local, remote])
    for (let i = 1; i < order.length; i++) {
      const from = order[i - 1],
        to = order[i];
      const other = order === local ? rp : lp;
      // Do not let an unchanged adjacency veto the other side's explicit move.
      if (
        bp.has(from) &&
        bp.has(to) &&
        bp.get(from)! < bp.get(to)! &&
        other.has(from) &&
        other.has(to) &&
        other.get(from)! > other.get(to)!
      )
        continue;
      if (!edges.get(from)!.has(to)) {
        edges.get(from)!.add(to);
        incoming.set(to, incoming.get(to)! + 1);
      }
    }
  const ready = [...remaining].filter((id) => incoming.get(id) === 0);
  const result: string[] = [];
  while (ready.length > 0) {
    const index =
      ready.length === 1
        ? 0
        : ready.findIndex((id) =>
            ready.every(
              (other) =>
                id === other ||
                (lp.has(id) &&
                  lp.has(other) &&
                  rp.has(id) &&
                  rp.has(other) &&
                  lp.get(id)! < lp.get(other)! &&
                  rp.get(id)! < rp.get(other)!),
            ),
          );
    if (index < 0) return null;
    const [id] = ready.splice(index, 1);
    result.push(id);
    for (const to of edges.get(id)!) {
      incoming.set(to, incoming.get(to)! - 1);
      if (incoming.get(to) === 0) ready.push(to);
    }
  }
  return result.length === remaining.size ? result : null;
}

export function reconcileContent(
  base: PublishedContentPayload,
  local: PublishedContentPayload,
  remote: PublishedContentPayload,
  decisions: ConflictDecisions = {},
): ComparisonResult<SemanticMerge> {
  return compareSafe([base, local, remote], () => {
    const conflicts: SemanticConflict[] = [];
    function conflict(b: ValueSlot, l: ValueSlot, r: ValueSlot, path: ContentPath): ValueSlot {
      // Identity includes all inputs, so a decision cannot be reused after an overlapping remote edit.
      const id = `${JSON.stringify(path)}:${fingerprint([b, l, r])}`;
      const decision = Object.hasOwn(decisions, id) ? decisions[id] : undefined;
      if (decision) return decision;
      conflicts.push({ id, path, base: b, local: l, remote: r });
      return l;
    }
    function merge(b: ValueSlot, l: ValueSlot, r: ValueSlot, path: ContentPath): ValueSlot {
      if (equal(l, b)) return r;
      if (equal(r, b) || equal(l, r)) return l;
      const bv = value(b),
        lv = value(l),
        rv = value(r);
      if (object(bv) && object(lv) && object(rv)) {
        const result: Record<string, JsonValue> = {};
        for (const key of new Set([...Object.keys(bv), ...Object.keys(lv), ...Object.keys(rv)])) {
          const next = merge(slot(bv[key] as JsonValue), slot(lv[key] as JsonValue), slot(rv[key] as JsonValue), [
            ...path,
            field(key),
          ]);
          if (next.present)
            Object.defineProperty(result, key, {
              value: next.value,
              enumerable: true,
              configurable: true,
              writable: true,
            });
        }
        return slot(result);
      }
      if (Array.isArray(bv) && Array.isArray(lv) && Array.isArray(rv) && keyed(path)) {
        const bm = mapById(bv),
          lm = mapById(lv),
          rm = mapById(rv),
          merged = new Map<string, JsonValue>();
        for (const id of new Set([...bm.keys(), ...lm.keys(), ...rm.keys()])) {
          const next = merge(slot(bm.get(id)), slot(lm.get(id)), slot(rm.get(id)), [...path, { kind: 'record', id }]);
          if (next.present) merged.set(id, next.value);
        }
        let order = combineOrder(idsOf(bv), idsOf(lv), idsOf(rv), new Set(merged.keys()));
        if (!order) {
          const orderPath: ContentPath = [...path, { kind: 'order' }];
          const b = slot(idsOf(bv)),
            l = slot(idsOf(lv)),
            r = slot(idsOf(rv));
          const chosen = conflict(b, l, r, orderPath);
          order = chosen.present && Array.isArray(chosen.value) ? (chosen.value as string[]) : [];
          const included = order.filter((id) => merged.has(id));
          if (new Set(included).size !== merged.size || new Set(included).size !== included.length) {
            const id = `${JSON.stringify(orderPath)}:${fingerprint([b, l, r])}`;
            if (!conflicts.some((entry) => entry.id === id))
              conflicts.push({ id, path: orderPath, base: b, local: l, remote: r });
          }
        }
        // Missing positions remain explicitly incomplete; this fallback is preview-only.
        return slot(
          [...new Set([...order, ...merged.keys()])].filter((id) => merged.has(id)).map((id) => merged.get(id)!),
        );
      }
      return conflict(b, l, r, path);
    }
    const candidate = value(
      merge(
        slot(base as unknown as JsonValue),
        slot(local as unknown as JsonValue),
        slot(remote as unknown as JsonValue),
        [],
      ),
    ) as unknown as PublishedContentPayload;
    return { kind: conflicts.length ? 'incomplete' : 'complete', candidate, conflicts };
  });
}
