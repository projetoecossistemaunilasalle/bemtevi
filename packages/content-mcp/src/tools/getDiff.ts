/**
 * get_diff (doc 04). With offset 0, fetches ONE verified publication snapshot
 * and pins its revision and comparison to the cached draft entry; further
 * pages reuse that comparison and never compare against a different live
 * revision mid-pagination. A missing first page/comparison is a safe
 * `rebase_required`. A new offset-0 request explicitly replaces the pinned
 * comparison. Previews are stable JSON strings with data URLs omitted,
 * truncated to 200 characters.
 */

import { compareContent } from '@bemtevi/content-core';
import type { ValueSlot } from '@bemtevi/content-core';
import { verifiedBaseOrRebase, fetchVerifiedPublication, type ToolRuntime } from './rpc';
import {
  EMBEDDED_IMAGE_PLACEHOLDER,
  fitsOutputBudget,
  isPositiveSafeInteger,
  paginate,
  scrubDataUrls,
  toolFail,
  toolOk,
  truncateText,
} from './shared';
import type { ToolOutcome } from './shared';
import { readLimit, readOffset } from './listItems';
import type { ToolHandlerArgs, ToolResult } from '../server/dispatch';

const PREVIEW_MAX_CHARS = 200;

function previewOf(slot: ValueSlot): string {
  if (!slot.present) return 'null';
  const text = JSON.stringify(scrubDataUrls(slot.value)) ?? EMBEDDED_IMAGE_PLACEHOLDER;
  return truncateText(text, PREVIEW_MAX_CHARS);
}

export function createGetDiffHandler(rt: ToolRuntime) {
  return async (args: ToolHandlerArgs): Promise<ToolResult> => {
    const result = await getDiff(rt, args);
    if (result.ok && !fitsOutputBudget(result)) {
      return toolFail('response_too_large', 'A resposta desta chamada é grande demais para ser representada.');
    }
    return result;
  };
}

async function getDiff(rt: ToolRuntime, args: ToolHandlerArgs): Promise<ToolOutcome<Record<string, unknown>>> {
  const generation = args['generation'];
  if (!isPositiveSafeInteger(generation)) return toolFail('invalid_input');
  const offset = readOffset(args['offset']);
  if (offset === null) return toolFail('invalid_input');
  const limit = readLimit(args['limit']);
  if (limit === null) return toolFail('invalid_input');
  const base = verifiedBaseOrRebase(rt, generation);
  if (base.ok === false) return base;

  if (offset === 0) {
    const snapshot = await fetchVerifiedPublication(rt);
    if (snapshot.ok === false) return snapshot;
    const comparison = compareContent(base.data.payload, snapshot.data.payload);
    if (comparison.ok === false) {
      return toolFail('unavailable', 'A comparação com a publicação falhou.');
    }
    rt.cache.pinComparison(rt.connectionId, base.data.generation, {
      publishedRevision: snapshot.data.revision,
      changes: comparison.value,
    });
  }
  const pinned = rt.cache.comparison(rt.connectionId, base.data.generation);
  if (pinned === null) {
    return toolFail('rebase_required', 'A comparação não está fixada. Chame get_diff com offset 0.');
  }
  const page = paginate(pinned.changes, offset, limit);
  return toolOk({
    generation: base.data.generation,
    publishedRevision: pinned.publishedRevision,
    changes: page.items.map((change) => ({
      id: change.id,
      path: change.path,
      kind: change.kind,
      beforePreview: previewOf(change.before),
      afterPreview: previewOf(change.after),
    })),
    nextOffset: page.nextOffset,
  });
}
