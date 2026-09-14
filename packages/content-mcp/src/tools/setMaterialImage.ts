/**
 * set_material_image (doc 04/14). Sets or removes ONE material image through
 * the frozen bytes/catalog/external/remove contract. The material must exist in
 * the verified cached base (missing -> invalid_input, no RPC call); the slot
 * and image unions are validated by content-core (parseEditorialOperation /
 * applyMaterialImage) before and inside the shared mutation pipeline. No local
 * path or URL fetching ever happens — uploads carry their bytes, catalog IDs
 * resolve from the bundled list, external URLs are stored but never fetched.
 */

import { parseEditorialOperation } from '@bemtevi/content-core';
import { toToolError, runMutation } from './mutation';
import { isPositiveSafeInteger, isRecord, scopeCollection, toolFail, toolOk } from './shared';
import type { ToolOutcome } from './shared';
import { verifiedBaseOrRebase, type ToolRuntime } from './rpc';
import type { ToolHandlerArgs, ToolResult } from '../server/dispatch';

function isItemId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && [...value].length <= 200;
}

function imageEnvelope(value: unknown, label: string): ToolOutcome<Record<string, unknown>> {
  if (!isRecord(value)) return toolFail('invalid_input', `${label} deve ser um objeto.`);
  return toolOk(value);
}

export function createSetMaterialImageHandler(rt: ToolRuntime) {
  return async (args: ToolHandlerArgs): Promise<ToolResult> => {
    const expectedGeneration = args['expectedGeneration'];
    const materialId = args['materialId'];
    if (!isPositiveSafeInteger(expectedGeneration)) return toolFail('invalid_input');
    if (!isItemId(materialId)) return toolFail('invalid_input', 'materialId é obrigatório (até 200 caracteres).');
    const slot = imageEnvelope(args['slot'], 'slot');
    if (slot.ok === false) return slot;
    const image = imageEnvelope(args['image'], 'image');
    if (image.ok === false) return image;
    const base = verifiedBaseOrRebase(rt, expectedGeneration);
    if (base.ok === false) return base;
    const exists = scopeCollection(base.data.payload, 'educationMaterials').some((item) => item.id === materialId);
    if (!exists) {
      return toolFail('invalid_input', `O material "${materialId}" não existe na base em cache.`);
    }
    const parsed = parseEditorialOperation({
      op: 'set_material_image',
      materialId,
      slot: slot.data,
      image: image.data,
    });
    if (parsed.ok === false) return { ok: false, error: toToolError(parsed.error) };
    return runMutation(rt, expectedGeneration, [parsed.data]);
  };
}
