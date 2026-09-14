import { describe, expect, it } from 'vitest';
import {
  EDITORIAL_SCOPES,
  ADD_ALLOWED_KEYS,
  UPDATE_UNSET_ALLOWED_KEYS,
  conformanceBasePayload,
  encodeOperations,
  fixtureAddValues,
  fixtureImageActionOperations,
  fixtureNoopOperations,
  fixtureSemanticInvalidOperations,
  fixtureStaleGenerationEnvelope,
  fixtureUnsetOperations,
  applyOperations,
  parseOperationsEnvelope,
  serializeConformanceFixtures,
  buildFixtureEnvelope,
  FIXTURE_BASE_DIGEST,
  FIXTURE_BASE_GENERATION,
  FIXTURE_EXPORT_ID,
  type EditorialOperation,
} from '@bemtevi/content-core';

const base = () => JSON.parse(JSON.stringify(conformanceBasePayload)) as typeof conformanceBasePayload;

describe('fixture determinism', () => {
  it('serializes byte-stable across calls and roundtrips', () => {
    const first = serializeConformanceFixtures();
    const second = serializeConformanceFixtures();
    expect(first).toBe(second);
    expect(JSON.parse(first)).toEqual({
      schemaVersion: '2.0.0',
      basePayload: conformanceBasePayload,
      exportId: FIXTURE_EXPORT_ID,
      baseGeneration: FIXTURE_BASE_GENERATION,
      baseDigest: FIXTURE_BASE_DIGEST,
      addValues: fixtureAddValues,
      unsetOperations: fixtureUnsetOperations,
      imageActionOperations: fixtureImageActionOperations,
      noopOperations: fixtureNoopOperations,
      semanticInvalidOperations: fixtureSemanticInvalidOperations,
      staleGenerationEnvelope: fixtureStaleGenerationEnvelope,
      maxOperationsPerBatch: 200,
    });
  });

  it('builds a valid V2 envelope against the fixture generation', () => {
    const envelope = buildFixtureEnvelope([{ op: 'set_default_group_order', value: 2 }]);
    expect(envelope.schemaVersion).toBe('2.0.0');
    expect(envelope.baseDigest).toBe(FIXTURE_BASE_DIGEST);
    const parsed = parseOperationsEnvelope(envelope);
    expect(parsed.ok).toBe(true);
  });

  it('exposes the stale-generation envelope one generation ahead', () => {
    expect(fixtureStaleGenerationEnvelope.baseGeneration).toBe(FIXTURE_BASE_GENERATION + 1);
  });
});

describe('fixture coverage', () => {
  it('base payload contains every editable and every unsettable field', () => {
    const flow = conformanceBasePayload.flows[0];
    expect(flow.purpose).toBeDefined();
    expect(flow.nodeOrder).toBeDefined();
    const material = conformanceBasePayload.educationMaterials[0];
    for (const key of [
      'body',
      'embed',
      'href',
      'group',
      'groupOrder',
      'title',
      'source',
      'description',
      'tags',
      'audience',
      'review',
    ]) {
      expect(material, `material.${key}`).toHaveProperty(key);
    }
    expect(material.featuredImage).toBeDefined();
    expect(material.imageUrl).toBeDefined();
    expect(conformanceBasePayload.educationGroups[0].description).toBeDefined();
    const contact = conformanceBasePayload.contacts[0];
    for (const key of [
      'locationId',
      'hours',
      'notes',
      'lat',
      'lng',
      'name',
      'type',
      'badgeTone',
      'city',
      'state',
      'address',
      'phoneDisplay',
      'phoneHref',
      'review',
    ]) {
      expect(contact, `contact.${key}`).toHaveProperty(key);
    }
    expect(conformanceBasePayload.locations[0]).toEqual({ id: 'local-um', city: 'Curitiba', state: 'PR' });
  });

  it('add fixtures cover the complete literal allowlist per scope', () => {
    for (const scope of EDITORIAL_SCOPES) {
      expect(Object.keys(fixtureAddValues[scope]).sort()).toEqual([...ADD_ALLOWED_KEYS[scope]].sort());
    }
  });

  it('unset fixtures cover the complete unset allowlist per scope (locations: none)', () => {
    for (const scope of EDITORIAL_SCOPES) {
      const operations = fixtureUnsetOperations[scope] as Array<{ unset: string[] }> | [];
      const covered = operations.flatMap((operation) => operation.unset);
      expect(new Set(covered)).toEqual(new Set(UPDATE_UNSET_ALLOWED_KEYS[scope]));
    }
  });

  it('image action fixtures cover every action on every slot kind', () => {
    const names = fixtureImageActionOperations.map((fixture) => fixture.name);
    expect(names).toEqual([
      'featured-uploaded',
      'featured-catalog',
      'featured-external',
      'featured-remove',
      'legacy-uploaded',
      'legacy-external',
      'legacy-remove',
      'body-uploaded',
      'body-external',
      'body-remove',
    ]);
  });
});

describe('fixture behavior', () => {
  it('applies every add fixture and produces the covered payload', () => {
    const operations: EditorialOperation[] = EDITORIAL_SCOPES.map(
      (scope) => ({ op: 'add', scope, value: fixtureAddValues[scope] }) as EditorialOperation,
    );
    const result = applyOperations(base(), operations);
    expect(result.ok).toBe(true);
    if (result.ok) {
      for (const scope of EDITORIAL_SCOPES) {
        const added = (result.data[scope] as Array<{ id: string }>).find(
          (item) => item.id === (fixtureAddValues[scope] as { id: string }).id,
        );
        expect(added, scope).toBeDefined();
      }
    }
  });

  it('applies every unset fixture removing exactly the allowed fields', () => {
    const payload = base();
    const operations = EDITORIAL_SCOPES.flatMap((scope) => fixtureUnsetOperations[scope]);
    const result = applyOperations(payload, operations);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.flows[0].purpose).toBeUndefined();
      expect(result.data.flows[0].nodeOrder).toBeUndefined();
      const material = result.data.educationMaterials[0];
      for (const key of ['body', 'embed', 'href', 'group', 'groupOrder']) {
        expect(material, `material.${key} unset`).not.toHaveProperty(key);
      }
      expect(result.data.educationGroups[0].description).toBeUndefined();
      const contact = result.data.contacts[0];
      for (const key of ['locationId', 'hours', 'notes', 'lat', 'lng']) {
        expect(contact, `contact.${key} unset`).not.toHaveProperty(key);
      }
      expect(material.title).toBe('Material de exemplo');
      expect(material.featuredImage).toEqual({ kind: 'catalog', imageId: 'classroom-1' });
    }
  });

  it('treats the noop fixture as a byte-equal no-op', () => {
    const result = applyOperations(base(), fixtureNoopOperations);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual(base());
    const encoded = encodeOperations(base(), base());
    expect(encoded.ok).toBe(true);
    if (encoded.ok) expect(encoded.data).toEqual([]);
  });

  it('parses the stale envelope but callers compare generations before apply', () => {
    const parsed = parseOperationsEnvelope(fixtureStaleGenerationEnvelope);
    expect(parsed.ok).toBe(true);
    expect(parsed.ok && parsed.data.baseGeneration).toBe(FIXTURE_BASE_GENERATION + 1);
  });

  it('rejects every representative semantic-invalid state', () => {
    for (const fixture of fixtureSemanticInvalidOperations) {
      const parsed = parseOperationsEnvelope({
        schemaVersion: '2.0.0',
        exportId: FIXTURE_EXPORT_ID,
        baseGeneration: FIXTURE_BASE_GENERATION,
        baseDigest: FIXTURE_BASE_DIGEST,
        operations: [fixture.operation],
        selfCheck: {
          reviewed: true,
          noOutOfScopeChanges: true,
          noUnrequestedDeletes: true,
          noUnsupportedImagePaths: true,
          notes: [],
        },
      });
      if (parsed.ok) {
        const result = applyOperations(base(), parsed.data.operations);
        expect(result.ok, `${fixture.name} deve ser rejeitado no apply`).toBe(false);
      }
    }
  });
});
