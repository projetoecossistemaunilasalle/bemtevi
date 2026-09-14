// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { sameContent, sha256Text, verifySnapshot } from '../digest';
import type { PublishedContentPayload } from '../index';

function smallPayload(): PublishedContentPayload {
  return {
    flows: [],
    educationMaterials: [],
    educationGroups: [],
    contacts: [],
    locations: [],
    defaultGroupOrder: 1,
  };
}

describe('sha256Text', () => {
  it('produces the lowercase SHA-256 hex of the UTF-8 text', async () => {
    // sha256("") known vector
    expect(await sha256Text('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    // sha256("abc") known vector
    expect(await sha256Text('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    // UTF-8 multibyte
    expect(await sha256Text('ação')).toHaveLength(64);
    expect(await sha256Text('ação')).toBe(await sha256Text('ação'));
  });

  it('is sensitive to whitespace and key order, like the database digest', async () => {
    const a = '{"a":1,"b":2}';
    const b = '{"a": 1, "b": 2}';
    expect(await sha256Text(a)).not.toBe(await sha256Text(b));
  });
});

describe('sameContent', () => {
  it('is key-order-insensitive but array-order-sensitive', () => {
    expect(sameContent({ a: 1, b: [1, 2] }, { b: [1, 2], a: 1 })).toBe(true);
    expect(sameContent({ b: [2, 1], a: 1 }, { a: 1, b: [1, 2] })).toBe(false);
    expect(sameContent({ a: null }, { a: undefined })).toBe(false);
  });
});

describe('verifySnapshot', () => {
  it('accepts a consistent payload/canonical/digest triple', async () => {
    const payload = smallPayload();
    const canonical = JSON.stringify(payload);
    const digest = await sha256Text(canonical);
    await expect(verifySnapshot(payload, canonical, digest)).resolves.toBe(true);
  });

  it('rejects a digest that does not match the canonical text', async () => {
    const payload = smallPayload();
    const canonical = JSON.stringify(payload);
    await expect(verifySnapshot(payload, canonical, '0'.repeat(64))).resolves.toBe(false);
  });

  it('rejects canonical text that is not semantically equal to the payload', async () => {
    const payload = smallPayload();
    const other = { ...payload, defaultGroupOrder: 2 };
    const digest = await sha256Text(JSON.stringify(other));
    await expect(verifySnapshot(payload, JSON.stringify(other), digest)).resolves.toBe(false);
  });

  it('rejects non-JSON canonical text', async () => {
    const payload = smallPayload();
    await expect(verifySnapshot(payload, 'não é json', '0'.repeat(64))).resolves.toBe(false);
  });
});
