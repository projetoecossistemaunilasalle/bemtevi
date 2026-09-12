/** Normalizes editor text for compact labels without changing the source value. */
export function compactFlowText(text: string) {
  return text.trim().replace(/\s+/g, ' ');
}

/** Ellipsizes normalized flow text and avoids whitespace immediately before the ellipsis. */
export function excerptFlowText(text: string, length = 72) {
  const normalized = compactFlowText(text);
  return normalized.length <= length ? normalized : `${normalized.slice(0, length - 1).trimEnd()}…`;
}

/** Preserves the destination map's historical fixed-width preview behavior. */
export function previewFlowText(text: string, length = 76) {
  const normalized = compactFlowText(text);
  return normalized.length > length ? `${normalized.slice(0, length - 1)}…` : normalized;
}
