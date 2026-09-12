import { beforeEach, describe, expect, it } from 'vitest';
import { getBundledContent } from '../../../app/content/bundledContent';
import { createDraftState, firstShippedMaterial, shippedMaterialSourceIndex } from './educationScreensTestUtils';

beforeEach(() => {
  localStorage.clear();
});

describe('educationResourcePreview', () => {
  it('sets isPreviewingDrafts true when only groups have drafts', async () => {
    localStorage.setItem(
      'bemtevi:dev-dashboard:drafts:v1',
      JSON.stringify(
        createDraftState({
          addedGroups: [{ id: 'new-group', title: 'Novo Grupo', order: 5 }],
        }),
      ),
    );

    const { resolveEducationResourcesForPreview } = await import('../educationResourcePreview');
    const preview = resolveEducationResourcesForPreview(getBundledContent());

    expect(preview.isPreviewingDrafts).toBe(true);
  });

  it('previews a local default group order of zero against a nonzero database baseline', async () => {
    localStorage.setItem(
      'bemtevi:dev-dashboard:drafts:v1',
      JSON.stringify(
        createDraftState({
          schemaVersion: '4.0.0',
          defaultGroupOrder: 0,
          contactPatches: [],
          addedContacts: [],
          removedContactIds: [],
        }),
      ),
    );
    const baseline = { ...getBundledContent(), defaultGroupOrder: 5 };

    const { resolveEducationResourcesForPreview } = await import('../educationResourcePreview');
    const preview = resolveEducationResourcesForPreview(baseline);

    expect(preview.defaultGroupOrder).toBe(0);
    expect(preview.isPreviewingDrafts).toBe(true);
  });

  it('marks edits and removals of database groups as local previews', async () => {
    const baseline = getBundledContent();
    const firstGroup = baseline.educationGroups[0];
    const secondGroup = baseline.educationGroups[1];
    expect(firstGroup).toBeDefined();
    expect(secondGroup).toBeDefined();
    localStorage.setItem(
      'bemtevi:dev-dashboard:drafts:v1',
      JSON.stringify(
        createDraftState({
          schemaVersion: '4.0.0',
          groupPatches: [{ id: firstGroup.id, sourceIndex: 0, patch: { title: 'Grupo editado' } }],
          removedGroupIds: [secondGroup.id],
          contactPatches: [],
          addedContacts: [],
          removedContactIds: [],
        }),
      ),
    );

    const { resolveEducationResourcesForPreview } = await import('../educationResourcePreview');
    const preview = resolveEducationResourcesForPreview(baseline);

    expect(preview.groups.find((group) => group.id === firstGroup.id)?.title).toBe('Grupo editado');
    expect(preview.groups.some((group) => group.id === secondGroup.id)).toBe(false);
    expect(preview.isPreviewingDrafts).toBe(true);
  });

  it('resolves local dashboard education drafts for preview', async () => {
    const resource = firstShippedMaterial();
    localStorage.setItem(
      'bemtevi:dev-dashboard:drafts:v1',
      JSON.stringify(
        createDraftState({
          educationMaterialPatches: [
            {
              id: resource.id,
              sourceIndex: shippedMaterialSourceIndex(resource.id),
              patch: { title: 'Material em teste' },
            },
          ],
        }),
      ),
    );

    const { resolveEducationResourcesForPreview } = await import('../educationResourcePreview');
    const preview = resolveEducationResourcesForPreview(getBundledContent());

    expect(preview.isPreviewingDrafts).toBe(true);
    expect(preview.changedResourceIds).toEqual([resource.id]);
    expect(preview.resources[0].title).toBe('Material em teste');
  });

  it('ignores unchanged education patches when computing preview warning state', async () => {
    const bundled = getBundledContent();
    const resource = firstShippedMaterial();
    localStorage.setItem(
      'bemtevi:dev-dashboard:drafts:v1',
      JSON.stringify(
        createDraftState({
          educationMaterialPatches: [
            {
              id: resource.id,
              sourceIndex: shippedMaterialSourceIndex(resource.id),
              patch: {
                title: resource.title,
                body: resource.body,
              },
            },
          ],
        }),
      ),
    );

    const { resolveEducationResourcesForPreview } = await import('../educationResourcePreview');
    const preview = resolveEducationResourcesForPreview(getBundledContent());

    expect(preview.isPreviewingDrafts).toBe(false);
    expect(preview.changedResourceIds).toEqual([]);
    expect(preview.resources).toEqual(bundled.educationMaterials);
  });
});
