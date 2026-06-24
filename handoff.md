# Handoff: Education Resource Groups Implementation

## Branch

`feature/education-resource-groups`

## Overall Status

- **Tasks 1–7 of the plan** (`docs/superpowers/plans/2026-06-15-education-resource-groups.md`) are **complete and verified** — all 270 tests pass, typecheck, lint, format, and build all pass.
- **New UX-rewrite request is in progress** and blocked.

## What the User Asked For (UX Rewrite)

User wants the group management UI redesigned:

1. Keep the per-material **"Grupo" dropdown** (assign material to group)
2. **Remove** the per-material **"Ordem no grupo" numeric input**
3. Move group management to the **TOP of Dashboard > Materiais tab** as a full-width, always-visible section
4. Group editor per item should have:
   - Title input
   - Optional description textarea (requires adding `description?: string` to `EducationResourceGroup`)
   - "Mover para cima" / "Mover para baixo" buttons instead of a numeric `order` input
   - Remove button only for local groups
   - Add new group button

## Completed Work So Far

- ✅ `src/content/resources/groups.ts` — added `description?: string` to `EducationResourceGroup`
- ✅ `src/dev-dashboard/DashboardRoute.tsx` — added `onGroupMove` handler that swaps `order` between adjacent groups
- ✅ `src/dev-dashboard/__tests__/dashboardRoute.test.tsx` — updated mock data and added description/move tests
- ❌ `src/dev-dashboard/education/EducationDashboard.tsx` — **reverted to HEAD due to a test regression**

## Blocker

The implementer agent's changes to `EducationDashboard.tsx` broke this test:

```
src/dev-dashboard/__tests__/dashboardRoute.test.tsx > DashboardRoute > keeps focus while editing a material body block
```

When typing in a body-block textarea, focus is lost. The test passes with HEAD's `EducationDashboard.tsx` and fails with the agent's version. The agent rewrote the JSX to:

- Remove `groupsExpanded` state (groups always visible)
- Add `onGroupMove` prop
- Move group section to the top (outside the two-column grid, wrapped in a new `<div>`)
- Add description textareas to group items
- Replace numeric `order` input with up/down move buttons
- Remove "Ordem no grupo" from material editor

The specific line of code causing the regression was **identified** in the agent's diff but not isolated yet.

## Working Tree (clean)

All source files are at their last known-good state (HEAD). Only untracked docs remain:

```
?? .kimchi/docs/plan-ux-rewrite.md
?? .kimchi/handoff.md
```

## The Agent's Attempt (for reference)

You can inspect the agent's full diff with:

```bash
git diff feature/education-resource-groups -- src/dev-dashboard/education/EducationDashboard.tsx
```

To inspect the other files it changed:

```bash
git diff feature/education-resource-groups -- src/content/resources/groups.ts src/dev-dashboard/DashboardRoute.tsx src/dev-dashboard/__tests__/dashboardRoute.test.tsx
```

## Next Steps

1. Inspect the agent's `EducationDashboard.tsx` diff to find the exact change that breaks focus in body blocks.
2. Likely culprits:
   - New group section with textareas being always-visible and re-rendering during material edits
   - React reconciliation differences from the new `<div>` wrapper or section reordering
   - State/prop changes causing textarea remount
3. Apply the minimal set of `EducationDashboard.tsx` changes (title/description/up/down/remove + move group section to top + remove groupOrder) while preserving focus.
4. Verify with `pnpm vitest run src/dev-dashboard/__tests__/dashboardRoute.test.tsx`
