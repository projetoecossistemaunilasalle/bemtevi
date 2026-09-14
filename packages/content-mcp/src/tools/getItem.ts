/**
 * get_item (doc 04). Reads a draft item or one top-level item field as paged
 * JSON text at a verified cached generation. Every embedded image data URL is
 * replaced before serialization (`[embedded image omitted]`); catalog IDs and
 * external URLs are preserved. `limit` counts UTF-16 code units (default 8000,
 * maximum 16000); concatenate pages before parsing.
 */

import { verifiedBaseOrRebase, type ToolRuntime } from './rpc';
import {
  fitsOutputBudget,
  isPositiveSafeInteger,
  isScope,
  pageText,
  scopeCollection,
  scrubDataUrls,
  toolFail,
  toolOk,
} from './shared';
import type { ToolOutcome } from './shared';
import { readLimit, readOffset } from './listItems';
import type { ToolHandlerArgs, ToolResult } from '../server/dispatch';

const MAX_ITEM_LIMIT = 16000;
const DEFAULT_ITEM_LIMIT = 8000;

export function createGetItemHandler(rt: ToolRuntime) {
  return async (args: ToolHandlerArgs): Promise<ToolResult> => {
    const result = await getItem(rt, args);
    if (result.ok && !fitsOutputBudget(result)) {
      return toolFail('response_too_large', 'A resposta desta chamada é grande demais para ser representada.');
    }
    return result;
  };
}

async function getItem(rt: ToolRuntime, args: ToolHandlerArgs): Promise<ToolOutcome<Record<string, unknown>>> {
  const generation = args['generation'];
  const scope = args['scope'];
  const id = args['id'];
  const field = args['field'];
  if (!isPositiveSafeInteger(generation)) return toolFail('invalid_input');
  if (typeof scope !== 'string' || !isScope(scope)) {
    return toolFail('invalid_input');
  }
  if (typeof id !== 'string' || id.length === 0) return toolFail('invalid_input');
  const base = verifiedBaseOrRebase(rt, generation);
  if (base.ok === false) return base;
  const items = scopeCollection(base.data.payload, scope);
  const item = items.find((entry) => entry.id === id);
  if (!item) return toolFail('invalid_input', `O item "${id}" não existe em ${scope}.`);
  if (field !== undefined && (typeof field !== 'string' || field.length === 0 || !(field in item))) {
    return toolFail('invalid_input', `O campo "${String(field)}" não existe no item "${id}".`);
  }
  const offset = readOffset(args['offset']);
  if (offset === null) return toolFail('invalid_input');
  const limit = readLimit(args['limit'], MAX_ITEM_LIMIT, DEFAULT_ITEM_LIMIT);
  if (limit === null) return toolFail('invalid_input');
  const target = typeof field === 'string' ? item[field] : item;
  const text = JSON.stringify(scrubDataUrls(target)) ?? '';
  const page = pageText(text, offset, limit);
  return toolOk({
    generation: base.data.generation,
    id,
    field: typeof field === 'string' ? field : null,
    jsonText: page.jsonText,
    nextOffset: page.nextOffset,
    totalCharacters: text.length,
  });
}
