# Education Resource Groups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let dashboard admins organize education materials into ordered named groups while keeping ungrouped and invalidly-grouped materials visible in the implicit default group.

**Architecture:** Add groups as a shipped-content catalog and draftable dashboard record type. The implicit `geral` group remains runtime-only, always renders first without a heading, and acts as the fallback for missing or dangling references. Draft and export schemas move to v2; shipped groups cannot be deleted, while locally added groups can.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, localStorage

---

## Locked Decisions

- `geral` is reserved, runtime-only, always first, and never shown as a heading.
- A resource with `group` missing, equal to `geral`, or referencing an unknown group renders in `geral`.
- Dangling references remain validation warnings because rendering safely falls back.
- Only locally added groups can be removed. Shipped groups can be edited but not deleted.
- `groupOrder` is editable in the dashboard and controls order within a group; missing values sort last.
- Group descriptions are omitted from this iteration because they have no editing or rendering use.
- Keep localStorage key `bemtevi:dev-dashboard:drafts:v1` so the existing value can be migrated in place.
- Bump both draft and export schemas from `1.0.0` to `2.0.0`.

## File Map

- Create `src/content/resources/groups.ts`: shipped named-group catalog.
- Modify `src/domain/resources/types.ts`: group type, default ID, resource grouping fields.
- Modify dashboard storage/content/export/validation/route/UI files to draft, validate, edit, and export groups.
- Modify education preview/library files to resolve drafts and render grouped sections.
- Modify the existing content, storage, validation, export, and screen test files.

### Task 1: Add Domain Model and Shipped Catalog

**Files:** `src/domain/resources/types.ts`, `src/content/resources/groups.ts`, `src/content/__tests__/content.test.ts`

- [ ] Write failing catalog tests for required `id`, `title`, numeric `order`, unique IDs, and rejection of reserved ID `geral`.
- [ ] Run `pnpm run test -- src/content/__tests__/content.test.ts`; expect failures for the missing catalog.
- [ ] Add:

```ts
export interface EducationResourceGroup {
  id: string;
  title: string;
  order: number;
}
export const DEFAULT_EDUCATION_GROUP_ID = 'geral' as const;
```

- [ ] Add optional `group?: string` and `groupOrder?: number` to `EducationResource`.
- [ ] Export `educationResourceGroups: EducationResourceGroup[] = []`.
- [ ] Run the focused test; expect PASS.
- [ ] Commit: `feat: add education resource group model`

### Task 2: Add Draft Schema v2 and Migration

**Files:** `src/dev-dashboard/content/shippedContent.ts`, `src/dev-dashboard/draft-storage/dashboardStorage.ts`, `src/dev-dashboard/__tests__/dashboardStorage.test.ts`

- [ ] Write failing tests for shipped groups, group patches/additions, and v1-to-v2 migration preserving all existing fields.
- [ ] Run the focused storage tests; expect FAIL.
- [ ] Add `educationGroups` to shipped and merged content; add `groupPatches` and `addedGroups` to draft state.
- [ ] Keep the storage key unchanged; migrate parsed `1.0.0` values to `2.0.0`, and reset unknown versions.
- [ ] Run focused tests; expect PASS.
- [ ] Commit: `feat: persist education group drafts`

### Task 3: Add Group Validation

**Files:** `src/dev-dashboard/education/educationValidation.ts`, `src/dev-dashboard/__tests__/educationValidation.test.ts`

- [ ] Write failing tests for duplicate IDs, reserved `geral`, empty titles, dangling references, and valid missing/default references.
- [ ] Change signature to `validateDashboardEducation(resources, groups)`.
- [ ] Emit errors `duplicate-group-id:{id}` and `reserved-group-id:geral`; emit warnings `empty-group-title:{id}` and `dangling-group:{resourceId}`.
- [ ] Update every caller and existing test to pass groups.
- [ ] Run focused tests; expect PASS.
- [ ] Commit: `feat: validate education groups`

### Task 4: Add Export Schema v2

**Files:** `src/dev-dashboard/export/exportBundle.ts`, `src/dev-dashboard/export/ExportDashboard.tsx`, `src/dev-dashboard/__tests__/exportBundle.test.ts`

- [ ] Write failing tests proving changed groups export and unchanged groups do not.
- [ ] Add `educationGroups` to draft content and changes; bump export schema to `2.0.0`.
- [ ] Add `Grupos no arquivo: N` to the summary.
- [ ] Run focused tests; expect PASS.
- [ ] Commit: `feat: export education groups`

### Task 5: Add Dashboard Group Management

**Files:** `src/dev-dashboard/DashboardRoute.tsx`, `src/dev-dashboard/education/EducationDashboard.tsx`

- [ ] Add route wiring for groups, validation, and export.
- [ ] Generate collision-safe local IDs by finding the first unused `group-local-N`.
- [ ] Route edits to patches or additions by source index; allow removal only when the group is in `addedGroups`.
- [ ] Add the collapsible group editor with title/order inputs and remove buttons only for local groups.
- [ ] Add resource fields for group selection and numeric `groupOrder`; choosing Geral writes `group: undefined`.
- [ ] Run `pnpm run typecheck`; expect PASS.
- [ ] Commit: `feat: manage education groups in dashboard`

### Task 6: Resolve Preview and Render Groups

**Files:** `src/features/education/educationResourcePreview.ts`, `src/features/education/EducationLibraryScreen.tsx`, `src/features/education/__tests__/EducationScreens.test.tsx`

- [ ] Write failing tests for named headings, hidden empty groups, named-group ordering, `geral` always first, `groupOrder`, dangling fallback, and group-only draft warning.
- [ ] Return groups from preview resolution and treat group patches/additions as education drafts.
- [ ] Set `isPreviewingDrafts` when either resources or groups differ from shipped content.
- [ ] Implement grouping so `geral` is emitted first separately, named groups sort by `order`, resources sort by `groupOrder` with stable original-order ties, and unknown references fall back to `geral`.
- [ ] Render named headings only and reuse existing card markup.
- [ ] Run focused screen tests; expect PASS.
- [ ] Commit: `feat: render grouped education library`

### Task 7: Full Verification

- [ ] Run `pnpm run check`; expect all typecheck, lint, formatting, flow validation, tests, and build steps to pass.
- [ ] Run `pnpm run build` with `VITE_ENABLE_DEV_DASHBOARD=true`; expect PASS.
- [ ] Browser-check group creation, editing, resource assignment/order, default fallback, export counts/content, local-group removal, and localStorage clearing.
- [ ] Confirm shipped groups have no remove control and dangling resources remain visible under the unheaded default section.
- [ ] Commit any verification fixes, then rerun `pnpm run check`.
