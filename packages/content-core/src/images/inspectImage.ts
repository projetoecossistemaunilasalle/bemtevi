/**
 * Bounded container-header validation for uploaded images (PNG/JPEG/WebP).
 * This is header/container validation only — not antivirus and not a claim of
 * full codec validation. Truncated or overflowing lengths fail closed.
 */
export interface InspectedImage {
  width: number;
  height: number;
  mime: 'image/png' | 'image/jpeg' | 'image/webp';
}

export const MIN_IMAGE_DIMENSION = 1;
export const MAX_IMAGE_DIMENSION = 4096;
export const MAX_IMAGE_DIMENSION_PRODUCT = 16_000_000;

function failImage(message: string): { ok: false; message: string } {
  return { ok: false, message };
}

function readU32BE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

function readU32LE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset + 3] << 24) | (bytes[offset + 2] << 16) | (bytes[offset + 1] << 8) | bytes[offset]) >>> 0;
}

function readU16BE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

function checkDimensions(
  width: number,
  height: number,
  mime: InspectedImage['mime'],
): { ok: true; value: InspectedImage } | { ok: false; message: string } {
  if (
    width < MIN_IMAGE_DIMENSION ||
    height < MIN_IMAGE_DIMENSION ||
    width > MAX_IMAGE_DIMENSION ||
    height > MAX_IMAGE_DIMENSION
  ) {
    return failImage(`dimensões fora dos limites de ${MIN_IMAGE_DIMENSION} a ${MAX_IMAGE_DIMENSION}px.`);
  }
  if (width * height > MAX_IMAGE_DIMENSION_PRODUCT) {
    return failImage('produto de dimensões excede o limite de megapixels.');
  }
  return { ok: true, value: { width, height, mime } };
}

function inspectPng(bytes: Uint8Array): { ok: true; value: InspectedImage } | { ok: false; message: string } {
  if (!startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) || bytes.length < 33) {
    return failImage('assinatura PNG inválida ou arquivo truncado.');
  }
  if (readU32BE(bytes, 12) !== 0x49484452) {
    return failImage('primeiro chunk PNG não é IHDR.');
  }
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = readU32BE(bytes, offset);
    const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
    if (type === 'acTL') return failImage('PNG animado não é aceito.');
    if (type === 'IHDR') {
      const width = readU32BE(bytes, offset + 8);
      const height = readU32BE(bytes, offset + 12);
      return checkDimensions(width, height, 'image/png');
    }
    offset += 12 + length;
    if (offset > bytes.length) return failImage('chunk PNG truncado.');
  }
  return failImage('IHDR PNG não encontrado.');
}

function inspectJpeg(bytes: Uint8Array): { ok: true; value: InspectedImage } | { ok: false; message: string } {
  if (!startsWith(bytes, [0xff, 0xd8])) return failImage('assinatura JPEG inválida.');
  let offset = 2;
  let frame: { width: number; height: number } | null = null;
  while (offset + 2 <= bytes.length) {
    if (bytes[offset] !== 0xff) return failImage('marcador JPEG inválido.');
    const marker = bytes[offset + 1];
    if (marker === 0xd8) {
      offset += 2;
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    if (marker === 0xd9) {
      if (frame === null) return failImage('EOI antes de um frame JPEG (imagem truncada).');
      return checkDimensions(frame.width, frame.height, 'image/jpeg');
    }
    const length = readU16BE(bytes, offset + 2);
    if (length < 2 || offset + 2 + length > bytes.length) return failImage('segmento JPEG truncado.');
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      if (marker !== 0xc0 && marker !== 0xc1 && marker !== 0xc2) {
        return failImage('codificação JPEG não suportada (SOF).');
      }
      frame = { height: readU16BE(bytes, offset + 5), width: readU16BE(bytes, offset + 7) };
    }
    offset += 2 + length;
  }
  return failImage('EOI JPEG não encontrado (imagem truncada).');
}

function inspectWebp(bytes: Uint8Array): { ok: true; value: InspectedImage } | { ok: false; message: string } {
  if (
    !startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) ||
    !startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8) ||
    bytes.length < 27
  ) {
    return failImage('assinatura RIFF/WEBP inválida ou arquivo truncado.');
  }
  const riffSize = readU32LE(bytes, 4);
  if (8 + riffSize > bytes.length) return failImage('container RIFF truncado.');
  let offset = 12;
  while (offset + 8 <= Math.min(bytes.length, 8 + riffSize)) {
    const chunk = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
    const size = readU32LE(bytes, offset + 4);
    if (offset + 8 + size > 8 + riffSize) return failImage('chunk WebP truncado.');
    if (chunk === 'ANIM' || chunk === 'ANMF') return failImage('WebP animado não é aceito.');
    if (chunk === 'VP8X') {
      if ((bytes[offset + 8] & 0x02) !== 0) return failImage('WebP animado não é aceito.');
      const w = 1 + ((bytes[offset + 9] | (bytes[offset + 10] << 8) | (bytes[offset + 11] << 16)) & 0xffffff);
      const h = 1 + ((bytes[offset + 12] | (bytes[offset + 13] << 8) | (bytes[offset + 14] << 16)) & 0xffffff);
      return checkDimensions(w, h, 'image/webp');
    }
    if (chunk === 'VP8 ') {
      if (offset + 14 > bytes.length) return failImage('chunk VP8 truncado.');
      if (bytes[offset + 8] !== 0x9d || bytes[offset + 9] !== 0x01 || bytes[offset + 10] !== 0x2a) {
        return failImage('cabeçalho VP8 inválido.');
      }
      const width = (bytes[offset + 11] | ((bytes[offset + 12] & 0x3f) << 8)) & 0x3fff;
      const height = (bytes[offset + 13] | ((bytes[offset + 14] & 0x3f) << 8)) & 0x3fff;
      return checkDimensions(width, height, 'image/webp');
    }
    if (chunk === 'VP8L') {
      const bits =
        bytes[offset + 8] | (bytes[offset + 9] << 8) | (bytes[offset + 10] << 16) | (bytes[offset + 11] << 24);
      if ((bits & 0xff) !== 0x2f) return failImage('cabeçalho VP8L inválido.');
      const width = ((bits >> 8) & 0x3fff) + 1;
      const height = ((bits >> 22) & 0x3fff) + 1;
      return checkDimensions(width, height, 'image/webp');
    }
    offset += 8 + size + (size % 2);
  }
  return failImage('chunk de dimensões WebP (VP8/VP8L/VP8X) não encontrado.');
}

/** Parses bounded container headers and enforces the dimension bounds. */
export function inspectImage(
  bytes: Uint8Array,
  mime: InspectedImage['mime'],
): { ok: true; value: InspectedImage } | { ok: false; message: string } {
  if (mime === 'image/png') return inspectPng(bytes);
  if (mime === 'image/jpeg') return inspectJpeg(bytes);
  return inspectWebp(bytes);
}
