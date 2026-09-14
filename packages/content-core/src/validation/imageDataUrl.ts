const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml', 'image/avif'];

const dataUrlPattern = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/;

/**
 * Pure (DOM-free) equivalent of the browser upload helper's `isImageDataUrl`:
 * same data-URL grammar, same accepted MIME list, and the same forgiving-base64
 * length rule (a remainder of 1 is invalid; 0/2/3 are accepted).
 */
export function isImageDataUrl(value: string | undefined): boolean {
  if (!value) return false;

  const normalizedValue = value.trim().replace(/\s/g, '');
  const match = normalizedValue.match(dataUrlPattern);
  if (!match) return false;

  const mimeType = match[1] ?? '';
  if (!ACCEPTED_IMAGE_TYPES.includes(mimeType)) return false;

  const base64 = match[2] ?? '';
  return base64.length % 4 !== 1;
}
