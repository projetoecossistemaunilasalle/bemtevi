import type { PublishedContentPayload } from '../../app/content/publishedContent';

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type ValueSlot = { present: false } | { present: true; value: JsonValue };
export type PathSegment = { kind: 'field'; key: string } | { kind: 'record'; id: string } | { kind: 'order' };
export type ContentPath = PathSegment[];
export interface SemanticChange {
  id: string;
  path: ContentPath;
  kind: 'added' | 'removed' | 'edited' | 'moved';
  before: ValueSlot;
  after: ValueSlot;
  recordLabel?: string;
}
export interface SemanticConflict {
  id: string;
  path: ContentPath;
  base: ValueSlot;
  local: ValueSlot;
  remote: ValueSlot;
}
export type ConflictDecisions = Record<string, ValueSlot>;
export type ComparisonResult<T> = { ok: true; value: T } | { ok: false; code: 'invalid_input' | 'comparison_failed' };
export type SemanticMerge =
  | { kind: 'complete'; candidate: PublishedContentPayload; conflicts: SemanticConflict[] }
  | { kind: 'incomplete'; candidate: PublishedContentPayload; conflicts: SemanticConflict[] };

const absent: ValueSlot = { present: false };
const collections = new Set([
  'flows',
  'educationMaterials',
  'educationGroups',
  'contacts',
  'locations',
  'options',
  'body',
]);
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const slot = (v: JsonValue | undefined): ValueSlot => (v === undefined ? absent : { present: true, value: v });
const field = (key: string): PathSegment => ({ kind: 'field', key });
const value = (s: ValueSlot) => (s.present ? s.value : undefined);

// Unlike the legacy normalizer, array order and null are significant.
export function contentIdentity(input: unknown): string {
  if (input === undefined) return 'missing';
  if (Array.isArray(input)) return `[${input.map(contentIdentity).join(',')}]`;
  if (object(input))
    return `{${Object.keys(input)
      .filter((key) => input[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${contentIdentity(input[key])}`)
      .join(',')}}`;
  return JSON.stringify(input);
}
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
const equal = (a: ValueSlot, b: ValueSlot) =>
  a.present === b.present && contentIdentity(value(a)) === contentIdentity(value(b));
const keyed = (path: ContentPath) => {
  const last = path.at(-1);
  return last?.kind === 'field' && collections.has(last.key);
};

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
const mapById = (entries: JsonValue[]) => new Map(entries.map((entry) => [(entry as { id: string }).id, entry]));
const idsOf = (entries: JsonValue[]) => entries.map((entry) => (entry as { id: string }).id);

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
  return safe([base, local, remote], () => {
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

const labels: Record<string, string> = {
  flows: 'Fluxos',
  educationMaterials: 'Materiais',
  educationGroups: 'Grupos',
  contacts: 'Contatos',
  locations: 'Locais',
  nodes: 'Etapas',
  options: 'Escolhas',
  body: 'Conteúdo',
  title: 'Título',
  name: 'Nome',
  text: 'Texto',
  description: 'Descrição',
  next: 'Destino',
  defaultGroupOrder: 'Ordem padrão dos grupos',
  effects: 'Efeitos',
  nodeOrder: 'Ordem das etapas',
};
export function describePath(path: ContentPath): string {
  return path
    .map((part) =>
      part.kind === 'record' ? part.id : part.kind === 'order' ? 'Ordem dos itens' : (labels[part.key] ?? part.key),
    )
    .join(' / ');
}
