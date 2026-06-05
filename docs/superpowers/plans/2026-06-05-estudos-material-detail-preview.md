# Estudos Material Detail Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete Estudos material detail screen, editable dashboard material body blocks, and local-draft preview warning behavior.

**Architecture:** Extend the existing typed education resource model instead of introducing a separate CMS layer. Public education screens will resolve shipped resources plus local dashboard drafts through a small shared resolver. The dashboard will edit the same structured resource records that export already emits.

**Tech Stack:** React 19, TypeScript, React Router, Tailwind CSS v4, Vitest, Testing Library, existing localStorage dashboard draft storage.

---

## File Structure

- Create: `src/content/resources/featuredImages.ts`
  - Owns the bundled featured-image catalog and helper lookup functions.
- Create: `src/features/education/educationResourcePreview.ts`
  - Resolves shipped education resources plus local dashboard drafts for public preview screens.
- Create: `src/features/education/videoEmbeds.ts`
  - Converts supported YouTube URLs into safe embed URLs and identifies generic fallback links.
- Modify: `src/domain/resources/types.ts`
  - Adds `featuredImage` and extends `EducationResourceBlock` to cover inline images, videos, and source links.
- Modify: `src/content/resources/resources.ts`
  - Seeds the existing material with a valid featured image and detail body blocks.
- Modify: `src/features/education/EducationLibraryScreen.tsx`
  - Reads preview-resolved resources and optionally displays a compact preview warning.
- Modify: `src/features/education/ResourceDetailScreen.tsx`
  - Renders the new material detail page, featured image, body blocks, video embeds/fallbacks, and preview warning.
- Modify: `src/dev-dashboard/DashboardRoute.tsx`
  - Gives new materials a valid default `featuredImage` and initial body.
- Modify: `src/dev-dashboard/education/EducationDashboard.tsx`
  - Adds featured-image controls, thumbnail URL copy, block editor, and up/down reorder controls.
- Modify: `src/dev-dashboard/education/educationValidation.ts`
  - Validates featured-image source and body block fields.
- Modify tests:
  - `src/features/education/__tests__/EducationScreens.test.tsx`
  - `src/dev-dashboard/__tests__/dashboardRoute.test.tsx`
  - `src/dev-dashboard/__tests__/educationValidation.test.ts`
  - `src/dev-dashboard/__tests__/exportBundle.test.ts`

---

### Task 1: Resource Types And Featured Image Catalog

**Files:**
- Modify: `src/domain/resources/types.ts`
- Create: `src/content/resources/featuredImages.ts`
- Test: `src/dev-dashboard/__tests__/educationValidation.test.ts`

- [ ] **Step 1: Add failing validation tests for featured image catalog rules**

Append these tests to `src/dev-dashboard/__tests__/educationValidation.test.ts`:

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

Update `baseResource` in the same file so existing tests can opt into valid defaults:

```ts
const baseResource: EducationResource = {
  id: 'resource-one',
  title: 'Material de teste',
  source: 'Equipe SeCuida',
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

- [ ] **Step 2: Run validation test and verify it fails**

Run:

```bash
pnpm run test -- src/dev-dashboard/__tests__/educationValidation.test.ts
```

Expected: FAIL because `featuredImage` and catalog validation do not exist yet.

- [ ] **Step 3: Extend the resource types**

In `src/domain/resources/types.ts`, replace `EducationResourceBlock` and add featured-image types:

```ts
export type EducationResourceFeaturedImage =
  | { kind: 'catalog'; imageId: string }
  | { kind: 'external'; imageUrl: string; alt?: string };

export type EducationResourceBlockKind = 'paragraph' | 'heading' | 'list' | 'image' | 'video' | 'sourceLink';

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

Add this field to `EducationResource`:

```ts
featuredImage?: EducationResourceFeaturedImage;
```

Keep `featuredImage` optional at the type level so older stored drafts do not crash TypeScript callers; validation will require it for edited/published records.

- [ ] **Step 4: Add the bundled featured-image catalog**

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

- [ ] **Step 5: Commit type/catalog skeleton**

Run:

```bash
git add src/domain/resources/types.ts src/content/resources/featuredImages.ts src/dev-dashboard/__tests__/educationValidation.test.ts
git commit -m "feat: add education featured image model"
```

Expected: commit succeeds. If there are pre-existing unrelated edits in any of these files, inspect and stage only the intended hunks.

---

### Task 2: Education Validation For Featured Images And Blocks

**Files:**
- Modify: `src/dev-dashboard/education/educationValidation.ts`
- Test: `src/dev-dashboard/__tests__/educationValidation.test.ts`

- [ ] **Step 1: Add failing block validation tests**

Append these tests to `src/dev-dashboard/__tests__/educationValidation.test.ts`:

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

- [ ] **Step 2: Run validation test and verify it fails**

Run:

```bash
pnpm run test -- src/dev-dashboard/__tests__/educationValidation.test.ts
```

Expected: FAIL because block validation is not implemented yet.

- [ ] **Step 3: Implement validation helpers**

In `src/dev-dashboard/education/educationValidation.ts`, add imports:

```ts
import { findFeaturedImageOption } from '../../content/resources/featuredImages';
```

Inside the `resources.forEach((resource) => { ... })` loop, after required metadata checks, add:

```ts
    if (!resource.featuredImage) {
      issues.push({
        level: 'error',
        area: 'education',
        id: `missing-featured-image:${resource.id}`,
        message: 'A imagem principal do material é obrigatória.',
        path: `${resource.id}.featuredImage`,
      });
    } else if (resource.featuredImage.kind === 'catalog') {
      if (!findFeaturedImageOption(resource.featuredImage.imageId)) {
        issues.push({
          level: 'error',
          area: 'education',
          id: `unknown-featured-image:${resource.id}`,
          message: 'A imagem principal selecionada não existe no catálogo.',
          path: `${resource.id}.featuredImage.imageId`,
        });
      }
    } else if (!isHttpUrl(resource.featuredImage.imageUrl)) {
      issues.push({
        level: 'error',
        area: 'education',
        id: `invalid-featured-image-url:${resource.id}`,
        message: 'A URL da imagem principal precisa começar com http:// ou https://.',
        path: `${resource.id}.featuredImage.imageUrl`,
      });
    }

    resource.body?.forEach((block) => {
      validateBodyBlock(issues, resource.id, block);
    });
```

Add this helper below `pushMissing`:

```ts
function validateBodyBlock(
  issues: DashboardValidationIssue[],
  resourceId: string,
  block: EducationResource['body'][number],
) {
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

Because `EducationResource['body']` is optional, TypeScript may require a non-nullable alias. If so, use this near the imports:

```ts
type EducationResourceBodyBlock = NonNullable<EducationResource['body']>[number];
```

and update the helper parameter to `block: EducationResourceBodyBlock`.

- [ ] **Step 4: Run validation test and verify it passes**

Run:

```bash
pnpm run test -- src/dev-dashboard/__tests__/educationValidation.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit validation**

Run:

```bash
git add src/dev-dashboard/education/educationValidation.ts src/dev-dashboard/__tests__/educationValidation.test.ts
git commit -m "feat: validate education material detail content"
```

Expected: commit succeeds.

---

### Task 3: Seed Existing Education Content

**Files:**
- Modify: `src/content/resources/resources.ts`
- Test: `src/content/__tests__/content.test.ts`

- [ ] **Step 1: Add a content assertion for featured image and body blocks**

Append this test to the existing education resource describe block in `src/content/__tests__/content.test.ts`, or create the describe block if needed:

```ts
it('seeds education resources with detail preview fields', () => {
  const resource = resourcesContent.resources[0];

  expect(resource.featuredImage).toEqual({ kind: 'catalog', imageId: 'hands-holding-plant' });
  expect(resource.body?.map((block) => block.kind)).toEqual([
    'paragraph',
    'video',
    'paragraph',
    'sourceLink',
  ]);
});
```

- [ ] **Step 2: Run content test and verify it fails**

Run:

```bash
pnpm run test -- src/content/__tests__/content.test.ts
```

Expected: FAIL because the seed resource does not have these detail fields yet.

- [ ] **Step 3: Update the shipped material**

In `src/content/resources/resources.ts`, update the first resource:

```ts
      imageUrl:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuBUu8741_OQaC5gUnsKWur7Ue7XjPl0zrmuOIJ4Beja1qwe3ecefY-jAPirXyxkalCbdbrni9ru9BNvN445eECuIikPSHgiq06Tzqu-95xgP3UoyvMQVVQI36N81_js4EGvH1QQRVXJ_e8rIpiTlui2vOpllyou7wJMei-tkTvrlnzhswzlJVMxW6GA0QKmGziWmfB7sY5Eskwn6YISBEpc1HqIHOmjdvGPEcHf13Ez2CF_WEnk99EtkQo2HAQMRaTBB1WY5bv-ygQ',
      featuredImage: { kind: 'catalog', imageId: 'hands-holding-plant' },
```

Replace the current `body` array with:

```ts
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
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
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

Use `https://www.youtube.com/watch?v=dQw4w9WgXcQ` as the deterministic seed video URL for tests and rendering unless a reviewed video URL is already present in the repository content before this task starts.

- [ ] **Step 4: Run content test and verify it passes**

Run:

```bash
pnpm run test -- src/content/__tests__/content.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit seeded content**

Run:

```bash
git add src/content/resources/resources.ts src/content/__tests__/content.test.ts
git commit -m "feat: seed education material detail content"
```

Expected: commit succeeds.

---

### Task 4: Public Draft Resolver

**Files:**
- Create: `src/features/education/educationResourcePreview.ts`
- Modify: `src/features/education/__tests__/EducationScreens.test.tsx`
- Test: `src/features/education/__tests__/EducationScreens.test.tsx`

- [ ] **Step 1: Add a failing preview resolver test through the detail screen**

Append this test to `src/features/education/__tests__/EducationScreens.test.tsx`:

```ts
it('previews local dashboard drafts with a warning banner', () => {
  const resource = resourcesContent.resources[0];
  localStorage.setItem(
    'secuida:dev-dashboard:drafts:v1',
    JSON.stringify({
      schemaVersion: '1.0.0',
      flowPatches: [],
      educationMaterialPatches: [
        {
          id: resource.id,
          sourceIndex: 0,
          patch: {
            title: 'Material em teste',
            body: [{ id: 'draft-body', kind: 'paragraph', title: 'Rascunho', text: 'Texto em revisão.' }],
          },
        },
      ],
      addedFlows: [],
      addedEducationMaterials: [],
      updatedAt: '2026-06-05T00:00:00.000Z',
    }),
  );

  render(
    <MemoryRouter initialEntries={[`/educacao/${resource.id}`]}>
      <Routes>
        <Route path="/educacao/:resourceId" element={<ResourceDetailScreen />} />
      </Routes>
    </MemoryRouter>,
  );

  expect(screen.getByRole('heading', { name: 'Material em teste' })).toBeInTheDocument();
  expect(screen.getByText(/versão de teste/i)).toBeInTheDocument();
  expect(screen.getByText('Texto em revisão.')).toBeInTheDocument();
});
```

Add `beforeEach(() => localStorage.clear());` inside the file-level describe scope or top-level test setup in this file so this test does not leak drafts into other cases.

- [ ] **Step 2: Run education screen test and verify it fails**

Run:

```bash
pnpm run test -- src/features/education/__tests__/EducationScreens.test.tsx
```

Expected: FAIL because public screens do not read dashboard drafts.

- [ ] **Step 3: Create resolver**

Create `src/features/education/educationResourcePreview.ts`:

```ts
import { resourcesContent } from '../../content/resources/resources';
import type { EducationResource } from '../../domain/resources/types';
import { createEmptyDashboardDraftState, loadDashboardDrafts, mergeDashboardDrafts } from '../../dev-dashboard/draft-storage/dashboardStorage';
import { getShippedDashboardContent } from '../../dev-dashboard/content/shippedContent';

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

If importing dashboard modules into public feature code creates bundle or lint concerns, move the shared merge/load helpers from `src/dev-dashboard` into a neutral path such as `src/domain/dashboard-drafts/dashboardStorage.ts` in this task, then update both dashboard and preview imports. Keep the public resolver API unchanged.

- [ ] **Step 4: Run education screen test and verify resolver still needs wiring**

Run:

```bash
pnpm run test -- src/features/education/__tests__/EducationScreens.test.tsx
```

Expected: still FAIL because screens do not use the resolver yet.

- [ ] **Step 5: Commit resolver**

Run:

```bash
git add src/features/education/educationResourcePreview.ts src/features/education/__tests__/EducationScreens.test.tsx
git commit -m "feat: resolve education draft previews"
```

Expected: commit succeeds.

---

### Task 5: Video Embed Helper

**Files:**
- Create: `src/features/education/videoEmbeds.ts`
- Modify: `src/features/education/__tests__/EducationScreens.test.tsx`
- Test: `src/features/education/__tests__/EducationScreens.test.tsx`

- [ ] **Step 1: Add focused tests for YouTube parsing**

Append this describe block to `src/features/education/__tests__/EducationScreens.test.tsx`:

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

- [ ] **Step 2: Run education screen test and verify it fails**

Run:

```bash
pnpm run test -- src/features/education/__tests__/EducationScreens.test.tsx
```

Expected: FAIL because `videoEmbeds.ts` does not exist.

- [ ] **Step 3: Implement the helper**

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

- [ ] **Step 4: Run education screen test and verify helper tests pass**

Run:

```bash
pnpm run test -- src/features/education/__tests__/EducationScreens.test.tsx
```

Expected: helper tests PASS. Detail-screen rendering assertions continue to fail at this point because Task 6 has not been executed.

- [ ] **Step 5: Commit video helper**

Run:

```bash
git add src/features/education/videoEmbeds.ts src/features/education/__tests__/EducationScreens.test.tsx
git commit -m "feat: resolve education video embeds"
```

Expected: commit succeeds.

---

### Task 6: Material Detail Screen Rendering

**Files:**
- Modify: `src/features/education/ResourceDetailScreen.tsx`
- Modify: `src/features/education/EducationLibraryScreen.tsx`
- Modify: `src/features/education/__tests__/EducationScreens.test.tsx`
- Test: `src/features/education/__tests__/EducationScreens.test.tsx`

- [ ] **Step 1: Add detail rendering assertions**

Update the first test in `src/features/education/__tests__/EducationScreens.test.tsx` so after clicking `Ver material`, it asserts:

```ts
expect(screen.getByRole('heading', { name: resource.title })).toBeInTheDocument();
expect(screen.getByText('Sobre este material')).toBeInTheDocument();
expect(screen.getByText('Aplicação prática')).toBeInTheDocument();
expect(screen.getByRole('link', { name: /acessar fonte original/i })).toHaveAttribute('href', 'https://www.feevale.br/');
```

Add this test:

```ts
it('renders generic video URLs as link cards instead of broken embeds', () => {
  const resource = resourcesContent.resources[0];
  localStorage.setItem(
    'secuida:dev-dashboard:drafts:v1',
    JSON.stringify({
      schemaVersion: '1.0.0',
      flowPatches: [],
      educationMaterialPatches: [
        {
          id: resource.id,
          sourceIndex: 0,
          patch: {
            body: [{ id: 'generic-video', kind: 'video', title: 'Vídeo externo', url: 'https://example.com/video' }],
          },
        },
      ],
      addedFlows: [],
      addedEducationMaterials: [],
      updatedAt: '2026-06-05T00:00:00.000Z',
    }),
  );

  render(
    <MemoryRouter initialEntries={[`/educacao/${resource.id}`]}>
      <Routes>
        <Route path="/educacao/:resourceId" element={<ResourceDetailScreen />} />
      </Routes>
    </MemoryRouter>,
  );

  expect(screen.getByRole('link', { name: /abrir vídeo externo/i })).toHaveAttribute('href', 'https://example.com/video');
  expect(screen.queryByTitle('Vídeo externo')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run education screen test and verify it fails**

Run:

```bash
pnpm run test -- src/features/education/__tests__/EducationScreens.test.tsx
```

Expected: FAIL because detail rendering has not been implemented.

- [ ] **Step 3: Wire the library screen to preview-resolved resources**

In `src/features/education/EducationLibraryScreen.tsx`, replace direct `resourcesContent` import/use with:

```ts
import { resolveEducationResourcesForPreview } from './educationResourcePreview';
```

Inside the component:

```ts
  const { resources, isPreviewingDrafts } = resolveEducationResourcesForPreview();
```

Replace `resourcesContent.resources.map` with `resources.map`.

Add this compact warning above the resource grid:

```tsx
      {isPreviewingDrafts ? (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 font-body-md text-yellow-900">
          Essa é uma versão de teste. O conteúdo não está salvo no site oficial.
        </div>
      ) : null}
```

- [ ] **Step 4: Replace the detail screen**

Replace `src/features/education/ResourceDetailScreen.tsx` with:

```tsx
import { ArrowLeft, ExternalLink, Play } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { routes } from '../../app/routes';
import { findFeaturedImageOption } from '../../content/resources/featuredImages';
import { Badge } from '../../design-system/components/Badge';
import { Card } from '../../design-system/components/Card';
import { Page } from '../../design-system/components/Page';
import type { EducationResource, EducationResourceBlock } from '../../domain/resources/types';
import { resolveEducationResourcesForPreview } from './educationResourcePreview';
import { resolveVideoEmbed } from './videoEmbeds';

export function ResourceDetailScreen() {
  const { resourceId } = useParams();
  const { resources, isPreviewingDrafts } = resolveEducationResourcesForPreview();
  const resource = resources.find((item) => item.id === resourceId) ?? resources[0];
  const featuredImage = resolveFeaturedImage(resource);

  return (
    <Page width="narrow" className="gap-stack-md">
      {isPreviewingDrafts ? (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 font-body-md text-yellow-900">
          Essa é uma versão de teste. O conteúdo não está salvo no site oficial.
        </div>
      ) : null}

      <Link to={routes.education} className="inline-flex items-center gap-2 font-label-md text-primary">
        <ArrowLeft size={18} />
        Estudos
      </Link>

      <header className="flex flex-col gap-stack-sm">
        <div className="flex flex-wrap gap-2">
          <Badge tone="secondary">{resource.source}</Badge>
          <Badge>Material educativo</Badge>
        </div>
        <h1 className="font-headline-lg text-on-surface">{resource.title}</h1>
        <p className="font-body-lg text-on-surface-variant">{resource.description}</p>
      </header>

      {featuredImage ? (
        <div className="h-56 w-full overflow-hidden rounded-2xl border border-outline-variant/20 bg-surface-container-low">
          <img alt={featuredImage.alt} className="h-full w-full object-cover" src={featuredImage.src} />
        </div>
      ) : null}

      <section className="flex flex-col gap-stack-md">
        {resource.body?.map((block) => <ResourceBodyBlock key={block.id} block={block} source={resource.source} />)}
      </section>
    </Page>
  );
}

function resolveFeaturedImage(resource: EducationResource) {
  if (!resource.featuredImage) return null;

  if (resource.featuredImage.kind === 'external') {
    return {
      src: resource.featuredImage.imageUrl,
      alt: resource.featuredImage.alt ?? '',
    };
  }

  const option = findFeaturedImageOption(resource.featuredImage.imageId);
  return option ? { src: option.src, alt: option.alt } : null;
}

function ResourceBodyBlock({ block, source }: { block: EducationResourceBlock; source: string }) {
  if (block.kind === 'heading') {
    return <h2 className="font-headline-md text-on-surface">{block.text}</h2>;
  }

  if (block.kind === 'paragraph') {
    return (
      <Card className="p-6">
        {block.title ? <h2 className="mb-2 font-headline-sm text-on-surface">{block.title}</h2> : null}
        <p className="font-body-lg text-on-surface-variant">{block.text}</p>
      </Card>
    );
  }

  if (block.kind === 'list') {
    return (
      <Card className="p-6">
        {block.title ? <h2 className="mb-2 font-headline-sm text-on-surface">{block.title}</h2> : null}
        <ul className="list-disc space-y-2 pl-5 font-body-lg text-on-surface-variant">
          {block.items?.map((item, index) => <li key={`${block.id}-${index}`}>{item}</li>)}
        </ul>
      </Card>
    );
  }

  if (block.kind === 'image' && block.imageUrl) {
    return (
      <div className="overflow-hidden rounded-2xl border border-outline-variant/20 bg-surface-container-low">
        <img alt={block.alt ?? ''} className="h-auto w-full object-cover" src={block.imageUrl} />
      </div>
    );
  }

  if (block.kind === 'video' && block.url) {
    const video = resolveVideoEmbed(block.url);

    if (video.kind === 'youtube') {
      return (
        <Card className="overflow-hidden p-0">
          <iframe
            className="aspect-video w-full"
            src={video.embedUrl}
            title={block.title ?? 'Vídeo'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
          <div className="p-5">
            {block.title ? <h2 className="font-headline-sm text-on-surface">{block.title}</h2> : null}
            {block.description ? <p className="font-body-md text-on-surface-variant">{block.description}</p> : null}
          </div>
        </Card>
      );
    }

    return (
      <Card className="flex items-center gap-4 p-5">
        <div className="flex h-16 w-20 items-center justify-center rounded-xl bg-inverse-surface text-inverse-on-surface">
          <Play size={28} />
        </div>
        <div>
          {block.title ? <h2 className="font-headline-sm text-on-surface">{block.title}</h2> : null}
          <a className="font-label-md text-primary" href={video.url} rel="noreferrer" target="_blank">
            Abrir vídeo externo
          </a>
        </div>
      </Card>
    );
  }

  if (block.kind === 'sourceLink' && block.url) {
    return (
      <Card className="p-5">
        <p className="font-body-md text-on-surface-variant">Fonte do material</p>
        <p className="font-headline-sm text-on-surface">{source}</p>
        <a className="mt-2 inline-flex items-center gap-2 font-label-md text-primary" href={block.url} rel="noreferrer" target="_blank">
          {block.label ?? 'Acessar fonte original'}
          <ExternalLink size={16} />
        </a>
      </Card>
    );
  }

  return null;
}
```

- [ ] **Step 5: Run education screen test and verify it passes**

Run:

```bash
pnpm run test -- src/features/education/__tests__/EducationScreens.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit public UI**

Run:

```bash
git add src/features/education src/features/education/__tests__/EducationScreens.test.tsx
git commit -m "feat: render education material details"
```

Expected: commit succeeds.

---

### Task 7: Dashboard Defaults For New Materials

**Files:**
- Modify: `src/dev-dashboard/DashboardRoute.tsx`
- Modify: `src/dev-dashboard/__tests__/dashboardRoute.test.tsx`
- Test: `src/dev-dashboard/__tests__/dashboardRoute.test.tsx`

- [ ] **Step 1: Add failing test for default featured image on new materials**

Append this assertion to the existing `adds a new local education material` test in `src/dev-dashboard/__tests__/dashboardRoute.test.tsx`:

```ts
expect(screen.getByRole('group', { name: 'Imagem principal do material' })).toBeInTheDocument();
expect(screen.getByRole('radio', { name: /mãos segurando uma planta pequena/i })).toBeChecked();
```

If the dashboard uses buttons instead of radios in Task 8, update the assertion there to check `aria-pressed="true"` on the selected thumbnail button.

- [ ] **Step 2: Run dashboard route test and verify it fails**

Run:

```bash
pnpm run test -- src/dev-dashboard/__tests__/dashboardRoute.test.tsx
```

Expected: FAIL because new materials do not initialize `featuredImage` and the editor does not show controls yet.

- [ ] **Step 3: Update new material factory**

In `src/dev-dashboard/DashboardRoute.tsx`, add:

```ts
import { defaultFeaturedImageId } from '../content/resources/featuredImages';
```

Update `createLocalEducationMaterial`:

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

Place these fields before `tags`.

- [ ] **Step 4: Commit dashboard default**

Run:

```bash
git add src/dev-dashboard/DashboardRoute.tsx src/dev-dashboard/__tests__/dashboardRoute.test.tsx
git commit -m "feat: initialize education material detail defaults"
```

Expected: commit succeeds, even if the dashboard route test still fails until Task 8 adds the controls.

---

### Task 8: Dashboard Featured Image And Block Editor

**Files:**
- Modify: `src/dev-dashboard/education/EducationDashboard.tsx`
- Modify: `src/dev-dashboard/__tests__/dashboardRoute.test.tsx`
- Test: `src/dev-dashboard/__tests__/dashboardRoute.test.tsx`

- [ ] **Step 1: Add failing dashboard editor tests**

Append these tests to `src/dev-dashboard/__tests__/dashboardRoute.test.tsx`:

```ts
it('edits the featured image with catalog and external URL modes', () => {
  render(
    <MemoryRouter>
      <DashboardRoute />
    </MemoryRouter>,
  );

  fireEvent.click(screen.getByRole('tab', { name: 'Materiais' }));

  expect(screen.getByRole('group', { name: 'Imagem principal do material' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('radio', { name: 'Usar URL externa' }));
  fireEvent.change(screen.getByLabelText('URL da imagem principal'), {
    target: { value: 'https://example.com/main.jpg' },
  });

  expect(screen.getByDisplayValue('https://example.com/main.jpg')).toBeInTheDocument();
});

it('adds, edits, and reorders material body blocks', () => {
  render(
    <MemoryRouter>
      <DashboardRoute />
    </MemoryRouter>,
  );

  fireEvent.click(screen.getByRole('tab', { name: 'Materiais' }));
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar bloco' }));
  fireEvent.change(screen.getByLabelText('Tipo do novo bloco'), { target: { value: 'video' } });
  fireEvent.click(screen.getByRole('button', { name: 'Criar bloco' }));
  fireEvent.change(screen.getByLabelText('Título do bloco 2'), { target: { value: 'Vídeo de teste' } });
  fireEvent.change(screen.getByLabelText('URL do vídeo do bloco 2'), {
    target: { value: 'https://www.youtube.com/watch?v=abcdef12345' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Mover bloco 2 para cima' }));

  expect(screen.getByDisplayValue('Vídeo de teste')).toBeInTheDocument();
  expect(screen.getByDisplayValue('https://www.youtube.com/watch?v=abcdef12345')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run dashboard test and verify it fails**

Run:

```bash
pnpm run test -- src/dev-dashboard/__tests__/dashboardRoute.test.tsx
```

Expected: FAIL because dashboard controls do not exist.

- [ ] **Step 3: Add imports and helper functions**

In `src/dev-dashboard/education/EducationDashboard.tsx`, add:

```ts
import { defaultFeaturedImageId, featuredImageOptions } from '../../content/resources/featuredImages';
import type { EducationResourceBlock, EducationResourceFeaturedImage } from '../../domain/resources/types';
```

Inside the component, add helper functions:

```ts
  const [newBlockKind, setNewBlockKind] = useState<EducationResourceBlock['kind']>('paragraph');

  function updateFeaturedImage(featuredImage: EducationResourceFeaturedImage) {
    onResourceChange(selectedResourceIndex, selectedResource.id, { featuredImage });
  }

  function updateBody(body: EducationResourceBlock[]) {
    onResourceChange(selectedResourceIndex, selectedResource.id, { body });
  }

  function updateBlock(blockId: string, patch: Partial<EducationResourceBlock>) {
    updateBody((selectedResource.body ?? []).map((block) => (block.id === blockId ? { ...block, ...patch } : block)));
  }

  function addBlock() {
    updateBody([...(selectedResource.body ?? []), createBodyBlock(newBlockKind, selectedResource.body?.length ?? 0)]);
  }

  function removeBlock(blockId: string) {
    updateBody((selectedResource.body ?? []).filter((block) => block.id !== blockId));
  }

  function moveBlock(blockIndex: number, direction: -1 | 1) {
    const body = [...(selectedResource.body ?? [])];
    const nextIndex = blockIndex + direction;
    if (nextIndex < 0 || nextIndex >= body.length) return;
    [body[blockIndex], body[nextIndex]] = [body[nextIndex], body[blockIndex]];
    updateBody(body);
  }
```

Add these file-level helpers below the component:

```ts
function createBodyBlock(kind: EducationResourceBlock['kind'], existingCount: number): EducationResourceBlock {
  const id = `body-block-${Date.now()}-${existingCount + 1}`;

  if (kind === 'heading') return { id, kind, text: 'Novo título' };
  if (kind === 'list') return { id, kind, title: 'Nova lista', items: ['Novo item'] };
  if (kind === 'image') return { id, kind, imageUrl: 'https://example.com/image.jpg', alt: '' };
  if (kind === 'video') return { id, kind, title: 'Novo vídeo', url: 'https://www.youtube.com/watch?v=abcdef12345' };
  if (kind === 'sourceLink') return { id, kind, label: 'Acessar fonte original', url: 'https://example.com' };

  return { id, kind: 'paragraph', title: 'Novo bloco', text: 'Texto do bloco.' };
}
```

Do not regenerate block IDs while editing. Use `block.id` as React keys in the render loop.

- [ ] **Step 4: Add featured image editor UI**

After the `imageUrl` field, add:

```tsx
          <label className="flex flex-col gap-2">
            <span className="font-label-md text-on-surface">Miniatura da biblioteca</span>
            <input
              aria-label="URL da miniatura da biblioteca"
              className="min-h-11 rounded-lg border border-outline-variant bg-surface px-3"
              value={selectedResource.imageUrl ?? ''}
              onChange={(event) =>
                onResourceChange(selectedResourceIndex, selectedResource.id, { imageUrl: event.target.value })
              }
            />
            <FieldHint>Imagem pequena usada no cartão da biblioteca de Estudos.</FieldHint>
          </label>

          <fieldset
            aria-label="Imagem principal do material"
            className="flex flex-col gap-3 rounded-lg border border-outline-variant/50 p-4"
          >
            <legend className="font-label-md text-on-surface">Imagem principal do material</legend>
            <FieldHint>Imagem grande exibida acima do conteúdo do material.</FieldHint>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 font-label-md text-on-surface">
                <input
                  checked={(selectedResource.featuredImage?.kind ?? 'catalog') === 'catalog'}
                  name="featured-image-kind"
                  type="radio"
                  onChange={() =>
                    updateFeaturedImage({ kind: 'catalog', imageId: defaultFeaturedImageId })
                  }
                />
                Usar imagem padrão
              </label>
              <label className="flex items-center gap-2 font-label-md text-on-surface">
                <input
                  checked={selectedResource.featuredImage?.kind === 'external'}
                  name="featured-image-kind"
                  type="radio"
                  onChange={() =>
                    updateFeaturedImage({ kind: 'external', imageUrl: selectedResource.imageUrl ?? '' })
                  }
                />
                Usar URL externa
              </label>
            </div>
            {(selectedResource.featuredImage?.kind ?? 'catalog') === 'catalog' ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {featuredImageOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    aria-label={option.alt}
                    aria-pressed={
                      selectedResource.featuredImage?.kind === 'catalog' &&
                      selectedResource.featuredImage.imageId === option.id
                    }
                    onClick={() => updateFeaturedImage({ kind: 'catalog', imageId: option.id })}
                    className={`h-24 overflow-hidden rounded-xl border-2 ${
                      selectedResource.featuredImage?.kind === 'catalog' &&
                      selectedResource.featuredImage.imageId === option.id
                        ? 'border-primary'
                        : 'border-transparent'
                    }`}
                  >
                    <img alt="" className="h-full w-full object-cover" src={option.src} />
                  </button>
                ))}
              </div>
            ) : (
              <label className="flex flex-col gap-2">
                <span className="font-label-md text-on-surface">URL da imagem principal</span>
                <input
                  aria-label="URL da imagem principal"
                  className="min-h-11 rounded-lg border border-outline-variant bg-surface px-3"
                  value={selectedResource.featuredImage?.kind === 'external' ? selectedResource.featuredImage.imageUrl : ''}
                  onChange={(event) =>
                    updateFeaturedImage({ kind: 'external', imageUrl: event.target.value })
                  }
                />
              </label>
            )}
          </fieldset>
```

If using button thumbnails, update the test from radio checked assertions to `aria-pressed` assertions.

- [ ] **Step 5: Add block editor UI**

Before `<ValidationSummary result={validation} />`, add:

```tsx
        <section className="flex flex-col gap-stack-sm rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-5">
          <h2 className="font-headline-sm text-on-surface">Conteúdo do material</h2>
          <FieldHint>Blocos exibidos na tela de detalhes, na ordem configurada aqui.</FieldHint>

          <div className="flex flex-col gap-3">
            {(selectedResource.body ?? []).map((block, blockIndex) => (
              <div key={block.id} className="rounded-lg border border-outline-variant/50 bg-surface p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-label-md text-on-surface">Bloco {blockIndex + 1}</h3>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={blockIndex === 0}
                      onClick={() => moveBlock(blockIndex, -1)}
                      className="rounded-full bg-secondary-container px-3 py-2 font-label-md text-on-secondary-container disabled:opacity-50"
                    >
                      Mover bloco {blockIndex + 1} para cima
                    </button>
                    <button
                      type="button"
                      disabled={blockIndex === (selectedResource.body?.length ?? 0) - 1}
                      onClick={() => moveBlock(blockIndex, 1)}
                      className="rounded-full bg-secondary-container px-3 py-2 font-label-md text-on-secondary-container disabled:opacity-50"
                    >
                      Mover bloco {blockIndex + 1} para baixo
                    </button>
                    <button
                      type="button"
                      onClick={() => removeBlock(block.id)}
                      className="rounded-full bg-error-container px-3 py-2 font-label-md text-on-error-container"
                    >
                      Remover bloco
                    </button>
                  </div>
                </div>
                <BlockFields block={block} blockNumber={blockIndex + 1} onChange={(patch) => updateBlock(block.id, patch)} />
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-outline-variant/50 p-4">
            <label className="flex flex-col gap-2">
              <span className="font-label-md text-on-surface">Tipo do novo bloco</span>
              <select
                aria-label="Tipo do novo bloco"
                className="min-h-11 rounded-lg border border-outline-variant bg-surface px-3"
                value={newBlockKind}
                onChange={(event) => setNewBlockKind(event.target.value as EducationResourceBlock['kind'])}
              >
                <option value="paragraph">Texto</option>
                <option value="heading">Título</option>
                <option value="list">Lista</option>
                <option value="image">Imagem interna</option>
                <option value="video">Vídeo</option>
                <option value="sourceLink">Fonte</option>
              </select>
            </label>
            <button
              type="button"
              onClick={addBlock}
              className="mt-3 min-h-11 rounded-full bg-secondary-container px-4 font-label-md text-on-secondary-container"
            >
              Adicionar bloco
            </button>
          </div>
        </section>
```

Add this helper component below `EducationDashboard`:

```tsx
function BlockFields({
  block,
  blockNumber,
  onChange,
}: {
  block: EducationResourceBlock;
  blockNumber: number;
  onChange: (patch: Partial<EducationResourceBlock>) => void;
}) {
  if (block.kind === 'heading') {
    return (
      <label className="flex flex-col gap-2">
        <span className="font-label-md text-on-surface">Texto do título</span>
        <input
          aria-label={`Título do bloco ${blockNumber}`}
          className="min-h-11 rounded-lg border border-outline-variant bg-surface px-3"
          value={block.text ?? ''}
          onChange={(event) => onChange({ text: event.target.value })}
        />
      </label>
    );
  }

  if (block.kind === 'image') {
    return (
      <div className="grid gap-3">
        <label className="flex flex-col gap-2">
          <span className="font-label-md text-on-surface">Imagem interna do conteúdo</span>
          <input
            aria-label={`URL da imagem do bloco ${blockNumber}`}
            className="min-h-11 rounded-lg border border-outline-variant bg-surface px-3"
            value={block.imageUrl ?? ''}
            onChange={(event) => onChange({ imageUrl: event.target.value })}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="font-label-md text-on-surface">Descrição da imagem</span>
          <input
            aria-label={`Descrição da imagem do bloco ${blockNumber}`}
            className="min-h-11 rounded-lg border border-outline-variant bg-surface px-3"
            value={block.alt ?? ''}
            onChange={(event) => onChange({ alt: event.target.value })}
          />
        </label>
      </div>
    );
  }

  if (block.kind === 'video') {
    return (
      <div className="grid gap-3">
        <label className="flex flex-col gap-2">
          <span className="font-label-md text-on-surface">Título do vídeo</span>
          <input
            aria-label={`Título do bloco ${blockNumber}`}
            className="min-h-11 rounded-lg border border-outline-variant bg-surface px-3"
            value={block.title ?? ''}
            onChange={(event) => onChange({ title: event.target.value })}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="font-label-md text-on-surface">URL do vídeo</span>
          <input
            aria-label={`URL do vídeo do bloco ${blockNumber}`}
            className="min-h-11 rounded-lg border border-outline-variant bg-surface px-3"
            value={block.url ?? ''}
            onChange={(event) => onChange({ url: event.target.value })}
          />
        </label>
      </div>
    );
  }

  if (block.kind === 'sourceLink') {
    return (
      <div className="grid gap-3">
        <label className="flex flex-col gap-2">
          <span className="font-label-md text-on-surface">Texto do link</span>
          <input
            aria-label={`Texto do link do bloco ${blockNumber}`}
            className="min-h-11 rounded-lg border border-outline-variant bg-surface px-3"
            value={block.label ?? ''}
            onChange={(event) => onChange({ label: event.target.value })}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="font-label-md text-on-surface">URL da fonte</span>
          <input
            aria-label={`URL da fonte do bloco ${blockNumber}`}
            className="min-h-11 rounded-lg border border-outline-variant bg-surface px-3"
            value={block.url ?? ''}
            onChange={(event) => onChange({ url: event.target.value })}
          />
        </label>
      </div>
    );
  }

  if (block.kind === 'list') {
    return (
      <label className="flex flex-col gap-2">
        <span className="font-label-md text-on-surface">Itens da lista</span>
        <textarea
          aria-label={`Itens da lista do bloco ${blockNumber}`}
          className="min-h-24 rounded-lg border border-outline-variant bg-surface px-3 py-2"
          value={(block.items ?? []).join('\n')}
          onChange={(event) => onChange({ items: event.target.value.split('\n') })}
        />
      </label>
    );
  }

  return (
    <div className="grid gap-3">
      <label className="flex flex-col gap-2">
        <span className="font-label-md text-on-surface">Título do bloco</span>
        <input
          aria-label={`Título do bloco ${blockNumber}`}
          className="min-h-11 rounded-lg border border-outline-variant bg-surface px-3"
          value={block.title ?? ''}
          onChange={(event) => onChange({ title: event.target.value })}
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="font-label-md text-on-surface">Texto do bloco</span>
        <textarea
          aria-label={`Texto do bloco ${blockNumber}`}
          className="min-h-24 rounded-lg border border-outline-variant bg-surface px-3 py-2"
          value={block.text ?? ''}
          onChange={(event) => onChange({ text: event.target.value })}
        />
      </label>
    </div>
  );
}
```

If the test expects a "Criar bloco" button, either update the test to match the simpler `Adicionar bloco` behavior or split add into select + create exactly as tested. Keep the final UI clear.

- [ ] **Step 6: Run dashboard route test and verify it passes**

Run:

```bash
pnpm run test -- src/dev-dashboard/__tests__/dashboardRoute.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit dashboard editor**

Run:

```bash
git add src/dev-dashboard/education/EducationDashboard.tsx src/dev-dashboard/__tests__/dashboardRoute.test.tsx
git commit -m "feat: edit education material detail blocks"
```

Expected: commit succeeds.

---

### Task 9: Export Bundle Coverage

**Files:**
- Modify: `src/dev-dashboard/__tests__/exportBundle.test.ts`
- Test: `src/dev-dashboard/__tests__/exportBundle.test.ts`

- [ ] **Step 1: Add export assertion for new fields**

Append this test to `src/dev-dashboard/__tests__/exportBundle.test.ts`:

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

Also update the base `material` object in this file with:

```ts
featuredImage: { kind: 'catalog', imageId: 'hands-holding-plant' },
```

- [ ] **Step 2: Run export bundle test**

Run:

```bash
pnpm run test -- src/dev-dashboard/__tests__/exportBundle.test.ts
```

Expected: PASS. The export logic compares full records generically, so this should not need implementation changes.

- [ ] **Step 3: Commit export coverage**

Run:

```bash
git add src/dev-dashboard/__tests__/exportBundle.test.ts
git commit -m "test: cover education material detail export"
```

Expected: commit succeeds.

---

### Task 10: Focus Retention Regression Test

**Files:**
- Modify: `src/dev-dashboard/__tests__/dashboardRoute.test.tsx`
- Test: `src/dev-dashboard/__tests__/dashboardRoute.test.tsx`

- [ ] **Step 1: Add focus retention test for body block editing**

Append this test to `src/dev-dashboard/__tests__/dashboardRoute.test.tsx`:

```ts
it('keeps focus while editing a material body block', async () => {
  const user = userEvent.setup();

  render(
    <MemoryRouter>
      <DashboardRoute />
    </MemoryRouter>,
  );

  fireEvent.click(screen.getByRole('tab', { name: 'Materiais' }));

  const bodyInput = screen.getByLabelText('Texto do bloco 1');
  await user.click(bodyInput);
  await user.keyboard('s');

  expect(screen.getByLabelText('Texto do bloco 1')).toHaveFocus();
});
```

- [ ] **Step 2: Run dashboard route test**

Run:

```bash
pnpm run test -- src/dev-dashboard/__tests__/dashboardRoute.test.tsx
```

Expected: PASS. If this fails, inspect `EducationDashboard.tsx` and verify body block containers use `key={block.id}` and `createBodyBlock` is only called from add-block actions.

- [ ] **Step 3: Commit focus regression coverage**

Run:

```bash
git add src/dev-dashboard/__tests__/dashboardRoute.test.tsx
git commit -m "test: cover material block editor focus"
```

Expected: commit succeeds.

---

### Task 11: Final Verification

**Files:**
- No source changes expected.

- [ ] **Step 1: Run targeted tests**

Run:

```bash
pnpm run test -- src/features/education/__tests__/EducationScreens.test.tsx
pnpm run test -- src/dev-dashboard/__tests__/dashboardRoute.test.tsx
pnpm run test -- src/dev-dashboard/__tests__/educationValidation.test.ts
pnpm run test -- src/dev-dashboard/__tests__/exportBundle.test.ts
pnpm run test -- src/content/__tests__/content.test.ts
```

Expected: all commands PASS.

- [ ] **Step 2: Run typecheck**

Run:

```bash
pnpm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run build**

Run:

```bash
pnpm run build
```

Expected: PASS.

- [ ] **Step 4: Run full check if practical**

Run:

```bash
pnpm run check
```

Expected: PASS. If it fails due to unrelated pre-existing formatting or test changes, capture the exact failing files and do not modify unrelated user work without approval.

- [ ] **Step 5: Inspect final git status**

Run:

```bash
git status --short
```

Expected: only intended feature files are modified or the worktree is clean after commits. Pre-existing unrelated modifications to `src/dev-dashboard/__tests__/dashboardRoute.test.tsx` or `src/dev-dashboard/flows/FlowEditor.tsx` must not be reverted.
