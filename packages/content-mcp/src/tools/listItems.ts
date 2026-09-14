/**
 * list_items (doc 04). Lists draft item IDs and labels of one scope collection
 * at a verified cached generation, up to 100 per page. Labels are title, then
 * name, then id, truncated to 160 characters; IDs stay exact.
 */

import { verifiedBaseOrRebase, type ToolRuntime } from './rpc';
import {
  fitsOutputBudget,
  isPositiveSafeInteger,
  isScope,
  itemLabel,
  paginate,
  scopeCollection,
  toolFail,
  toolOk,
} from './shared';
import type { ToolOutcome } from './shared';
import type { ToolHandlerArgs, ToolResult } from '../server/dispatch';

const MAX_LIST_LIMIT = 100;
const DEFAULT_LIST_LIMIT = 50;

export function createListItemsHandler(rt: ToolRuntime) {
  return async (args: ToolHandlerArgs): Promise<ToolResult> => {
    const result = await listItems(rt, args);
    if (result.ok && !fitsOutputBudget(result)) {
      return toolFail('response_too_large', 'A resposta desta chamada é grande demais para ser representada.');
    }
    return result;
  };
}

async function listItems(rt: ToolRuntime, args: ToolHandlerArgs): Promise<ToolOutcome<Record<string, unknown>>> {
  const generation = args['generation'];
  const scope = args['scope'];
  if (!isPositiveSafeInteger(generation)) return toolFail('invalid_input');
  if (typeof scope !== 'string' || !isScope(scope)) {
    return toolFail('invalid_input');
  }
  const base = verifiedBaseOrRebase(rt, generation);
  if (base.ok === false) return base;
  const offset = readOffset(args['offset']);
  if (offset === null) return toolFail('invalid_input');
  const limit = readLimit(args['limit']);
  if (limit === null) return toolFail('invalid_input');
  const items = scopeCollection(base.data.payload, scope);
  const page = paginate(items, offset, limit);
  return toolOk({
    generation: base.data.generation,
    items: page.items.map((item) => ({ id: item.id, label: itemLabel(item) })),
    nextOffset: page.nextOffset,
  });
}

export function readOffset(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : value === undefined
      ? 0
      : null;
}

export function readLimit(
  value: unknown,
  max: number = MAX_LIST_LIMIT,
  standard: number = DEFAULT_LIST_LIMIT,
): number | null {
  if (value === undefined) return standard;
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1 && value <= max ? value : null;
}
