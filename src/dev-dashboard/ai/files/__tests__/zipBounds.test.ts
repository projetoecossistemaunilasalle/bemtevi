import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import {
  MAX_ARCHIVE_ENTRIES,
  checkInflatedEntry,
  preflightCentralDirectory,
  type ZipPreflightEntry,
} from '../zipBounds';

function u16(value: number): [number, number] {
  return [value & 0xff, (value >>> 8) & 0xff];
}

function u32(value: number): [number, number, number, number] {
  return [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff];
}

interface TestEntry {
  name: string;
  flags?: number;
  externalAttrs?: number;
  compressedSize?: number;
  uncompressedSize?: number;
}

function centralDirectoryEntry(entry: TestEntry): number[] {
  const nameBytes = [...new TextEncoder().encode(entry.name)];
  return [
    ...u32(0x02014b50), // signature
    ...u16(0x031e), // version made by (unix)
    ...u16(20), // version needed
    ...u16(entry.flags ?? 0),
    ...u16(0), // method (store)
    ...u16(0),
    ...u16(0), // time/date
    ...u32(0), // crc
    ...u32(entry.compressedSize ?? 10),
    ...u32(entry.uncompressedSize ?? 1000),
    ...u16(nameBytes.length),
    ...u16(0), // extra
    ...u16(0), // comment
    ...u16(0), // disk
    ...u16(0), // internal attrs
    ...u32(entry.externalAttrs ?? 0),
    ...u32(0), // local header offset
    ...nameBytes,
  ];
}

function endOfCentralDirectory(count: number, offset: number): number[] {
  return [
    ...u32(0x06054b50),
    ...u16(0),
    ...u16(0),
    ...u16(count),
    ...u16(count),
    ...u32(0x10),
    ...u32(offset),
    ...u16(0),
  ];
}

function buildCentralDirectory(entries: TestEntry[], declaredCount?: number): Uint8Array {
  const records = entries.map(centralDirectoryEntry);
  const centralOffset = 0; // synthetic archive: the central directory starts at byte 0
  const bytes: number[] = [];
  for (const record of records) bytes.push(...record);
  bytes.push(...endOfCentralDirectory(declaredCount ?? entries.length, centralOffset));
  return new Uint8Array(bytes);
}

function firstError(result: ReturnType<typeof preflightCentralDirectory>): string {
  if (result.ok === false) return result.error.code;
  return 'ok';
}

describe('zipBounds central-directory preflight', () => {
  it('accepts a well-formed directory listing', () => {
    const bytes = buildCentralDirectory([
      { name: 'operations.json' },
      { name: 'manifest.json' },
      { name: 'images/abc.png' },
    ]);
    const result = preflightCentralDirectory(bytes);
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.entries.map((e) => e.name)).toEqual(['operations.json', 'manifest.json', 'images/abc.png']);
  });

  it('ignores the optional images/ directory entry (counts toward entries)', () => {
    const bytes = buildCentralDirectory([{ name: 'images/', externalAttrs: 0x10 }, { name: 'operations.json' }]);
    const result = preflightCentralDirectory(bytes);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.entries.filter((e) => e.isDirectory).map((e) => e.name)).toEqual(['images']);
    }
  });

  it('rejects non-zip bytes and truncated directories', () => {
    expect(firstError(preflightCentralDirectory(new TextEncoder().encode('not a zip')))).toBe('not_zip');
    // Directory declares three entries but only two records are present.
    const truncated = buildCentralDirectory([{ name: 'a.json' }, { name: 'b.json' }], 3);
    expect(firstError(preflightCentralDirectory(truncated))).toBe('truncated');
  });

  it('rejects too many entries', () => {
    const entries = Array.from({ length: MAX_ARCHIVE_ENTRIES + 1 }, (_, i) => ({ name: `f${i}.json` }));
    expect(firstError(preflightCentralDirectory(buildCentralDirectory(entries)))).toBe('too_many_entries');
  });

  it('rejects encrypted entries', () => {
    const bytes = buildCentralDirectory([{ name: 'operations.json', flags: 0x0001 }]);
    expect(firstError(preflightCentralDirectory(bytes))).toBe('encrypted');
  });

  it('rejects ZIP64 markers', () => {
    const bytes = buildCentralDirectory([
      { name: 'operations.json', compressedSize: 0xffffffff, uncompressedSize: 0xffffffff },
    ]);
    expect(firstError(preflightCentralDirectory(bytes))).toBe('zip64');
  });

  it('rejects symlinks', () => {
    const bytes = buildCentralDirectory([{ name: 'operations.json', externalAttrs: 0xa1ff0000 }]);
    expect(firstError(preflightCentralDirectory(bytes))).toBe('symlink');
  });

  it('rejects duplicate normalized names', () => {
    const bytes = buildCentralDirectory([{ name: 'images/a.png' }, { name: 'images/a.png' }]);
    expect(firstError(preflightCentralDirectory(bytes))).toBe('duplicate_path');
  });

  it('rejects backslashes, absolute paths and dot segments', () => {
    expect(firstError(preflightCentralDirectory(buildCentralDirectory([{ name: 'images\\a.png' }])))).toBe(
      'unsafe_path',
    );
    expect(firstError(preflightCentralDirectory(buildCentralDirectory([{ name: '/operations.json' }])))).toBe(
      'unsafe_path',
    );
    expect(firstError(preflightCentralDirectory(buildCentralDirectory([{ name: 'images/../operations.json' }])))).toBe(
      'unsafe_path',
    );
  });

  it('rejects per-entry size and ratio bound violations', () => {
    const oversize = buildCentralDirectory([
      { name: 'big.bin', compressedSize: 1000, uncompressedSize: 13 * 1024 * 1024 },
    ]);
    expect(firstError(preflightCentralDirectory(oversize))).toBe('too_large');
    const bomb = buildCentralDirectory([{ name: 'bomb.bin', compressedSize: 10, uncompressedSize: 1001 * 100 }]);
    expect(firstError(preflightCentralDirectory(bomb))).toBe('too_large');
  });
});

describe('checkInflatedEntry runtime bounds', () => {
  const entry: ZipPreflightEntry = {
    name: 'operations.json',
    isDirectory: false,
    compressedSize: 100,
    uncompressedSize: 1000,
    ratio: 10,
  };

  it('accepts matching sizes', () => {
    expect(checkInflatedEntry(entry, 1000)).toBeNull();
  });

  it('rejects declared/actual size mismatch and ratio violations', () => {
    expect(checkInflatedEntry(entry, 1001)?.code).toBe('too_large');
    expect(checkInflatedEntry({ ...entry, compressedSize: 5, uncompressedSize: 600 }, 600)?.code).toBe('too_large');
  });
});

describe('zipBounds with real JSZip archives', () => {
  it('accepts a real generated archive', async () => {
    const zip = new JSZip();
    zip.file('operations.json', '{}');
    const bytes = await zip.generateAsync({ type: 'uint8array' });
    const result = preflightCentralDirectory(bytes);
    expect(result.ok).toBe(true);
  });

  it('rejects a real archive truncated mid-directory', async () => {
    const zip = new JSZip();
    zip.file('operations.json', '{"x":1}');
    const bytes = await zip.generateAsync({ type: 'uint8array' });
    expect(firstError(preflightCentralDirectory(bytes.slice(0, bytes.length - 30)))).not.toBe('ok');
  });
});
