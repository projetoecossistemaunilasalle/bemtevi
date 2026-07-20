// Minimal STORE-only ZIP writer — no external dependencies.
// Creates valid ZIP files with uncompressed entries.

function makeCrc32Table(): number[] {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n >>> 0;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? (0xedb88320 ^ (c >>> 1)) >>> 0 : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
}

const crc32Table = makeCrc32Table();

function crc32(bytes: Uint8Array): number {
  let c = ~0 >>> 0;
  for (let i = 0; i < bytes.length; i++) {
    c = (crc32Table[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)) >>> 0;
  }
  return ~c >>> 0;
}

function writeUInt32LE(buffer: Uint8Array, offset: number, value: number): void {
  buffer[offset] = value & 0xff;
  buffer[offset + 1] = (value >>> 8) & 0xff;
  buffer[offset + 2] = (value >>> 16) & 0xff;
  buffer[offset + 3] = (value >>> 24) & 0xff;
}

function writeUInt16LE(buffer: Uint8Array, offset: number, value: number): void {
  buffer[offset] = value & 0xff;
  buffer[offset + 1] = (value >>> 8) & 0xff;
}

export interface ZipFile {
  name: string;
  data: Uint8Array;
}

export function createZip(files: ZipFile[]): Uint8Array {
  let offset = 0;
  const centralDirectory: Uint8Array[] = [];
  const localHeaders: Uint8Array[] = [];
  const fileData: Uint8Array[] = [];

  for (const file of files) {
    const nameBytes = new TextEncoder().encode(file.name);
    const checksum = crc32(file.data);
    const size = file.data.length;

    // Local file header (30 bytes + name)
    const header = new Uint8Array(30 + nameBytes.length);
    writeUInt32LE(header, 0, 0x04034b50); // signature
    writeUInt16LE(header, 4, 20); // version needed
    writeUInt16LE(header, 6, 0); // general flags
    writeUInt16LE(header, 8, 0); // compression method (STORE)
    writeUInt16LE(header, 10, 0); // last mod time
    writeUInt16LE(header, 12, 0); // last mod date
    writeUInt32LE(header, 14, checksum); // CRC-32
    writeUInt32LE(header, 18, size); // compressed size
    writeUInt32LE(header, 22, size); // uncompressed size
    writeUInt16LE(header, 26, nameBytes.length); // name length
    writeUInt16LE(header, 28, 0); // extra field length
    header.set(nameBytes, 30);

    localHeaders.push(header);
    fileData.push(file.data);

    // Central directory header (46 bytes + name)
    const cdHeader = new Uint8Array(46 + nameBytes.length);
    writeUInt32LE(cdHeader, 0, 0x02014b50); // signature
    writeUInt16LE(cdHeader, 4, 20); // version made by
    writeUInt16LE(cdHeader, 6, 20); // version needed
    writeUInt16LE(cdHeader, 8, 0); // flags
    writeUInt16LE(cdHeader, 10, 0); // compression method
    writeUInt16LE(cdHeader, 12, 0); // mod time
    writeUInt16LE(cdHeader, 14, 0); // mod date
    writeUInt32LE(cdHeader, 16, checksum); // CRC-32
    writeUInt32LE(cdHeader, 20, size); // compressed size
    writeUInt32LE(cdHeader, 24, size); // uncompressed size
    writeUInt16LE(cdHeader, 28, nameBytes.length); // name length
    writeUInt16LE(cdHeader, 30, 0); // extra length
    writeUInt16LE(cdHeader, 32, 0); // comment length
    writeUInt16LE(cdHeader, 34, 0); // disk number start
    writeUInt16LE(cdHeader, 36, 0); // internal file attributes
    writeUInt32LE(cdHeader, 38, 0); // external file attributes
    writeUInt32LE(cdHeader, 42, offset); // relative offset of local header
    cdHeader.set(nameBytes, 46);

    centralDirectory.push(cdHeader);
    offset += header.length + file.data.length;
  }

  const centralDirOffset = offset;
  const centralDirSize = centralDirectory.reduce((sum, h) => sum + h.length, 0);

  // End of central directory record (22 bytes)
  const eocd = new Uint8Array(22);
  writeUInt32LE(eocd, 0, 0x06054b50); // signature
  writeUInt16LE(eocd, 4, 0); // disk number
  writeUInt16LE(eocd, 6, 0); // disk with central directory
  writeUInt16LE(eocd, 8, files.length); // entries on this disk
  writeUInt16LE(eocd, 10, files.length); // total entries
  writeUInt32LE(eocd, 12, centralDirSize); // central directory size
  writeUInt32LE(eocd, 16, centralDirOffset); // central directory offset
  writeUInt16LE(eocd, 20, 0); // comment length

  const totalSize =
    localHeaders.reduce((sum, h, i) => sum + h.length + fileData[i].length, 0) + centralDirSize + eocd.length;
  const result = new Uint8Array(totalSize);
  let pos = 0;

  for (let i = 0; i < localHeaders.length; i++) {
    result.set(localHeaders[i], pos);
    pos += localHeaders[i].length;
    result.set(fileData[i], pos);
    pos += fileData[i].length;
  }

  for (const cd of centralDirectory) {
    result.set(cd, pos);
    pos += cd.length;
  }

  result.set(eocd, pos);
  return result;
}
