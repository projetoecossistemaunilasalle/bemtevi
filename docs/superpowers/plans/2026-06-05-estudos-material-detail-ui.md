# Estudos Material Detail UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the public Estudos material detail UI and dashboard editing UI on top of the material detail data/logic foundation.

**Architecture:** Public screens consume `resolveEducationResourcesForPreview()` and render structured resource blocks. The dashboard edits the same `EducationResource` fields through clear, local controls: featured image source, list thumbnail URL, body blocks, and up/down reorder actions. This plan optimizes for UI clarity, accessibility, focus retention, and preview-state communication.

**Tech Stack:** React 19, React Router, TypeScript, Tailwind CSS v4, lucide-react icons, Testing Library, Vitest.

---

## Dependency

Run `docs/superpowers/plans/2026-06-05-estudos-material-detail-logic.md` first. This UI plan assumes these already exist:

- `src/content/resources/featuredImages.ts`
- `src/features/education/educationResourcePreview.ts`
- `src/features/education/videoEmbeds.ts`
- `EducationResource.featuredImage`
- expanded `EducationResourceBlock` kinds

---

## File Structure

- Modify: `src/features/education/EducationLibraryScreen.tsx`
  - Reads preview-resolved resources and displays compact draft warning.
- Modify: `src/features/education/ResourceDetailScreen.tsx`
  - Renders the full detail page with featured image, content blocks, video embed/fallback, source link, and warning.
- Modify: `src/dev-dashboard/education/EducationDashboard.tsx`
  - Adds thumbnail URL field, featured-image editor, body block editor, and up/down reorder controls.
- Modify tests:
  - `src/features/education/__tests__/EducationScreens.test.tsx`
  - `src/dev-dashboard/__tests__/dashboardRoute.test.tsx`

---

### Task 1: Public Detail Screen Tests

**Files:**

- Modify: `src/features/education/__tests__/EducationScreens.test.tsx`
- Test: `src/features/education/__tests__/EducationScreens.test.tsx`

- [ ] **Step 1: Add public detail rendering assertions**

Update the existing `renders configured resources and navigates to the detail route` test so after clicking `Ver material` it includes:

```ts
expect(screen.getByRole('heading', { name: resource.title })).toBeInTheDocument();
expect(screen.getByText('Sobre este material')).toBeInTheDocument();
expect(screen.getByText('Aplicação prática')).toBeInTheDocument();
expect(screen.getByRole('link', { name: /acessar fonte original/i })).toHaveAttribute(
  'href',
  'https://www.feevale.br/',
);
```

- [ ] **Step 2: Add preview warning detail test**

Add:

```ts
it('previews local dashboard drafts with a warning banner', () => {
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

- [ ] **Step 3: Add generic video fallback UI test**

Add:

```ts
it('renders generic video URLs as full-card links instead of broken embeds', () => {
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

  expect(screen.getByRole('link', { name: /vídeo externo abrir vídeo externo/i })).toHaveAttribute(
    'href',
    'https://example.com/video',
  );
  expect(screen.queryByTitle('Vídeo externo')).not.toBeInTheDocument();
});
```

Ensure the file has:

```ts
beforeEach(() => {
  localStorage.clear();
});
```

- [ ] **Step 4: Run education screen tests**

Run:

```bash
pnpm run test -- src/features/education/__tests__/EducationScreens.test.tsx
```

Expected: FAIL because the public UI still renders the current minimal detail surface.

---

### Task 2: Public Library And Detail UI

**Files:**

- Modify: `src/features/education/EducationLibraryScreen.tsx`
- Modify: `src/features/education/ResourceDetailScreen.tsx`
- Test: `src/features/education/__tests__/EducationScreens.test.tsx`

- [ ] **Step 1: Wire library screen to preview resolver**

In `src/features/education/EducationLibraryScreen.tsx`, remove `resourcesContent` import and add:

```ts
import { resolveEducationResourcesForPreview } from './educationResourcePreview';
```

Inside `EducationLibraryScreen`:

```ts
const { resources, isPreviewingDrafts } = resolveEducationResourcesForPreview();
```

Replace:

```tsx
{resourcesContent.resources.map((resource) => (
```

with:

```tsx
{resources.map((resource) => (
```

Add above the `<section>` grid:

```tsx
{
  isPreviewingDrafts ? (
    <div className="rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 font-body-md text-yellow-900">
      Essa é uma versão de teste. O conteúdo não está salvo no site oficial.
    </div>
  ) : null;
}
```

- [ ] **Step 2: Replace detail screen implementation**

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
        {resource.body?.map((block) => (
          <ResourceBodyBlock key={block.id} block={block} source={resource.source} />
        ))}
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
          {block.items
            ?.filter((item) => item.trim())
            .map((item, index) => (
              <li key={`${block.id}-${index}`}>{item}</li>
            ))}
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
      <a
        className="flex items-center gap-4 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5 transition-colors hover:bg-surface-container"
        href={video.url}
        rel="noreferrer"
        target="_blank"
      >
        <div className="flex h-16 w-20 shrink-0 items-center justify-center rounded-xl bg-inverse-surface text-inverse-on-surface">
          <Play size={28} />
        </div>
        <div className="flex-1">
          {block.title ? <h2 className="font-headline-sm text-on-surface">{block.title}</h2> : null}
          <span className="mt-1 inline-flex items-center gap-1 font-label-md text-primary">
            Abrir vídeo externo
            <ExternalLink size={14} />
          </span>
        </div>
      </a>
    );
  }

  if (block.kind === 'sourceLink' && block.url) {
    return (
      <Card className="p-5">
        <p className="font-body-md text-on-surface-variant">Fonte do material</p>
        <p className="font-headline-sm text-on-surface">{source}</p>
        <a
          className="mt-2 inline-flex items-center gap-2 font-label-md text-primary"
          href={block.url}
          rel="noreferrer"
          target="_blank"
        >
          {block.label ?? 'Acessar fonte original'}
          <ExternalLink size={16} />
        </a>
      </Card>
    );
  }

  return null;
}
```

- [ ] **Step 3: Run public education tests**

Run:

```bash
pnpm run test -- src/features/education/__tests__/EducationScreens.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Commit public UI**

Run:

```bash
git add src/features/education/EducationLibraryScreen.tsx src/features/education/ResourceDetailScreen.tsx src/features/education/__tests__/EducationScreens.test.tsx
git commit -m "feat: render education material detail UI"
```

Expected: commit succeeds.

---

### Task 3: Dashboard UI Tests

**Files:**

- Modify: `src/dev-dashboard/__tests__/dashboardRoute.test.tsx`
- Test: `src/dev-dashboard/__tests__/dashboardRoute.test.tsx`

- [ ] **Step 1: Add featured image editor test**

Append:

```ts
it('edits the featured image with catalog and external URL modes', () => {
  render(
    <MemoryRouter>
      <DashboardRoute />
    </MemoryRouter>,
  );

  fireEvent.click(screen.getByRole('tab', { name: 'Materiais' }));

  expect(screen.getByRole('group', { name: 'Imagem principal do material' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /mãos segurando uma planta pequena/i })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  fireEvent.click(screen.getByRole('radio', { name: 'Usar URL externa' }));
  fireEvent.change(screen.getByLabelText('URL da imagem principal'), {
    target: { value: 'https://example.com/main.jpg' },
  });

  expect(screen.getByDisplayValue('https://example.com/main.jpg')).toBeInTheDocument();
});
```

- [ ] **Step 2: Add block editor test**

Append:

```ts
it('adds, edits, and reorders material body blocks', () => {
  render(
    <MemoryRouter>
      <DashboardRoute />
    </MemoryRouter>,
  );

  fireEvent.click(screen.getByRole('tab', { name: 'Materiais' }));
  fireEvent.change(screen.getByLabelText('Tipo do novo bloco'), { target: { value: 'video' } });
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar bloco' }));
  fireEvent.change(screen.getByLabelText('Título do bloco 2'), { target: { value: 'Vídeo de teste' } });
  fireEvent.change(screen.getByLabelText('URL do vídeo do bloco 2'), {
    target: { value: 'https://www.youtube.com/watch?v=abcdef12345' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Mover bloco 2 para cima' }));

  expect(screen.getByDisplayValue('Vídeo de teste')).toBeInTheDocument();
  expect(screen.getByDisplayValue('https://www.youtube.com/watch?v=abcdef12345')).toBeInTheDocument();
});
```

- [ ] **Step 3: Add focus retention test**

Append:

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

- [ ] **Step 4: Run dashboard route tests**

Run:

```bash
pnpm run test -- src/dev-dashboard/__tests__/dashboardRoute.test.tsx
```

Expected: FAIL because the dashboard UI controls do not exist.

---

### Task 4: Dashboard Featured Image And Block Editor

**Files:**

- Modify: `src/dev-dashboard/education/EducationDashboard.tsx`
- Test: `src/dev-dashboard/__tests__/dashboardRoute.test.tsx`

- [ ] **Step 1: Add imports**

In `src/dev-dashboard/education/EducationDashboard.tsx`, add:

```ts
import { defaultFeaturedImageId, featuredImageOptions } from '../../content/resources/featuredImages';
import type { EducationResourceBlock, EducationResourceFeaturedImage } from '../../domain/resources/types';
```

- [ ] **Step 2: Add body editor helpers inside `EducationDashboard`**

Inside the component, add:

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

- [ ] **Step 3: Add `createBodyBlock` helper below the component**

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

Generate IDs only when adding blocks. Render existing blocks with `key={block.id}`.

- [ ] **Step 4: Add featured image UI after source/type/link fields**

Add this section near the material metadata fields:

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
        onChange={() => updateFeaturedImage({ kind: 'catalog', imageId: defaultFeaturedImageId })}
      />
      Usar imagem padrão
    </label>
    <label className="flex items-center gap-2 font-label-md text-on-surface">
      <input
        checked={selectedResource.featuredImage?.kind === 'external'}
        name="featured-image-kind"
        type="radio"
        onChange={() => updateFeaturedImage({ kind: 'external', imageUrl: selectedResource.imageUrl ?? '' })}
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
            selectedResource.featuredImage?.kind === 'catalog' && selectedResource.featuredImage.imageId === option.id
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
        onChange={(event) => updateFeaturedImage({ kind: 'external', imageUrl: event.target.value })}
      />
    </label>
  )}
</fieldset>
```

- [ ] **Step 5: Add body block editor UI**

Before `<ValidationSummary result={validation} />`, add a `Conteúdo do material` section that:

- renders `(selectedResource.body ?? []).map((block, blockIndex) => ...)` with `key={block.id}`;
- provides `Mover bloco N para cima`, `Mover bloco N para baixo`, and `Remover bloco`;
- uses a `select` labeled `Tipo do novo bloco`;
- adds blocks through one `Adicionar bloco` button after the selected type is set.

Use a helper component with these labels so tests and screen readers have stable targets:

```tsx
<BlockFields block={block} blockNumber={blockIndex + 1} onChange={(patch) => updateBlock(block.id, patch)} />
```

The `BlockFields` component must expose:

- `Título do bloco N` for paragraph, heading, and video title inputs.
- `Texto do bloco N` for paragraph text.
- `URL do vídeo do bloco N` for video URLs.
- `URL da imagem do bloco N` and `Descrição da imagem do bloco N` for image blocks.
- `Itens da lista do bloco N` for list textarea values split by newline.
- `Texto do link do bloco N` and `URL da fonte do bloco N` for source links.

- [ ] **Step 6: Run dashboard route tests**

Run:

```bash
pnpm run test -- src/dev-dashboard/__tests__/dashboardRoute.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit dashboard UI**

Run:

```bash
git add src/dev-dashboard/education/EducationDashboard.tsx src/dev-dashboard/__tests__/dashboardRoute.test.tsx
git commit -m "feat: edit education material detail UI"
```

Expected: commit succeeds.

---

### Task 5: UI Verification

**Files:**

- No source changes expected.

- [ ] **Step 1: Run public and dashboard UI tests**

Run:

```bash
pnpm run test -- src/features/education/__tests__/EducationScreens.test.tsx
pnpm run test -- src/dev-dashboard/__tests__/dashboardRoute.test.tsx
```

Expected: both commands PASS.

- [ ] **Step 2: Run typecheck and build**

Run:

```bash
pnpm run typecheck
pnpm run build
```

Expected: both commands PASS.

- [ ] **Step 3: Run full check if practical**

Run:

```bash
pnpm run check
```

Expected: PASS. If it fails due to unrelated pre-existing edits, report exact failing files and do not revert user changes.

- [ ] **Step 4: Inspect git status**

Run:

```bash
git status --short
```

Expected: only intended UI files remain modified, or worktree is clean after commits. Existing unrelated edits in `src/dev-dashboard/__tests__/dashboardRoute.test.tsx` or `src/dev-dashboard/flows/FlowEditor.tsx` must not be reverted.
