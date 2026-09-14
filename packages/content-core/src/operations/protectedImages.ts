import { PROTECTED_IMAGE_BLOCK_KEYS } from './allowlists';
import { isRecordInput, jsonEquals } from './jsonChecks';

/**
 * Protected image slot rules (dossier 14): generic operations never mutate
 * retained image slots. Only `set_material_image` may change them.
 */

function isImageBlock(block: unknown): boolean {
  return isRecordInput(block) && block.kind === 'image';
}

function hasProtectedImageField(block: Record<string, unknown>): boolean {
  return PROTECTED_IMAGE_BLOCK_KEYS.some((key) => key in block);
}

/** A generic material add must not introduce image data in any body image block. */
export function checkMaterialAddBody(body: unknown): string | null {
  if (!Array.isArray(body)) return null;
  for (const block of body) {
    if (isImageBlock(block) && hasProtectedImageField(block as Record<string, unknown>)) {
      return 'add (educationMaterials): um novo bloco de imagem não pode definir "imageUrl", "imageFileName" ou "alt".';
    }
  }
  return null;
}

/**
 * For every image-block ID present in both old and new body, the protected
 * fields must be JSON-equal to the old values. A newly introduced image-block
 * ID must omit them.
 */
export function checkMaterialBodyReplacement(oldBody: unknown, newBody: unknown): string | null {
  if (!Array.isArray(newBody)) return null;
  const oldBlocks = new Map<string, Record<string, unknown>>();
  if (Array.isArray(oldBody)) {
    for (const block of oldBody) {
      if (isRecordInput(block) && typeof block.id === 'string') oldBlocks.set(block.id, block);
    }
  }
  for (const block of newBody) {
    if (!isRecordInput(block) || block.kind !== 'image') continue;
    const previous = oldBlocks.get(block.id as string);
    if (previous && previous.kind === 'image') {
      for (const key of PROTECTED_IMAGE_BLOCK_KEYS) {
        if (!jsonEquals(previous[key], block[key])) {
          return `update (educationMaterials): o bloco de imagem retido "${block.id}" alterou "${key}". Use set_material_image.`;
        }
      }
    } else if (hasProtectedImageField(block)) {
      return `update (educationMaterials): o novo bloco de imagem "${block.id}" não pode definir "imageUrl", "imageFileName" ou "alt".`;
    }
  }
  return null;
}

/** A generic flow add must not contain any `visuals` entry. */
export function checkFlowAddNodes(nodes: unknown): string | null {
  if (!isRecordInput(nodes)) return null;
  for (const node of Object.values(nodes)) {
    if (isRecordInput(node) && 'visuals' in node) {
      return 'add (flows): fluxos não podem introduzir "visuals" por operação genérica.';
    }
  }
  return null;
}

/** A generic flow `nodes` patch must preserve the complete visuals arrays of every retained node. */
export function checkFlowNodesPatch(oldNodes: unknown, newNodes: unknown): string | null {
  if (!isRecordInput(newNodes) || !isRecordInput(oldNodes)) return null;
  for (const [nodeId, newNode] of Object.entries(newNodes)) {
    const oldNode = oldNodes[nodeId];
    const oldVisuals = isRecordInput(oldNode) ? (oldNode as Record<string, unknown>).visuals : undefined;
    const newVisuals = isRecordInput(newNode) ? (newNode as Record<string, unknown>).visuals : undefined;
    if (!jsonEquals(oldVisuals ?? null, newVisuals ?? null)) {
      return `update (flows): os "visuals" do nó retido "${nodeId}" não podem ser adicionados, removidos, reordenados ou editados.`;
    }
  }
  return null;
}
