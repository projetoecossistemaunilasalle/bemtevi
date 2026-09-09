import type { PublishedContentPayload } from '../../app/content/publishedContent';
import { reconcileContent } from './semanticDiff';

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

// Compatibility adapter. New callers use the discriminated result and typed paths.
export function mergePublishedContent(
  base: PublishedContentPayload,
  local: PublishedContentPayload,
  remote: PublishedContentPayload,
): PublishedContentMergeResult {
  const result = reconcileContent(base, local, remote);
  if (!result.ok)
    return { payload: null, conflicts: [{ path: '', base: undefined, local: undefined, remote: undefined }] };
  return {
    payload: result.value.kind === 'complete' ? result.value.candidate : null,
    conflicts: result.value.conflicts.map((conflict) => ({
      path: conflict.path.reduce(
        (path, part) =>
          part.kind === 'record'
            ? `${path}[${part.id}]`
            : part.kind === 'order'
              ? `${path}.__order`
              : path
                ? `${path}.${part.key}`
                : part.key,
        '',
      ),
      base: conflict.base.present ? conflict.base.value : undefined,
      local: conflict.local.present ? conflict.local.value : undefined,
      remote: conflict.remote.present ? conflict.remote.value : undefined,
    })),
  };
}
