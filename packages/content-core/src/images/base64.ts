/**
 * Strict padded standard base64: canonical decode with a re-encode match.
 * Returns null for whitespace, unpadded, URL-safe or non-canonical input.
 */
const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function decodeStrictBase64(value: string): Uint8Array | null {
  if (value.length === 0 || value.length % 4 !== 0) return null;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return null;
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  const bodyLength = value.length - padding;
  // Padding must only occupy the final quantum and never exceed 2 characters.
  for (let index = bodyLength; index < value.length; index += 1) {
    if (value[index] !== '=') return null;
  }
  const bytes = new Uint8Array(Math.floor((value.length / 4) * 3) - padding);
  let buffer = 0;
  let bits = 0;
  let cursor = 0;
  for (let index = 0; index < bodyLength; index += 1) {
    const sextet = BASE64_ALPHABET.indexOf(value[index] as string);
    if (sextet < 0) return null;
    buffer = (buffer << 6) | sextet;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[cursor] = (buffer >> bits) & 0xff;
      cursor += 1;
    }
  }
  // Non-canonical trailing bits must be zero.
  if (bits > 0 && (buffer & ((1 << bits) - 1)) !== 0) return null;
  return reencodeMatches(value, bytes) ? bytes : null;
}

function reencodeMatches(value: string, bytes: Uint8Array): boolean {
  let output = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const chunk = (bytes[index] << 16) | ((bytes[index + 1] ?? 0) << 8) | (bytes[index + 2] ?? 0);
    output += BASE64_ALPHABET[(chunk >> 18) & 63];
    output += BASE64_ALPHABET[(chunk >> 12) & 63];
    output += index + 1 < bytes.length ? BASE64_ALPHABET[(chunk >> 6) & 63] : '=';
    output += index + 2 < bytes.length ? BASE64_ALPHABET[chunk & 63] : '=';
  }
  return output === value;
}

/** Extracts mime and base64 payload from a strict `data:<mime>;base64,<payload>` URL. */
export function parseImageDataUrl(dataUrl: string): { mime: string; base64: string } | null {
  const match = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match) return null;
  return { mime: match[1] as string, base64: match[2] as string };
}
