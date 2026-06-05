# Estudos Material Detail Preview Design

## Context

The Estudos tab already has a library route at `/educacao`, a detail route at `/educacao/:resourceId`, and a local dashboard editor for education materials. The current detail screen is only a placeholder. The goal is to make `Ver material` open a complete second screen whose visible content can be edited through the dashboard, while preserving the current local-draft/export workflow.

The dashboard remains a prototype editor. It does not publish directly. Public education screens should preview local dashboard drafts by default when drafts exist, but must clearly communicate that the content is a test version and is not saved on the official site.

## Goals

- Render a complete Estudos material detail screen from structured material data.
- Let dashboard editors configure the main detail content, video, external images, source link, and material body.
- Let editors choose a banner from bundled default banner images by selecting thumbnails, not visible image names.
- Let editors reorder content blocks vertically with native up/down controls.
- Keep all edits in local dashboard draft/export data until a separate review/publish step applies them.
- Show a preview warning banner whenever local draft content is being previewed in the public app.

## Non-Goals

- No backend, authentication, upload flow, or direct publishing.
- No full rich text editor.
- No mouse/touch drag-and-drop in this iteration.
- No build-time or runtime download/caching pipeline for arbitrary external images.
- No claim that local preview content has been saved to the official site.

## Data Model

`EducationResource` should keep the existing list-card fields:

- `title`
- `description`
- `source`
- `imageUrl`
- `tags`
- `audience`
- `contentType`
- `externalUrl`
- `review`

It should gain a separate `bannerImageId` for the large hero image on the detail page. Banner images come from a local catalog, for example `src/content/resources/bannerImages.ts`, and are bundled with the app. Dashboard selection uses image thumbnails visually; internal names or IDs are used only for data and accessibility labels.

It should also gain an ordered content block array for the material detail page. The initial block set should be intentionally simple:

```ts
type EducationResourceDetailBlock =
  | { id: string; kind: 'heading'; text: string }
  | { id: string; kind: 'text'; title?: string; text: string }
  | { id: string; kind: 'image'; imageUrl: string; alt?: string }
  | { id: string; kind: 'video'; title: string; url: string; description?: string }
  | { id: string; kind: 'sourceLink'; label: string; url: string };
```

`imageUrl` remains an editable external image URL. It is not an upload field. The app renders it from the content JSON when a block or list-card field references it. If future publishing requires downloading and storing remote images, that should be designed as a separate import/publishing pipeline.

## Public UI

`/educacao` continues to list resources and route `Ver material` to `/educacao/:resourceId`.

`/educacao/:resourceId` should render:

- A back affordance labeled `Estudos`.
- Source/type badges.
- Material title and short description.
- The selected local banner image as the large hero image.
- Ordered detail blocks rendered as cards or inline sections.
- Video blocks as configurable embedded/link cards.
- Source-link blocks as accessible outbound links.
- A preview warning banner when local dashboard drafts are being used.

The preview warning should use direct Portuguese copy such as:

> Essa e uma versao de teste, o conteudo nao esta salvo no site oficial.

The exact implementation should preserve the repository's Portuguese-first tone and can use accented copy in UI files that already use Portuguese text.

## Dashboard UI

The `Materiais` dashboard tab should support:

- Editing the external `imageUrl`.
- Selecting `bannerImageId` from bundled banner thumbnails.
- Adding detail blocks by type.
- Editing block fields.
- Removing blocks.
- Moving blocks up or down.
- Seeing validation errors/warnings for invalid or incomplete content.

The banner picker should show only images visually. It should still provide accessible names for screen readers and a clear selected state through border, check mark, or equivalent visual treatment.

Reordering should use buttons such as `Mover para cima` and `Mover para baixo`. Native controls are acceptable for this iteration and are safer than adding a drag-and-drop dependency.

## Draft Preview Data Flow

The app should introduce a shared resolver for education resources that merges shipped content with local dashboard drafts, matching the dashboard's existing merge behavior. Public education screens should use the resolved resources instead of reading `resourcesContent.resources` directly.

The resolver should expose whether local drafts are active, for example:

```ts
{
  resources: EducationResource[];
  isPreviewingDrafts: boolean;
}
```

When `isPreviewingDrafts` is true, the public detail screen shows the preview warning. If feasible, the list screen can also show a smaller warning, but the detail screen warning is required because it is where draft body content is consumed.

The export bundle should continue to include complete changed material records. New fields such as `bannerImageId` and detail blocks must be included automatically as part of changed `EducationResource` objects.

## Validation

Education validation should continue to reject duplicate IDs and missing required metadata. It should also validate:

- Empty required block fields.
- Invalid URLs for image, video, and source-link blocks.
- Missing `bannerImageId` if the detail screen requires a banner.
- Unknown `bannerImageId` values.

Warnings are appropriate for non-blocking editorial gaps, such as a material with no detail blocks. Errors are appropriate for broken rendering or invalid URLs.

## Testing

Add or update tests for:

- Clicking `Ver material` renders the complete detail screen.
- Unknown resource IDs keep the existing safe fallback behavior.
- Draft resources are previewed by public education screens when local dashboard drafts exist.
- The preview warning appears when drafts are active.
- The dashboard can select a banner image by thumbnail.
- The dashboard can add, edit, remove, and reorder detail blocks.
- Validation catches incomplete blocks and invalid URLs.
- Export includes changed material records with banner and block fields.

Run at least:

```bash
pnpm run test -- src/features/education/__tests__/EducationScreens.test.tsx
pnpm run test -- src/dev-dashboard/__tests__/dashboardRoute.test.tsx
pnpm run test -- src/dev-dashboard/__tests__/educationValidation.test.ts
pnpm run test -- src/dev-dashboard/__tests__/exportBundle.test.ts
```

Before claiming implementation complete, run the repository's normal quality gate or the closest practical subset.

## Risks And Mitigations

Preview confusion is the main product risk. The detail screen must show a visible warning whenever local drafts are active.

External image URLs can break or disappear. The banner image uses bundled defaults to keep the primary detail visual stable; external URLs remain optional content fields.

Dashboard editor complexity can grow quickly. This design limits content editing to simple structured blocks and native reorder controls, avoiding a full editor or drag-and-drop dependency.

Clinical/editorial content risk remains unchanged. The feature makes content easier to edit, but does not approve or validate health guidance itself. Review metadata should remain visible in the model and export flow.
