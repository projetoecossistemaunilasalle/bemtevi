import { MAX_PUBLISHED_PAYLOAD_BYTES } from '../model/publishedContent';
import type { PublishedContentPayload } from '../model/publishedContent';
import type { EditorialOperation, ImageSlot, ImageValue, Scope } from '../contracts/operations';
import { getPublishedPayloadSize } from '../validation/publishedContent';
import {
  ADD_ALLOWED_KEYS,
  MAX_OPERATIONS_ENVELOPE_BYTES,
  MAX_OPERATIONS_PER_BATCH,
  UPDATE_PATCH_ALLOWED_KEYS,
  UPDATE_UNSET_ALLOWED_KEYS,
} from './allowlists';
import { fail, isRecordInput, jsonEquals, ok, utf8ByteLength, type OpResult } from './jsonChecks';
import { uploadedFromDataUrl } from './materialImageSlots';
import { checkFlowAddNodes, checkMaterialAddBody } from './protectedImages';
import { validateBasePayload } from './applyOperations';

const SCOPE_ORDER: readonly Scope[] = ['flows', 'educationMaterials', 'educationGroups', 'contacts', 'locations'];

function byId(payload: Record<string, unknown>, scope: Scope): Map<string, Record<string, unknown>> {
  const collection = Array.isArray(payload[scope]) ? (payload[scope] as unknown[]) : [];
  return new Map(
    collection
      .filter((item): item is Record<string, unknown> => isRecordInput(item) && typeof item.id === 'string')
      .map((item) => [item.id as string, item]),
  );
}

function featuredToImageValue(featured: unknown): ImageValue | null {
  if (!isRecordInput(featured)) return null;
  if (featured.kind === 'catalog' && typeof featured.imageId === 'string') {
    return { kind: 'catalog', imageId: featured.imageId };
  }
  if (featured.kind === 'external' && typeof featured.imageUrl === 'string') {
    return { kind: 'external', url: featured.imageUrl, alt: typeof featured.alt === 'string' ? featured.alt : '' };
  }
  if (featured.kind === 'uploaded' && typeof featured.dataUrl === 'string') {
    return uploadedFromDataUrl(
      featured.dataUrl,
      typeof featured.fileName === 'string' ? featured.fileName : '',
      typeof featured.alt === 'string' ? featured.alt : '',
    );
  }
  return null;
}

function legacyToImageValue(imageUrl: unknown, imageFileName: unknown): ImageValue | null {
  if (typeof imageUrl !== 'string' || imageUrl.length === 0) return { kind: 'remove' };
  if (imageUrl.startsWith('data:')) {
    return uploadedFromDataUrl(imageUrl, typeof imageFileName === 'string' ? imageFileName : '', '');
  }
  return { kind: 'external', url: imageUrl, alt: '' };
}

function resolveBodyBlockImage(block: Record<string, unknown>): ImageValue | null {
  const url = block.imageUrl;
  if (typeof url !== 'string' || url.length === 0) return { kind: 'remove' };
  if (url.startsWith('data:')) {
    return uploadedFromDataUrl(
      url,
      typeof block.imageFileName === 'string' ? block.imageFileName : '',
      typeof block.alt === 'string' ? block.alt : '',
    );
  }
  return { kind: 'external', url, alt: typeof block.alt === 'string' ? block.alt : '' };
}

function encodeAddValue(scope: Scope, item: Record<string, unknown>): OpResult<EditorialOperation> {
  const allowed = ADD_ALLOWED_KEYS[scope];
  const value: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in item) value[key] = item[key];
  }
  if (scope === 'educationMaterials') {
    const issue = checkMaterialAddBody(value.body);
    if (issue !== null) return fail('invalid_operations', issue);
  }
  if (scope === 'flows') {
    const issue = checkFlowAddNodes(value.nodes);
    if (issue !== null) return fail('invalid_operations', issue);
  }
  return ok({ op: 'add', scope, value: value as { [key: string]: never } });
}

function encodeImageOperation(materialId: string, slot: ImageSlot, image: ImageValue): EditorialOperation {
  return { op: 'set_material_image', materialId, slot, image };
}

function encodeMaterialImageOps(
  materialId: string,
  base: Record<string, unknown>,
  candidate: Record<string, unknown>,
): OpResult<EditorialOperation[]> {
  const operations: EditorialOperation[] = [];
  if (!jsonEquals(base.featuredImage, candidate.featuredImage)) {
    const image =
      'featuredImage' in candidate ? featuredToImageValue(candidate.featuredImage) : { kind: 'remove' as const };
    if (image === null)
      return fail('invalid_operations', `material "${materialId}": alteração de destaque não representável.`);
    operations.push(encodeImageOperation(materialId, { kind: 'featured' }, image));
  }
  const legacyChanged =
    !jsonEquals(base.imageUrl ?? null, candidate.imageUrl ?? null) ||
    !jsonEquals(base.imageFileName ?? null, candidate.imageFileName ?? null);
  if (legacyChanged) {
    const image = legacyToImageValue(candidate.imageUrl, candidate.imageFileName);
    if (image === null)
      return fail('invalid_operations', `material "${materialId}": alteração de imagem legada não representável.`);
    operations.push(encodeImageOperation(materialId, { kind: 'legacy' }, image));
  }
  const baseBlocks = new Map<string, Record<string, unknown>>();
  if (Array.isArray(base.body)) {
    for (const block of base.body) {
      if (isRecordInput(block) && typeof block.id === 'string') baseBlocks.set(block.id, block);
    }
  }
  if (Array.isArray(candidate.body)) {
    for (const block of candidate.body) {
      if (!isRecordInput(block) || block.kind !== 'image' || typeof block.id !== 'string') continue;
      const previous = baseBlocks.get(block.id);
      if (previous && previous.kind === 'image') {
        const unchanged = ['imageUrl', 'imageFileName', 'alt'].every((key) =>
          jsonEquals((previous as Record<string, unknown>)[key], (block as Record<string, unknown>)[key]),
        );
        if (unchanged) continue;
      }
      const image = resolveBodyBlockImage(block);
      if (image === null) {
        return fail('invalid_operations', `material "${materialId}": imagem do bloco "${block.id}" não representável.`);
      }
      operations.push(encodeImageOperation(materialId, { kind: 'body', blockId: block.id }, image));
    }
  }
  return ok(operations);
}

/** Encodes the operations that transform `base` into `candidate`; unchanged candidates produce an empty list. */
export function encodeOperations(
  base: PublishedContentPayload,
  candidate: PublishedContentPayload,
): OpResult<EditorialOperation[]> {
  const baseCheck = validateBasePayload(base);
  if (baseCheck.ok === false) return fail('invalid_input', baseCheck.message);
  const candidateCheck = validateBasePayload(candidate);
  if (candidateCheck.ok === false) return fail('invalid_input', candidateCheck.message);
  const basePayload = baseCheck.payload;
  const candidatePayload = candidateCheck.payload;
  const operations: EditorialOperation[] = [];

  for (const scope of SCOPE_ORDER) {
    const baseItems = byId(basePayload, scope);
    const candidateItems = byId(candidatePayload, scope);
    // Deletes
    for (const [id] of baseItems) {
      if (!candidateItems.has(id)) operations.push({ op: 'delete', scope, id, confirmation: true });
    }
    // Adds
    for (const [id, item] of candidateItems) {
      if (baseItems.has(id)) continue;
      const add = encodeAddValue(scope, item);
      if (add.ok === false) return fail(add.error.code, add.error.message);
      operations.push(add.data);
    }
    // Non-image field changes
    for (const [id, candidateItem] of candidateItems) {
      const baseItem = baseItems.get(id);
      if (!baseItem) continue;
      const patch: Record<string, unknown> = {};
      const unset: string[] = [];
      for (const key of UPDATE_PATCH_ALLOWED_KEYS[scope]) {
        const nextValue = candidateItem[key];
        if (nextValue === undefined) continue;
        if (!(key in baseItem) || !jsonEquals(baseItem[key], nextValue)) patch[key] = nextValue;
      }
      for (const key of UPDATE_UNSET_ALLOWED_KEYS[scope]) {
        if (key in baseItem && baseItem[key] !== undefined && candidateItem[key] === undefined) unset.push(key);
      }
      if (Object.keys(patch).length > 0 || unset.length > 0) {
        operations.push({ op: 'update', scope, id, patch: patch as { [key: string]: never }, unset });
      }
      if (scope === 'educationMaterials') {
        const imageOps = encodeMaterialImageOps(id, baseItem, candidateItem);
        if (imageOps.ok === false) return imageOps;
        operations.push(...imageOps.data);
      }
      if (scope === 'flows' && 'nodes' in baseItem && 'nodes' in candidateItem) {
        if (retainedVisualsChanged(baseItem.nodes, candidateItem.nodes)) {
          return fail(
            'invalid_operations',
            `fluxo "${id}": alteração de "visuals" não é representável em operações V2.`,
          );
        }
      }
    }
  }

  // Reorders
  for (const scope of SCOPE_ORDER) {
    const baseIds = (Array.isArray(basePayload[scope]) ? (basePayload[scope] as unknown[]) : [])
      .filter((item): item is Record<string, unknown> => isRecordInput(item) && typeof item.id === 'string')
      .map((item) => item.id as string);
    const candidateIds = (Array.isArray(candidatePayload[scope]) ? (candidatePayload[scope] as unknown[]) : [])
      .filter((item): item is Record<string, unknown> => isRecordInput(item) && typeof item.id === 'string')
      .map((item) => item.id as string);
    if (!jsonEquals(baseIds, candidateIds)) operations.push({ op: 'reorder', scope, ids: candidateIds });
  }

  // Scalar change
  if (!jsonEquals(basePayload.defaultGroupOrder, candidatePayload.defaultGroupOrder)) {
    operations.push({ op: 'set_default_group_order', value: candidatePayload.defaultGroupOrder as number });
  }

  if (getPublishedPayloadSize(candidate) > MAX_PUBLISHED_PAYLOAD_BYTES) {
    return fail('payload_too_large', 'o payload candidato excede 5 MiB.');
  }
  if (operations.length > MAX_OPERATIONS_PER_BATCH) {
    return fail('invalid_operations', `a diferença excede ${MAX_OPERATIONS_PER_BATCH} operações.`);
  }
  if (utf8ByteLength(JSON.stringify(operations)) > MAX_OPERATIONS_ENVELOPE_BYTES) {
    return fail('invalid_operations', 'a diferença excede 8 MiB de operações.');
  }
  return ok(operations);
}

function retainedVisualsChanged(oldNodes: unknown, newNodes: unknown): boolean {
  if (!isRecordInput(oldNodes) || !isRecordInput(newNodes)) return false;
  for (const [nodeId, newNode] of Object.entries(newNodes)) {
    const oldNode = oldNodes[nodeId];
    if (!isRecordInput(oldNode) || !isRecordInput(newNode)) continue;
    if (!jsonEquals(oldNode.visuals ?? null, newNode.visuals ?? null)) return true;
  }
  return false;
}
