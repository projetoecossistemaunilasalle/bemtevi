/**
 * find_references (doc 04). Recursively compares every string value exactly
 * (===) to the requested id at a verified cached generation, EXCLUDING keys
 * named `id` and image data fields (data URLs / image value fields).
 * Traversal is deterministic: the five-scope enum order, payload order within
 * a scope, then JSON key order per item; paths are JSON-pointer style.
 * Results are advisory only and never authorize deletion.
 */

import { EDITORIAL_SCOPES, isImageDataUrl, type Scope } from '@bemtevi/content-core';
import { verifiedBaseOrRebase, type ToolRuntime } from './rpc';
import { fitsOutputBudget, isPositiveSafeInteger, paginate, scopeCollection, toolFail, toolOk } from './shared';
import type { ToolOutcome } from './shared';
import { readLimit, readOffset } from './listItems';
import type { ToolHandlerArgs, ToolResult } from '../server/dispatch';
const EXCLUDED_KEYS = new Set(['id', 'featuredImage', 'imageUrl', 'imageFileName', 'dataUrl']);

interface Reference {
  scope: Scope;
  id: string;
  path: string;
}

function escapePointerToken(token: string): string {
  return token.split('~').join('~0').split('/').join('~1');
}

export function createFindReferencesHandler(rt: ToolRuntime) {
  return async (args: ToolHandlerArgs): Promise<ToolResult> => {
    const result = await findReferences(rt, args);
    if (result.ok && !fitsOutputBudget(result)) {
      return toolFail('response_too_large', 'A resposta desta chamada é grande demais para ser representada.');
    }
    return result;
  };
}

async function findReferences(rt: ToolRuntime, args: ToolHandlerArgs): Promise<ToolOutcome<Record<string, unknown>>> {
  const generation = args['generation'];
  const id = args['id'];
  if (!isPositiveSafeInteger(generation)) return toolFail('invalid_input');
  if (typeof id !== 'string' || id.length === 0) return toolFail('invalid_input');
  const base = verifiedBaseOrRebase(rt, generation);
  if (base.ok === false) return base;
  const offset = readOffset(args['offset']);
  if (offset === null) return toolFail('invalid_input');
  const limit = readLimit(args['limit']);
  if (limit === null) return toolFail('invalid_input');

  const references: Reference[] = [];
  for (const scope of EDITORIAL_SCOPES) {
    const items = scopeCollection(base.data.payload, scope);
    items.forEach((item, index) => {
      const itemId = typeof item.id === 'string' ? item.id : '';
      const root = `/${scope}/${index}`;
      walk(item, id, itemId, scope, root, references);
    });
  }
  const page = paginate(references, offset, limit);
  return toolOk({
    generation: base.data.generation,
    references: page.items.map((reference) => ({ scope: reference.scope, id: reference.id, path: reference.path })),
    nextOffset: page.nextOffset,
  });
}

function walk(value: unknown, id: string, itemId: string, scope: Scope, pointer: string, out: Reference[]): void {
  if (typeof value === 'string') {
    if (value === id && !isImageDataUrl(value)) out.push({ scope, id: itemId, path: pointer });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => walk(entry, id, itemId, scope, `${pointer}/${index}`, out));
    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      if (EXCLUDED_KEYS.has(key)) continue;
      walk(entry, id, itemId, scope, `${pointer}/${escapePointerToken(key)}`, out);
    }
  }
}
