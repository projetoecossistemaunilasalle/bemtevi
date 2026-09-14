/**
 * ZIP central-directory preflight and bounded-extraction limits (dossier docs
 * 05/14, task AI-FILE-01).
 *
 * The preflight reads ONLY the central directory of an archive (no inflation)
 * and rejects every unsupported feature before JSZip sees the bytes: ZIP too
 * large, too many entries, encryption, ZIP64, symlinks, duplicate normalized
 * names, backslashes, absolute paths and dot segments. Actual extraction is
 * bounded afterwards: per-entry declared size, per-entry 100:1 expansion ratio
 * and the 12 MiB total uncompressed cap are enforced while entries are
 * materialized one at a time (never an unbounded string).
 */

export const MAX_ARCHIVE_COMPRESSED_BYTES = 8 * 1024 * 1024;
export const MAX_ARCHIVE_UNCOMPRESSED_BYTES = 12 * 1024 * 1024;
export const MAX_ARCHIVE_ENTRIES = 64;
export const MAX_ENTRY_EXPANSION_RATIO = 100;

export type ZipPreflightCode =
  | 'not_zip'
  | 'too_large'
  | 'too_many_entries'
  | 'encrypted'
  | 'zip64'
  | 'symlink'
  | 'duplicate_path'
  | 'unsafe_path'
  | 'truncated';

export interface ZipPreflightError {
  code: ZipPreflightCode;
  message: string;
}

export interface ZipPreflightEntry {
  name: string;
  isDirectory: boolean;
  compressedSize: number;
  uncompressedSize: number;
  /** Declared expansion ratio (uncompressed/compressed), integral. */
  ratio: number;
}

export type ZipPreflightResult = { ok: true; entries: ZipPreflightEntry[] } | { ok: false; error: ZipPreflightError };

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const MAX_EOCD_SCAN = 22 + 0xffff; // fixed part + maximum comment length
const SYMLINK_MODE_HIGH = 0xa1; // S_IFLNK >> 8 in the Unix high 16 bits
const DOS_DIRECTORY_FLAG = 0x10;

function fail(code: ZipPreflightCode, message: string): ZipPreflightResult {
  return { ok: false, error: { code, message } };
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16) | (bytes[offset + 3]! << 24)) >>> 0;
}

function readUint16(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8);
}

function findEndOfCentralDirectory(bytes: Uint8Array): number {
  const start = Math.max(0, bytes.length - MAX_EOCD_SCAN);
  for (let i = bytes.length - 22; i >= start; i -= 1) {
    if (readUint32(bytes, i) === EOCD_SIGNATURE) return i;
  }
  return -1;
}

function hasUnsafePath(name: string): boolean {
  if (name.includes('\\')) return true;
  if (name.startsWith('/') || /^[a-zA-Z]:/.test(name)) return true;
  const segments = name.split('/');
  return segments.some((segment, index) => {
    if (segment === '.' || segment === '..') return true;
    return segment === '' && index !== segments.length - 1;
  });
}

function normalizeName(rawName: string): string {
  return rawName.endsWith('/') ? rawName.slice(0, -1) : rawName;
}

/**
 * Reads the central directory and enforces every archive-level bound. The
 * archive bytes themselves must already be at most 8 MiB compressed.
 */
export function preflightCentralDirectory(bytes: Uint8Array): ZipPreflightResult {
  if (bytes.byteLength > MAX_ARCHIVE_COMPRESSED_BYTES) {
    return fail('too_large', 'O arquivo ZIP excede o limite de 8 MiB comprimido.');
  }
  const eocd = findEndOfCentralDirectory(bytes);
  if (eocd < 0) return fail('not_zip', 'O arquivo não é um ZIP válido.');
  const totalEntries = readUint16(bytes, eocd + 10);
  const centralOffset = readUint32(bytes, eocd + 16);
  if (
    readUint16(bytes, eocd + 4) !== 0 ||
    readUint16(bytes, eocd + 6) !== 0 ||
    totalEntries !== readUint16(bytes, eocd + 8) ||
    centralOffset === 0xffffffff
  ) {
    return fail('zip64', 'Arquivos ZIP64 não são suportados.');
  }
  if (totalEntries > MAX_ARCHIVE_ENTRIES) {
    return fail('too_many_entries', `O ZIP excede o limite de ${MAX_ARCHIVE_ENTRIES} entradas.`);
  }
  const seen = new Set<string>();
  const entries: ZipPreflightEntry[] = [];
  let offset = centralOffset;
  for (let index = 0; index < totalEntries; index += 1) {
    if (offset + 46 > bytes.length || readUint32(bytes, offset) !== CENTRAL_SIGNATURE) {
      return fail('truncated', 'O diretório central do ZIP está truncado.');
    }
    const flags = readUint16(bytes, offset + 8);
    const externalAttrs = readUint32(bytes, offset + 38);
    const compressedSize = readUint32(bytes, offset + 20);
    const uncompressedSize = readUint32(bytes, offset + 24);
    const nameLength = readUint16(bytes, offset + 28);
    const extraLength = readUint16(bytes, offset + 30);
    const commentLength = readUint16(bytes, offset + 32);
    const nameStart = offset + 46;
    if (nameStart + nameLength > bytes.length) return fail('truncated', 'O diretório central do ZIP está truncado.');
    const rawName = new TextDecoder().decode(bytes.subarray(nameStart, nameStart + nameLength));
    if ((flags & 0x0001) !== 0 || (flags & 0x0040) !== 0 || (flags & 0x2000) !== 0) {
      return fail('encrypted', 'Arquivos ZIP protegidos por senha não são suportados.');
    }
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) {
      return fail('zip64', 'Arquivos ZIP64 não são suportados.');
    }
    const isDirectory = (externalAttrs & DOS_DIRECTORY_FLAG) !== 0 || rawName.endsWith('/');
    if (!isDirectory && (externalAttrs >>> 16) >>> 8 === SYMLINK_MODE_HIGH) {
      return fail('symlink', 'Links simbólicos não são suportados.');
    }
    if (hasUnsafePath(rawName)) {
      return fail('unsafe_path', `Caminho inseguro no ZIP: ${rawName}`);
    }
    const name = normalizeName(rawName);
    if (seen.has(name)) {
      return fail('duplicate_path', `Caminho duplicado no ZIP: ${name}`);
    }
    seen.add(name);
    const ratio = compressedSize === 0 ? 1 : Math.ceil(uncompressedSize / compressedSize);
    entries.push({ name, isDirectory, compressedSize, uncompressedSize, ratio });
    offset = nameStart + nameLength + extraLength + commentLength;
  }
  if (offset !== eocd) {
    const skipped = eocd - offset;
    if (skipped < 0 || skipped > 0xffff) return fail('truncated', 'O diretório central do ZIP está truncado.');
  }
  let totalUncompressed = 0;
  for (const entry of entries) {
    if (entry.isDirectory) continue;
    if (
      entry.compressedSize > MAX_ARCHIVE_COMPRESSED_BYTES ||
      entry.uncompressedSize > MAX_ARCHIVE_UNCOMPRESSED_BYTES
    ) {
      return fail('too_large', `Entrada do ZIP excede os limites de tamanho: ${entry.name}`);
    }
    if (entry.ratio > MAX_ENTRY_EXPANSION_RATIO) {
      return fail('too_large', `Entrada do ZIP excede a taxa de expansão de 100:1: ${entry.name}`);
    }
    totalUncompressed += entry.uncompressedSize;
    if (totalUncompressed > MAX_ARCHIVE_UNCOMPRESSED_BYTES) {
      return fail('too_large', 'O total descomprimido do ZIP excede 12 MiB.');
    }
  }
  return { ok: true, entries };
}

/**
 * Runtime bounds for one inflated entry. Called while materializing entries
 * one at a time so memory stays bounded even if declared sizes lie.
 */
export function checkInflatedEntry(entry: ZipPreflightEntry, actualBytes: number): ZipPreflightError | null {
  if (actualBytes !== entry.uncompressedSize) {
    return { code: 'too_large', message: `Tamanho real difere do declarado: ${entry.name}` };
  }
  const ratio = entry.compressedSize === 0 ? 1 : Math.ceil(actualBytes / Math.max(1, entry.compressedSize));
  if (ratio > MAX_ENTRY_EXPANSION_RATIO || actualBytes > MAX_ARCHIVE_UNCOMPRESSED_BYTES) {
    return { code: 'too_large', message: `Entrada do ZIP excede os limites de expansão: ${entry.name}` };
  }
  return null;
}
