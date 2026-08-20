import type { PublishedContentPayload } from '../../app/content/publishedContent';
import { normalizeForComparison } from '../content/normalize';

const MISSING = Symbol('missing');
type Missing = typeof MISSING;
type MergeValue = unknown | Missing;

export interface PublishedContentMergeConflict {
  path: string;
  base: unknown;
  local: unknown;
  remote: unknown;
}

export interface PublishedContentMergeResult {
  payload: PublishedContentPayload | null;
  conflicts: PublishedContentMergeConflict[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(value: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function cloneValue(value: MergeValue): MergeValue {
  if (value === MISSING) return value;
  if (Array.isArray(value)) return value.map((entry) => cloneValue(entry));
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cloneValue(entry)]));
  }
  return value;
}

function cloneConflictValue(value: MergeValue) {
  return value === MISSING ? undefined : cloneValue(value);
}

function valuesEqual(left: MergeValue, right: MergeValue) {
  if (left === MISSING || right === MISSING) return left === right;
  return normalizeForComparison(left) === normalizeForComparison(right);
}

function pathForKey(path: string, key: string) {
  return path ? `${path}.${key}` : key;
}

function pathForRecord(path: string, id: string) {
  return `${path}[${id}]`;
}

function isKeyedRecordArray(value: MergeValue): value is Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return false;

  const ids = value.map((entry) => (isRecord(entry) && typeof entry.id === 'string' ? entry.id : null));
  return ids.every((id) => id !== null) && new Set(ids).size === ids.length;
}

function arraysEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

function recordMap(records: Array<Record<string, unknown>>) {
  return new Map(records.map((record) => [record.id as string, record]));
}

function mergeObjectValues(
  base: Record<string, unknown>,
  local: Record<string, unknown>,
  remote: Record<string, unknown>,
  path: string,
  conflicts: PublishedContentMergeConflict[],
): Record<string, unknown> {
  const keys = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)]);
  const merged: Record<string, unknown> = {};

  keys.forEach((key) => {
    const value = mergeValues(
      hasOwn(base, key) ? base[key] : MISSING,
      hasOwn(local, key) ? local[key] : MISSING,
      hasOwn(remote, key) ? remote[key] : MISSING,
      pathForKey(path, key),
      conflicts,
    );
    if (value !== MISSING) merged[key] = value;
  });

  return merged;
}

function mergeKeyedArrays(
  base: Array<Record<string, unknown>>,
  local: Array<Record<string, unknown>>,
  remote: Array<Record<string, unknown>>,
  path: string,
  conflicts: PublishedContentMergeConflict[],
): Array<Record<string, unknown>> {
  const baseById = recordMap(base);
  const localById = recordMap(local);
  const remoteById = recordMap(remote);
  const ids = new Set([...baseById.keys(), ...localById.keys(), ...remoteById.keys()]);
  const mergedById = new Map<string, Record<string, unknown>>();

  ids.forEach((id) => {
    const merged = mergeValues(
      baseById.get(id) ?? MISSING,
      localById.get(id) ?? MISSING,
      remoteById.get(id) ?? MISSING,
      pathForRecord(path, id),
      conflicts,
    );
    if (merged !== MISSING && isRecord(merged)) mergedById.set(id, merged);
  });

  const baseIds = base.map((record) => record.id as string);
  const localIds = local.map((record) => record.id as string);
  const remoteIds = remote.map((record) => record.id as string);
  const baseIdSet = new Set(baseIds);
  const localBaseIds = localIds.filter((id) => baseIdSet.has(id));
  const remoteBaseIds = remoteIds.filter((id) => baseIdSet.has(id));
  const baseIdsInLocal = baseIds.filter((id) => localById.has(id));
  const baseIdsInRemote = baseIds.filter((id) => remoteById.has(id));
  const localOrderChanged = !arraysEqual(localBaseIds, baseIdsInLocal);
  const remoteOrderChanged = !arraysEqual(remoteBaseIds, baseIdsInRemote);

  if (localOrderChanged && remoteOrderChanged && !arraysEqual(localBaseIds, remoteBaseIds)) {
    conflicts.push({
      path: `${path}.__order`,
      base: baseIds,
      local: localIds,
      remote: remoteIds,
    });
  }

  const preferredOrder =
    remoteOrderChanged && !localOrderChanged
      ? remoteIds
      : localOrderChanged && !remoteOrderChanged
        ? localIds
        : remoteIds;
  const fallbackOrder = preferredOrder === remoteIds ? localIds : remoteIds;
  const resultIds = [...preferredOrder, ...fallbackOrder, ...baseIds].filter(
    (id, index, all) => mergedById.has(id) && all.indexOf(id) === index,
  );

  return resultIds.flatMap((id) => {
    const record = mergedById.get(id);
    return record ? [record] : [];
  });
}

function mergeValues(
  base: MergeValue,
  local: MergeValue,
  remote: MergeValue,
  path: string,
  conflicts: PublishedContentMergeConflict[],
): MergeValue {
  if (valuesEqual(local, base)) return cloneValue(remote);
  if (valuesEqual(remote, base)) return cloneValue(local);
  if (valuesEqual(local, remote)) return cloneValue(local);

  if (isRecord(base) && isRecord(local) && isRecord(remote)) {
    return mergeObjectValues(base, local, remote, path, conflicts);
  }

  if (isKeyedRecordArray(base) && isKeyedRecordArray(local) && isKeyedRecordArray(remote)) {
    return mergeKeyedArrays(base, local, remote, path, conflicts);
  }

  conflicts.push({
    path,
    base: cloneConflictValue(base),
    local: cloneConflictValue(local),
    remote: cloneConflictValue(remote),
  });
  return cloneValue(remote);
}

export function mergePublishedContent(
  base: PublishedContentPayload,
  local: PublishedContentPayload,
  remote: PublishedContentPayload,
): PublishedContentMergeResult {
  const conflicts: PublishedContentMergeConflict[] = [];
  const merged = mergeValues(base, local, remote, '', conflicts);

  return {
    payload: conflicts.length === 0 && isRecord(merged) ? (merged as unknown as PublishedContentPayload) : null,
    conflicts,
  };
}
