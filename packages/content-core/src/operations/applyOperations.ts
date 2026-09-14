import { MAX_PUBLISHED_PAYLOAD_BYTES } from '../model/publishedContent';
import type { PublishedContentPayload } from '../model/publishedContent';
import type { EditorialOperation, Scope } from '../contracts/operations';
import { getPublishedPayloadSize } from '../validation/publishedContent';
import { EDITORIAL_SCOPES } from './allowlists';
import { fail, isFiniteSafeInt, isRecordInput, ok, type OpResult } from './jsonChecks';
import { parseEditorialOperation } from './parseOperations';
import {
  checkFlowAddNodes,
  checkFlowNodesPatch,
  checkMaterialAddBody,
  checkMaterialBodyReplacement,
} from './protectedImages';
import { applyMaterialImage, type MaterialRecord } from './materialImageSlots';

type ScopeCollection = Array<Record<string, unknown>>;

function scopeCollection(payload: Record<string, unknown>, scope: Scope): ScopeCollection | null {
  const collection = payload[scope];
  return Array.isArray(collection) ? (collection as ScopeCollection) : null;
}

function uniqueIndexes(collection: ScopeCollection, id: string): number[] {
  const found: number[] = [];
  collection.forEach((item, index) => {
    if (isRecordInput(item) && item.id === id) found.push(index);
  });
  return found;
}

function uniqueIndexOrError(
  collection: ScopeCollection,
  scope: Scope,
  id: string,
  op: string,
): { ok: true; index: number } | { ok: false; message: string } {
  const indexes = uniqueIndexes(collection, id);
  if (indexes.length === 0) return { ok: false, message: `${op}: o item "${id}" não existe em ${scope}.` };
  if (indexes.length > 1) return { ok: false, message: `${op}: o ID "${id}" está duplicado em ${scope}.` };
  return { ok: true, index: indexes[0] as number };
}

export function validateBasePayload(
  base: unknown,
): { ok: true; payload: Record<string, unknown> } | { ok: false; message: string } {
  if (!isRecordInput(base)) return { ok: false, message: 'a base deve ser um payload de conteúdo publicado.' };
  for (const scope of EDITORIAL_SCOPES) {
    if (!Array.isArray(base[scope])) return { ok: false, message: `a base deve ter a coleção "${scope}".` };
  }
  if (!isFiniteSafeInt(base.defaultGroupOrder)) {
    return { ok: false, message: 'a base deve ter um "defaultGroupOrder" numérico.' };
  }
  for (const scope of EDITORIAL_SCOPES) {
    for (const item of base[scope] as unknown[]) {
      if (!isRecordInput(item) || typeof item.id !== 'string') {
        return { ok: false, message: `a coleção "${scope}" deve conter objetos com "id".` };
      }
    }
  }
  return { ok: true, payload: base };
}

function applyOne(next: Record<string, unknown>, operation: EditorialOperation): string | null {
  if (operation.op === 'set_default_group_order') {
    next.defaultGroupOrder = operation.value;
    return null;
  }
  if (operation.op === 'set_material_image') {
    const materials = scopeCollection(next, 'educationMaterials') as ScopeCollection;
    const found = uniqueIndexOrError(materials, 'educationMaterials', operation.materialId, 'set_material_image');
    if (found.ok === false) return found.message;
    return applyMaterialImage(materials[found.index] as MaterialRecord, operation.slot, operation.image);
  }
  const collection = scopeCollection(next, operation.scope) as ScopeCollection;
  if (operation.op === 'add') {
    const value = operation.value as unknown as Record<string, unknown>;
    if (uniqueIndexes(collection, String(value.id)).length > 0) {
      return `add: o ID "${String(value.id)}" já existe em ${operation.scope}.`;
    }
    const issue = operation.scope === 'flows' ? checkFlowAddNodes(value.nodes) : checkMaterialAddBody(value.body);
    if (issue !== null) return issue;
    collection.push(value);
    return null;
  }
  if (operation.op === 'delete') {
    const found = uniqueIndexOrError(collection, operation.scope, operation.id, 'delete');
    if (found.ok === false) return found.message;
    collection.splice(found.index, 1);
    return null;
  }
  if (operation.op === 'update') {
    const found = uniqueIndexOrError(collection, operation.scope, operation.id, 'update');
    if (found.ok === false) return found.message;
    const item = collection[found.index] as Record<string, unknown>;
    const patch = operation.patch as unknown as Record<string, unknown>;
    if (operation.scope === 'educationMaterials' && 'body' in patch) {
      const issue = checkMaterialBodyReplacement(item.body, patch.body);
      if (issue !== null) return issue;
    }
    if (operation.scope === 'flows' && 'nodes' in patch) {
      const issue = checkFlowNodesPatch(item.nodes, patch.nodes);
      if (issue !== null) return issue;
    }
    for (const [key, value] of Object.entries(patch)) item[key] = value;
    for (const key of operation.unset) delete item[key];
    return null;
  }
  // reorder
  const currentIds = collection.map((item) => String((item as Record<string, unknown>).id));
  const sortedCurrent = [...currentIds].sort();
  const sortedNext = [...operation.ids].sort();
  if (sortedCurrent.length !== sortedNext.length || sortedCurrent.some((id, index) => id !== sortedNext[index])) {
    return `reorder: os "ids" devem ser uma permutação dos IDs atuais de ${operation.scope}.`;
  }
  const byId = new Map(collection.map((item) => [String((item as Record<string, unknown>).id), item]));
  const reordered = operation.ids.map((id) => byId.get(id) as Record<string, unknown>);
  collection.length = 0;
  collection.push(...reordered);
  return null;
}

/**
 * Applies validated editorial operations to a clone of the base payload,
 * sequentially, checking structure and final bounds. Never normalizes or
 * semantically repairs a payload.
 */
export function applyOperations(
  base: PublishedContentPayload,
  operations: EditorialOperation[],
): OpResult<PublishedContentPayload> {
  const baseCheck = validateBasePayload(base);
  if (baseCheck.ok === false) return fail('invalid_input', baseCheck.message);
  if (!Array.isArray(operations)) return fail('invalid_operations', 'as operações devem ser uma lista.');
  const next = JSON.parse(JSON.stringify(baseCheck.payload)) as Record<string, unknown>;
  for (const raw of operations) {
    const parsed = parseEditorialOperation(raw);
    if (parsed.ok === false) return parsed;
    const issue = applyOne(next, parsed.data);
    if (issue !== null)
      return fail(parsed.data.op === 'set_material_image' ? 'invalid_image' : 'invalid_operations', issue);
  }
  const size = getPublishedPayloadSize(next as unknown as PublishedContentPayload);
  if (size > MAX_PUBLISHED_PAYLOAD_BYTES) {
    return fail('payload_too_large', 'o payload resultante excede 5 MiB.');
  }
  return ok(next as unknown as PublishedContentPayload);
}
