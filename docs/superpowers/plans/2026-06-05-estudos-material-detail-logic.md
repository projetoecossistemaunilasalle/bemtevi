# Estudos Material Detail Logic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the data, validation, draft-preview, video parsing, and export foundation for editable Estudos material details.

**Architecture:** Keep education material content as typed, serializable records. Public preview reads shipped content plus dashboard local drafts through a shared resolver, while dashboard export continues to emit complete changed records. This plan intentionally avoids visual layout work except where tests need non-visual helpers.

**Tech Stack:** TypeScript, React/Vite module loading, Vitest, Testing Library where needed, existing dashboard localStorage draft storage.

---

## Dependency

Run this logic plan before `docs/superpowers/plans/2026-06-05-estudos-material-detail-ui.md`.

---

## File Structure

- Create: `src/content/resources/featuredImages.ts`
  - Owns bundled featured-image options and lookup helpers.
- Create: `src/features/education/educationResourcePreview.ts`
  - Resolves shipped education resources plus local dashboard drafts.
- Create: `src/features/education/videoEmbeds.ts`
  - Parses supported YouTube URLs into embed URLs and returns link fallbacks.
- Modify: `src/domain/resources/types.ts`
  - Adds `featuredImage`; expands resource body block fields while preserving `paragraph`.
- Modify: `src/content/resources/resources.ts`
  - Seeds current material with featured image and structured detail body.
- Modify: `src/dev-dashboard/DashboardRoute.tsx`
  - Initializes new local materials with valid featured image and starter body.
- Modify: `src/dev-dashboard/education/educationValidation.ts`
  - Validates featured-image and body-block data.
- Modify tests:
  - `src/dev-dashboard/__tests__/educationValidation.test.ts`
  - `src/content/__tests__/content.test.ts`
  - `src/features/education/__tests__/EducationScreens.test.tsx`
  - `src/dev-dashboard/__tests__/exportBundle.test.ts`

---

### Task 1: Resource Types And Featured Image Catalog

**Files:**

- Modify: `src/domain/resources/types.ts`
- Create: `src/content/resources/featuredImages.ts`
- Test: `src/dev-dashboard/__tests__/educationValidation.test.ts`

- [ ] **Step 1: Write failing validation tests for featured-image data**

In `src/dev-dashboard/__tests__/educationValidation.test.ts`, update `baseResource` to include valid defaults:

```ts
const baseResource: EducationResource = {
  id: 'resource-one',
  title: 'Material de teste',
  source: 'Equipe BemTeVi',
  description: 'Descrição clara do material.',
  imageUrl: 'https://example.com/thumb.jpg',
  featuredImage: { kind: 'catalog', imageId: 'hands-holding-plant' },
  tags: ['descanso'],
  audience: 'teachers',
  contentType: 'summary',
  review: {
    status: 'pending_review',
    reviewedBy: null,
    reviewedAt: null,
    notes: '',
  },
};
```

Append:

```ts
it('rejects materials without a featured image', () => {
  const result = validateDashboardEducation([{ ...baseResource, featuredImage: undefined }]);

  expect(result.errors).toContainEqual(
    expect.objectContaining({
      id: 'missing-featured-image:resource-one',
      message: 'A imagem principal do material é obrigatória.',
    }),
  );
});

it('rejects unknown featured image catalog IDs', () => {
  const result = validateDashboardEducation([
    { ...baseResource, featuredImage: { kind: 'catalog', imageId: 'unknown-image' } },
  ]);

  expect(result.errors).toContainEqual(
    expect.objectContaining({
      id: 'unknown-featured-image:resource-one',
      message: 'A imagem principal selecionada não existe no catálogo.',
    }),
  );
});

it('rejects invalid external featured image URLs', () => {
  const result = validateDashboardEducation([
    { ...baseResource, featuredImage: { kind: 'external', imageUrl: 'not-a-url' } },
  ]);

  expect(result.errors).toContainEqual(
    expect.objectContaining({
      id: 'invalid-featured-image-url:resource-one',
      message: 'A URL da imagem principal precisa começar com http:// ou https://.',
    }),
  );
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
pnpm run test -- src/dev-dashboard/__tests__/educationValidation.test.ts
```

Expected: FAIL because `featuredImage` typing/catalog validation does not exist.

- [ ] **Step 3: Extend resource types**

In `src/domain/resources/types.ts`, add:

```ts
export type EducationResourceFeaturedImage =
  | { kind: 'catalog'; imageId: string }
  | { kind: 'external'; imageUrl: string; alt?: string };

export type EducationResourceBlockKind = 'paragraph' | 'heading' | 'list' | 'image' | 'video' | 'sourceLink';
```

Replace `EducationResourceBlock` with:

```ts
export interface EducationResourceBlock {
  id: string;
  kind: EducationResourceBlockKind;
  title?: string;
  text?: string;
  items?: string[];
  imageUrl?: string;
  alt?: string;
  url?: string;
  label?: string;
  description?: string;
}
```

Add this optional field to `EducationResource`:

```ts
featuredImage?: EducationResourceFeaturedImage;
```

Keep `paragraph` as the normal text block kind. Do not introduce `text`; the approved design explicitly rejected that rename.

- [ ] **Step 4: Create featured image catalog**

Create `src/content/resources/featuredImages.ts`:

```ts
export interface FeaturedImageOption {
  id: string;
  src: string;
  alt: string;
}

export const featuredImageOptions = [
  {
    id: 'hands-holding-plant',
    src: `${import.meta.env.BASE_URL}hands_holding_plant.png`,
    alt: 'Mãos segurando uma planta pequena.',
  },
] satisfies FeaturedImageOption[];

export const defaultFeaturedImageId = featuredImageOptions[0].id;

export function findFeaturedImageOption(imageId: string | undefined) {
  return featuredImageOptions.find((image) => image.id === imageId);
}
```

- [ ] **Step 5: Commit task**

Run:

```bash
git add src/domain/resources/types.ts src/content/resources/featuredImages.ts src/dev-dashboard/__tests__/educationValidation.test.ts
git commit -m "feat: add education featured image model"
```

Expected: commit succeeds. If `src/dev-dashboard/__tests__/dashboardRoute.test.tsx` or `src/dev-dashboard/flows/FlowEditor.tsx` has unrelated pre-existing edits, leave them untouched.

---

### Task 2: Education Validation

**Files:**

- Modify: `src/dev-dashboard/education/educationValidation.ts`
- Test: `src/dev-dashboard/__tests__/educationValidation.test.ts`

- [ ] **Step 1: Add failing body-block validation tests**

Append:

```ts
it('rejects empty paragraph body blocks', () => {
  const result = validateDashboardEducation([
    { ...baseResource, body: [{ id: 'overview', kind: 'paragraph', text: '   ' }] },
  ]);

  expect(result.errors).toContainEqual(
    expect.objectContaining({
      id: 'empty-body-block:resource-one:overview',
      message: 'Este bloco do conteúdo está vazio.',
    }),
  );
});

it('rejects body image blocks with invalid URLs', () => {
  const result = validateDashboardEducation([
    { ...baseResource, body: [{ id: 'image-one', kind: 'image', imageUrl: 'image.png' }] },
  ]);

  expect(result.errors).toContainEqual(
    expect.objectContaining({
      id: 'invalid-body-image-url:resource-one:image-one',
      message: 'A URL da imagem interna precisa começar com http:// ou https://.',
    }),
  );
});

it('rejects video blocks with invalid URLs', () => {
  const result = validateDashboardEducation([
    { ...baseResource, body: [{ id: 'video-one', kind: 'video', title: 'Vídeo', url: 'video' }] },
  ]);

  expect(result.errors).toContainEqual(
    expect.objectContaining({
      id: 'invalid-video-block-url:resource-one:video-one',
      message: 'A URL do vídeo precisa começar com http:// ou https://.',
    }),
  );
});
```

- [ ] **Step 2: Run validation test**

Run:

```bash
pnpm run test -- src/dev-dashboard/__tests__/educationValidation.test.ts
```

Expected: FAIL because body validation is absent.

- [ ] **Step 3: Implement featured-image and body validation**

In `src/dev-dashboard/education/educationValidation.ts`, add:

```ts
import { findFeaturedImageOption } from '../../content/resources/featuredImages';
```

Add this alias near imports:

```ts
type EducationResourceBodyBlock = NonNullable<EducationResource['body']>[number];
```

Inside the per-resource loop, after required title/source/description checks, add:

```ts
if (!resource.featuredImage) {
  issues.push({
    level: 'error',
    area: 'education',
    id: `missing-featured-image:${resource.id}`,
    message: 'A imagem principal do material é obrigatória.',
    path: `${resource.id}.featuredImage`,
  });
} else if (resource.featuredImage.kind === 'catalog' && !findFeaturedImageOption(resource.featuredImage.imageId)) {
  issues.push({
    level: 'error',
    area: 'education',
    id: `unknown-featured-image:${resource.id}`,
    message: 'A imagem principal selecionada não existe no catálogo.',
    path: `${resource.id}.featuredImage.imageId`,
  });
} else if (resource.featuredImage.kind === 'external' && !isHttpUrl(resource.featuredImage.imageUrl)) {
  issues.push({
    level: 'error',
    area: 'education',
    id: `invalid-featured-image-url:${resource.id}`,
    message: 'A URL da imagem principal precisa começar com http:// ou https://.',
    path: `${resource.id}.featuredImage.imageUrl`,
  });
}

resource.body?.forEach((block) => validateBodyBlock(issues, resource.id, block));
```

Add below `pushMissing`:

```ts
function validateBodyBlock(issues: DashboardValidationIssue[], resourceId: string, block: EducationResourceBodyBlock) {
  const path = `${resourceId}.body.${block.id}`;

  if ((block.kind === 'paragraph' || block.kind === 'heading') && !block.text?.trim()) {
    issues.push({
      level: 'error',
      area: 'education',
      id: `empty-body-block:${resourceId}:${block.id}`,
      message: 'Este bloco do conteúdo está vazio.',
      path,
    });
  }

  if (block.kind === 'list' && (!block.items || block.items.every((item) => !item.trim()))) {
    issues.push({
      level: 'error',
      area: 'education',
      id: `empty-body-block:${resourceId}:${block.id}`,
      message: 'Este bloco do conteúdo está vazio.',
      path,
    });
  }

  if (block.kind === 'image' && !isHttpUrl(block.imageUrl ?? '')) {
    issues.push({
      level: 'error',
      area: 'education',
      id: `invalid-body-image-url:${resourceId}:${block.id}`,
      message: 'A URL da imagem interna precisa começar com http:// ou https://.',
      path: `${path}.imageUrl`,
    });
  }

  if (block.kind === 'video' && !isHttpUrl(block.url ?? '')) {
    issues.push({
      level: 'error',
      area: 'education',
      id: `invalid-video-block-url:${resourceId}:${block.id}`,
      message: 'A URL do vídeo precisa começar com http:// ou https://.',
      path: `${path}.url`,
    });
  }

  if (block.kind === 'sourceLink' && (!block.label?.trim() || !isHttpUrl(block.url ?? ''))) {
    issues.push({
      level: 'error',
      area: 'education',
      id: `invalid-source-link-block:${resourceId}:${block.id}`,
      message: 'O bloco de fonte precisa de rótulo e URL pública.',
      path,
    });
  }
}
```

- [ ] **Step 4: Run validation test**

Run:

```bash
pnpm run test -- src/dev-dashboard/__tests__/educationValidation.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit task**

Run:

```bash
git add src/dev-dashboard/education/educationValidation.ts src/dev-dashboard/__tests__/educationValidation.test.ts
git commit -m "feat: validate education material detail content"
```

Expected: commit succeeds.

---

### Task 3: Seed Content And Dashboard Defaults

**Files:**

- Modify: `src/content/resources/resources.ts`
- Modify: `src/content/__tests__/content.test.ts`
- Modify: `src/dev-dashboard/DashboardRoute.tsx`
- Test: `src/content/__tests__/content.test.ts`

- [ ] **Step 1: Add seed content test**

In `src/content/__tests__/content.test.ts`, add:

```ts
it('seeds education resources with detail preview fields', () => {
  const resource = resourcesContent.resources[0];

  expect(resource.featuredImage).toEqual({ kind: 'catalog', imageId: 'hands-holding-plant' });
  expect(resource.body?.map((block) => block.kind)).toEqual(['paragraph', 'video', 'paragraph', 'sourceLink']);
});
```

- [ ] **Step 2: Run content test**

Run:

```bash
pnpm run test -- src/content/__tests__/content.test.ts
```

Expected: FAIL because the seed resource lacks the new detail content.

- [ ] **Step 3: Seed shipped resource body**

In `src/content/resources/resources.ts`, add to the first resource:

```ts
featuredImage: { kind: 'catalog', imageId: 'hands-holding-plant' },
body: [
  {
    id: 'overview',
    kind: 'paragraph',
    title: 'Sobre este material',
    text:
      'Este conteúdo reúne orientações breves para reconhecer sinais de tensão, organizar pequenas pausas e retomar a rotina com mais presença. Ele não substitui atendimento profissional e não tem finalidade diagnóstica.',
  },
  {
    id: 'breathing-video',
    kind: 'video',
    title: 'Vídeo: pausa de respiração para professores',
    url: 'https://www.youtube.com/watch?v=kiEmbhvv7Fo',
    description: 'Embed configurável pelo dashboard.',
  },
  {
    id: 'practice',
    kind: 'paragraph',
    title: 'Aplicação prática',
    text:
      'Uma sugestão é reservar um momento curto antes ou depois da aula para uma pausa guiada. O professor pode adaptar a prática ao tempo disponível e ao contexto da turma.',
  },
  {
    id: 'source',
    kind: 'sourceLink',
    label: 'Acessar fonte original',
    url: 'https://www.feevale.br/',
  },
],
```

- [ ] **Step 4: Initialize new dashboard materials**

In `src/dev-dashboard/DashboardRoute.tsx`, add:

```ts
import { defaultFeaturedImageId } from '../content/resources/featuredImages';
```

Inside `createLocalEducationMaterial`, include:

```ts
imageUrl: '',
featuredImage: { kind: 'catalog' as const, imageId: defaultFeaturedImageId },
body: [
  {
    id: `material-local-${suffix}-overview`,
    kind: 'paragraph' as const,
    title: 'Sobre este material',
    text: 'Descreva aqui o conteúdo principal do material.',
  },
],
```

- [ ] **Step 5: Run content test**

Run:

```bash
pnpm run test -- src/content/__tests__/content.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit task**

Run:

```bash
git add src/content/resources/resources.ts src/content/__tests__/content.test.ts src/dev-dashboard/DashboardRoute.tsx
git commit -m "feat: seed education material detail data"
```

Expected: commit succeeds.

---

### Task 4: Draft Preview Resolver And Video Embed Parser

**Files:**

- Create: `src/features/education/educationResourcePreview.ts`
- Create: `src/features/education/videoEmbeds.ts`
- Modify: `src/features/education/__tests__/EducationScreens.test.tsx`
- Test: `src/features/education/__tests__/EducationScreens.test.tsx`

- [ ] **Step 1: Add helper tests**

Append to `src/features/education/__tests__/EducationScreens.test.tsx`:

```ts
describe('resolveVideoEmbed', () => {
  it('converts YouTube watch URLs to embed URLs', async () => {
    const { resolveVideoEmbed } = await import('../videoEmbeds');

    expect(resolveVideoEmbed('https://www.youtube.com/watch?v=abcdef12345')).toEqual({
      kind: 'youtube',
      embedUrl: 'https://www.youtube.com/embed/abcdef12345',
    });
  });

  it('falls back to a link for generic video URLs', async () => {
    const { resolveVideoEmbed } = await import('../videoEmbeds');

    expect(resolveVideoEmbed('https://example.com/video')).toEqual({
      kind: 'link',
      url: 'https://example.com/video',
    });
  });
});
```

- [ ] **Step 2: Add preview resolver test**

Add:

```ts
it('resolves local dashboard education drafts for preview', async () => {
  const resource = resourcesContent.resources[0];
  localStorage.setItem(
    'bemtevi:dev-dashboard:drafts:v1',
    JSON.stringify({
      schemaVersion: '1.0.0',
      flowPatches: [],
      educationMaterialPatches: [
        {
          id: resource.id,
          sourceIndex: 0,
          patch: { title: 'Material em teste' },
        },
      ],
      addedFlows: [],
      addedEducationMaterials: [],
      updatedAt: '2026-06-05T00:00:00.000Z',
    }),
  );

  const { resolveEducationResourcesForPreview } = await import('../educationResourcePreview');
  const preview = resolveEducationResourcesForPreview();

  expect(preview.isPreviewingDrafts).toBe(true);
  expect(preview.resources[0].title).toBe('Material em teste');
});
```

Ensure this test file clears localStorage:

```ts
beforeEach(() => {
  localStorage.clear();
});
```

- [ ] **Step 3: Run education tests**

Run:

```bash
pnpm run test -- src/features/education/__tests__/EducationScreens.test.tsx
```

Expected: FAIL because helpers do not exist.

- [ ] **Step 4: Implement video embed helper**

Create `src/features/education/videoEmbeds.ts`:

```ts
export type ResolvedVideoEmbed = { kind: 'youtube'; embedUrl: string } | { kind: 'link'; url: string };

export function resolveVideoEmbed(url: string): ResolvedVideoEmbed {
  const videoId = parseYouTubeVideoId(url);

  if (videoId) {
    return { kind: 'youtube', embedUrl: `https://www.youtube.com/embed/${videoId}` };
  }

  return { kind: 'link', url };
}

function parseYouTubeVideoId(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, '');

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (url.pathname === '/watch') return normalizeYouTubeId(url.searchParams.get('v'));
      if (url.pathname.startsWith('/embed/')) return normalizeYouTubeId(url.pathname.split('/')[2]);
    }

    if (host === 'youtu.be') {
      return normalizeYouTubeId(url.pathname.slice(1));
    }
  } catch {
    return null;
  }

  return null;
}

function normalizeYouTubeId(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  return /^[A-Za-z0-9_-]{6,}$/.test(trimmed) ? trimmed : null;
}
```

- [ ] **Step 5: Implement education preview resolver**

Create `src/features/education/educationResourcePreview.ts`:

```ts
import { resourcesContent } from '../../content/resources/resources';
import type { EducationResource } from '../../domain/resources/types';
import { getShippedDashboardContent } from '../../dev-dashboard/content/shippedContent';
import {
  createEmptyDashboardDraftState,
  loadDashboardDrafts,
  mergeDashboardDrafts,
} from '../../dev-dashboard/draft-storage/dashboardStorage';

export interface EducationResourcePreviewState {
  resources: EducationResource[];
  isPreviewingDrafts: boolean;
}

export function resolveEducationResourcesForPreview(): EducationResourcePreviewState {
  const drafts = safeLoadDrafts();
  const hasEducationDrafts = drafts.educationMaterialPatches.length > 0 || drafts.addedEducationMaterials.length > 0;

  if (!hasEducationDrafts) {
    return { resources: resourcesContent.resources, isPreviewingDrafts: false };
  }

  return {
    resources: mergeDashboardDrafts(getShippedDashboardContent(), drafts).educationMaterials,
    isPreviewingDrafts: true,
  };
}

function safeLoadDrafts() {
  try {
    return loadDashboardDrafts();
  } catch {
    return createEmptyDashboardDraftState();
  }
}
```

If importing from `src/dev-dashboard` causes a production bundle concern during implementation, move `dashboardStorage.ts` and `shippedContent.ts` dependencies to a neutral shared location in the same task and update imports. Keep the `resolveEducationResourcesForPreview` API above.

- [ ] **Step 6: Run education tests**

Run:

```bash
pnpm run test -- src/features/education/__tests__/EducationScreens.test.tsx
```

Expected: PASS for helper/resolver tests. Existing UI tests should keep their current behavior until the UI plan changes rendering.

- [ ] **Step 7: Commit task**

Run:

```bash
git add src/features/education/educationResourcePreview.ts src/features/education/videoEmbeds.ts src/features/education/__tests__/EducationScreens.test.tsx
git commit -m "feat: resolve education material preview data"
```

Expected: commit succeeds.

---

### Task 5: Export Coverage And Logic Verification

**Files:**

- Modify: `src/dev-dashboard/__tests__/exportBundle.test.ts`
- Test: `src/dev-dashboard/__tests__/exportBundle.test.ts`

- [ ] **Step 1: Update export test data**

In `src/dev-dashboard/__tests__/exportBundle.test.ts`, add to the base `material`:

```ts
featuredImage: { kind: 'catalog', imageId: 'hands-holding-plant' },
```

Append:

```ts
it('exports changed education materials with featured image and body blocks', () => {
  const changedMaterial: EducationResource = {
    ...material,
    featuredImage: { kind: 'external', imageUrl: 'https://example.com/main.jpg' },
    body: [{ id: 'overview', kind: 'paragraph', title: 'Sobre', text: 'Texto revisado.' }],
  };

  const bundle = buildExportBundle({
    shipped: { flows: [], educationMaterials: [material] },
    drafts: { flows: [], educationMaterials: [changedMaterial] },
    validation: { errors: [], warnings: [] },
    exportedAt: '2026-06-05T00:00:00.000Z',
  });

  expect(bundle.changes.educationMaterials).toEqual([changedMaterial]);
});
```

- [ ] **Step 2: Run export test**

Run:

```bash
pnpm run test -- src/dev-dashboard/__tests__/exportBundle.test.ts
```

Expected: PASS because export compares full changed records generically.

- [ ] **Step 3: Run logic test set**

Run:

```bash
pnpm run test -- src/dev-dashboard/__tests__/educationValidation.test.ts
pnpm run test -- src/content/__tests__/content.test.ts
pnpm run test -- src/features/education/__tests__/EducationScreens.test.tsx
pnpm run test -- src/dev-dashboard/__tests__/exportBundle.test.ts
pnpm run typecheck
```

Expected: all commands PASS.

- [ ] **Step 4: Commit task**

Run:

```bash
git add src/dev-dashboard/__tests__/exportBundle.test.ts
git commit -m "test: cover education material detail export"
```

Expected: commit succeeds.

---

## Handoff To UI Plan

After this plan passes, execute `docs/superpowers/plans/2026-06-05-estudos-material-detail-ui.md`.
