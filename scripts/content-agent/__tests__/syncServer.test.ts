import type { AddressInfo } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getBundledContent } from '../../../src/app/content/bundledContent';
import { DraftStore } from '../draftStore';
import { createDraftSyncServer } from '../syncServer';

describe('API local de sincronização', () => {
  it('exige pareamento e origem permitida e aplica expectedGeneration', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'bemtevi-content-sync-test-'));
    const store = new DraftStore(directory);
    const payload = getBundledContent();
    try {
      const draft = await store.create({ baseRevision: 40, basePayload: payload, candidate: payload });
      const sync = createDraftSyncServer({
        store,
        port: 0,
        pairCode: '123456',
        allowedOrigins: ['http://localhost:3000'],
      });
      await new Promise<void>((resolve) => sync.server.listen(0, '127.0.0.1', resolve));
      const address = sync.server.address() as AddressInfo;
      const endpoint = `http://127.0.0.1:${address.port}`;
      try {
        const unauthorized = await fetch(`${endpoint}/v1/drafts/${draft.draftId}`);
        expect(unauthorized.status).toBe(401);
        const forbiddenOrigin = await fetch(`${endpoint}/v1/drafts/${draft.draftId}`, {
          headers: { Origin: 'https://evil.example' },
        });
        expect(forbiddenOrigin.status).toBe(403);
        const pair = await fetch(`${endpoint}/v1/pair`, {
          method: 'POST',
          headers: { Origin: 'http://localhost:3000', 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: '123456' }),
        });
        expect(pair.status).toBe(200);
        const { token } = (await pair.json()) as { token: string };
        const current = await fetch(`${endpoint}/v1/drafts/${draft.draftId}`, {
          headers: { Authorization: `Bearer ${token}`, Origin: 'http://localhost:3000' },
        });
        expect(current.status).toBe(200);
        const listed = await fetch(`${endpoint}/v1/drafts?limit=10`, {
          headers: { Authorization: `Bearer ${token}`, Origin: 'http://localhost:3000' },
        });
        expect(listed.status).toBe(200);
        expect((await listed.json()).drafts).toHaveLength(1);
        const diff = await fetch(`${endpoint}/v1/drafts/${draft.draftId}/diff?generation=1`, {
          headers: { Authorization: `Bearer ${token}`, Origin: 'http://localhost:3000' },
        });
        expect(diff.status).toBe(200);
        expect(await diff.json()).toMatchObject({ draftId: draft.draftId, generation: 1, changes: [] });
        const updated = await fetch(`${endpoint}/v1/drafts/${draft.draftId}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            Origin: 'http://localhost:3000',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ expectedGeneration: 1, candidate: payload }),
        });
        expect(updated.status).toBe(200);
        const stale = await fetch(`${endpoint}/v1/drafts/${draft.draftId}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            Origin: 'http://localhost:3000',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ expectedGeneration: 1, candidate: payload }),
        });
        expect(stale.status).toBe(409);
        expect((await stale.json()).error.code).toBe('stale_generation');
      } finally {
        await new Promise<void>((resolve, reject) => sync.server.close((error) => (error ? reject(error) : resolve())));
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
