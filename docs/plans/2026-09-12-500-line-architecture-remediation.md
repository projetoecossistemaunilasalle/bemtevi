# 500-Line Architecture Remediation Plan

Date: 2026-09-12

## Objective

Make `pnpm run check:architecture` pass after the repository-wide enormous-file threshold was lowered from 1,000 to
500 physical lines. Preserve runtime behavior, public exports, persisted-draft semantics, and all PT-BR content.

This is an organization-only change. Do not rewrite editorial copy and do not publish anything to Neon.

## Current Failure

The architecture command currently exits with code 1 and reports exactly these files:

| File                                                            | Lines | Category              |
| --------------------------------------------------------------- | ----: | --------------------- |
| `src/content/flows/documentFlows.ts`                            |   642 | Fallback flow data    |
| `src/content/flows/neutral.ts`                                  |   566 | Fallback flow data    |
| `src/content/services/canoas-services.ts`                       |   647 | Fallback service data |
| `src/dev-dashboard/__tests__/dashboardStorage.test.ts`          |   774 | Test suite            |
| `src/dev-dashboard/contacts/ContactsDashboard.tsx`              |   618 | Dashboard UI          |
| `src/dev-dashboard/flows/FlowDestinationMap.tsx`                |   648 | Dashboard UI          |
| `src/dev-dashboard/flows/__tests__/FlowDestinationMap.test.tsx` |   533 | Test suite            |
| `src/features/education/__tests__/EducationScreens.test.tsx`    |   597 | Test suite            |

The architecture budgets are stricter than the enormous-file ceiling:

- Ordinary `.ts` files: 300 lines.
- Ordinary `.tsx` files: 320 lines.
- Test files: 500 lines.
- `.mjs` files: 320 lines.
- No scanned file may exceed 500 lines, even if it has a baseline entry.

Do not add new entries to `scripts/architecture-baseline.json`. New modules must fit the ordinary budget for their
file kind. Remove only the obsolete baseline entries made unnecessary by this work.

## Guardrails

1. Start with `git status --short` and `git diff`. The threshold changes in
   `scripts/check-architecture.mjs` and `scripts/__tests__/check-architecture.test.ts` are pre-existing user work.
   Do not revert or rewrite them.
2. Preserve the existing public imports: `documentFlows`, `neutralFlows`, and `canoasServices` must remain available
   from their current module paths unless the plan explicitly says otherwise.
3. Move data verbatim. Do not alter IDs, versions, node order, option order, effects, service order, phone numbers,
   addresses, coordinates, review status, or user-visible text.
4. Keep `src/content` work limited to fallback organization. Neon remains the canonical editorial source.
5. Prefer named, cohesive modules over arbitrary `part-1` or `helpers` files.
6. Do not weaken the architecture checker, raise the 500-line threshold, or inflate baseline allowances.
7. After each workstream, run its focused tests and `pnpm run check:architecture`. Run the full `pnpm run check` at
   the end. Never push if the full check is not green.

## Execution Order

Complete the workstreams in the order below. Do not attempt all moves in one edit. Run formatting and focused tests
after each workstream so syntax or import mistakes remain easy to locate.

### 1. Split `documentFlows.ts` by top-level flow

Create `src/content/flows/document/` and move each complete `GuidedFlow` object into a named module:

- `understandFeelings.ts`: `orientation-understand-feelings` (currently starts near line 22).
- `organizeExperience.ts`: `orientation-organize-experience` (near line 184).
- `nextCareStep.ts`: `orientation-next-care-step` (near line 361).
- `calmMoment.ts`: `orientation-calm-moment` (near line 477).
- `postFlowNextStep.ts`: `post-flow-next-step` (near line 595).

Move the shared `close` and `ending` builders to `src/content/flows/document/documentFlowBuilders.ts`. Import
`flowVisuals` only in modules that use it. Each flow module should export one clearly named object and validate it
with `satisfies GuidedFlow`.

Reduce `documentFlows.ts` to imports plus the ordered `documentFlows` array. Keep its current export name and exact
array order so `src/content/flows/registry.ts` requires no behavior change.

Verification:

```powershell
pnpm run validate:flows
pnpm run test:unit -- src/content/__tests__/content.test.ts
pnpm run check:architecture
```

### 2. Split `neutral.ts` by top-level flow

`neutralFlows` currently has no runtime importer, but do not delete it as part of this task. Preserving the data avoids
turning an architecture refactor into a content-lifecycle decision.

Create `src/content/flows/neutral/` with one module for each flow:

- `understandFeelings.ts`: `orientation-understand-feelings` (near line 4).
- `talkThroughExperience.ts`: `orientation-talk-through-experience` (near line 265).
- `nextCareStep.ts`: `orientation-next-care-step` (near line 348).
- `calmMoment.ts`: `orientation-calm-moment` (near line 427).
- `postFlowNextStep.ts`: `post-flow-next-step` (near line 479).

Make `neutral.ts` a small ordered aggregator that continues to export `neutralFlows`. Use `satisfies GuidedFlow` on
each individual flow and `satisfies GuidedFlow[]` on the aggregate. Do not reconcile these flows with the newer
document flows and do not change their versions or wording.

Verification:

```powershell
pnpm run validate:flows
pnpm run typecheck
pnpm run check:architecture
```

### 3. Split `canoas-services.ts` by municipality

Create `src/content/services/canoas/`. Extract ordered `ServiceDirectoryEntry[]` arrays along the existing comment
boundaries:

- `canoas.ts`: Canoas emergency care, CAPS, UBS, and university clinic entries.
- `saoLeopoldo.ts`: São Leopoldo entries.
- `novoHamburgo.ts`: Novo Hamburgo entries.
- `esteioSapucaia.ts`: Esteio and Sapucaia do Sul entries.
- `portoAlegre.ts`: Porto Alegre entries.

Put the shared immutable review object in `pendingReview.ts`. Name it descriptively, export it, and reuse the same
object shape in every service entry. Each city module must use `satisfies ServiceDirectoryEntry[]`.

Keep `src/content/services/canoas-services.ts` as the public metadata object and concatenate the extracted arrays in
the exact current order. The final object must still use `satisfies ServicesContent` and retain the `canoasServices`
export.

Verification:

```powershell
pnpm run test:unit -- src/content/__tests__/content.test.ts
pnpm run test:unit -- src/features/contacts/__tests__/ContactsScreen.test.tsx
pnpm run typecheck
pnpm run check:architecture
```

### 4. Decompose `ContactsDashboard.tsx`

Keep `ContactsDashboard` as the stateful coordinator for stable service selection, external validation focus, add and
remove behavior, and the public callback contract.

Extract these leaf components:

- `ContactFields.tsx`: move the existing `ContactFields` component and field-specific issue lookup. Move
  `fieldClass` and `mergeFieldIssues` with it unless another extracted component also needs them.
- `ContactLocationManager.tsx`: render location rows, location validation, add/remove controls, and location callbacks.
- `ContactDirectoryList.tsx`: render grouped services, selected state, error badges, and service-selection buttons.
- `contactValidationNavigation.ts`: pure validation-path normalization and path parsing. Keep state-changing issue
  actions in the coordinator.

Use explicit prop types. Do not duplicate selection calculations or validation lookup logic. Preserve focus behavior
after deletion, `externalFocus.requestId` handling, location management disclosure state, ARIA labels, and all PT-BR
copy. Keep `ContactsDashboard.tsx` below 320 lines and every extracted `.tsx` file below 320 lines.

Find the existing contacts/dashboard tests before editing and run all directly related suites. At minimum:

```powershell
pnpm run test:unit -- src/dev-dashboard/contacts
pnpm run test:unit -- src/dev-dashboard/__tests__/dashboardRoute.contacts.test.tsx
pnpm run typecheck
pnpm run check:architecture
```

If the exact route test filename differs, use `rg --files src/dev-dashboard | rg "contact.*test|dashboardRoute.*test"`
and run the matching files instead of skipping the check.

### 5. Decompose `FlowDestinationMap.tsx`

Keep `FlowDestinationMap` as the coordinator that composes topology analysis, editor state, canvas state, and the node
editor panel. Reuse the existing `flowDestinationAnalysis`, layout, presentation, mutation, and model modules; do not
reimplement their algorithms.

First extract presentational sections:

- `FlowDestinationIndex.tsx`: structural statistics and reachable-destination chips.
- `FlowDestinationToolbar.tsx`: search, label toggle, sequence expansion, fit-view action, and add-stage menu.
- `FlowDestinationCanvas.tsx`: `ReactFlow`, background, controls, minimap, viewport options, and unreachable strip.
- `FlowDestinationSelection.tsx`: selected-destination status overlay.

Then measure `FlowDestinationMap.tsx`. If it remains over 320 lines, extract behavior by responsibility rather than
moving everything into one oversized hook:

- `useFlowDestinationEditing.ts`: connected-stage creation, terminal effects, option/branch creation, node selection,
  stage creation, panel focus requests, and external focus application.
- `useFlowDestinationCanvas.ts`: React Flow node/edge state synchronization, pointer-versus-pan tracking, edge-click
  centering, and React Flow instance state.
- A small pure connection resolver may be introduced if it eliminates the long destination-prefix conditional, but
  it must delegate actual immutable changes to the existing mutation functions.

Preserve these behaviors explicitly:

- Connecting to navigation, flow-start, end-flow, result, and ordinary node targets.
- Ignoring drags and long presses when deciding whether an edge was clicked.
- Reapplying the same focused section when `requestId` changes.
- Ignoring focus requests for missing nodes.
- Returning focus after closing the editor or add-stage menu.
- Compact viewport behavior at 620px and the existing React Flow options.
- Node editor remounting by `selectedNode.id`.

All new `.ts` hooks must remain below 300 lines and all `.tsx` components below 320 lines.

Verification:

```powershell
pnpm run test:unit -- src/dev-dashboard/flows/__tests__/FlowDestinationMap.test.tsx
pnpm run typecheck
pnpm run check:architecture
```

Run the old test path at this stage before splitting it in the next workstream.

### 6. Split `dashboardStorage.test.ts`

Create `src/dev-dashboard/__tests__/dashboardStorageTestFixtures.ts` for `emptyDraft`, the canonical contact fixture,
and small builders used by more than one suite. Keep the support file below the ordinary 300-line `.ts` budget.

Divide the tests by behavior:

- `dashboardStorage.lifecycle.test.ts`: empty state, save/load, clear/reset, base revision/content, unavailable storage,
  JSON import/export, quota failure, and IndexedDB fallback precedence.
- `dashboardStorage.migrations.test.ts`: v1/v2/v3/v4/v6 migration and malformed/unknown schema cases.
- `dashboardStorage.merge.test.ts`: sparse patches, removals, default group order, duplicate IDs, source-index rebasing,
  reordered records, and unique flow/education patches.
- Put shipped-content assertions in `dashboardStorage.lifecycle.test.ts` unless a dedicated file is clearer.

Move tests without changing assertions. Retain `beforeEach` isolation in every file that touches `localStorage`, and
retain mock restoration where required. Delete the original test only after every case exists in a replacement suite.

Verification:

```powershell
pnpm run test:unit -- src/dev-dashboard/__tests__/dashboardStorage.lifecycle.test.ts
pnpm run test:unit -- src/dev-dashboard/__tests__/dashboardStorage.migrations.test.ts
pnpm run test:unit -- src/dev-dashboard/__tests__/dashboardStorage.merge.test.ts
pnpm run check:architecture
```

### 7. Split `FlowDestinationMap.test.tsx`

Create `FlowDestinationMapTestHarness.tsx` beside the existing tests. Move the `flow` and `focusFlow` fixtures,
`renderMap`, `renderStatefulMap`, topology mock setup, and shared cleanup into that support module. Keep it below 320
lines because it is a non-test `.tsx` file.

Create these suites:

- `FlowDestinationMap.navigation.test.tsx`: statistics, ports, destination selection, opening connected flows,
  unreachable stages, search, and editor opening.
- `FlowDestinationMap.mutations.test.tsx`: add-stage, contextual add, terminal effect, option/branch addition, deletion,
  and sequence compaction.
- `FlowDestinationMap.focus.test.tsx`: focus requests, repeated requests, manual selection clearing, settings requests,
  missing nodes, and option/text focused modes.

Keep the existing `scrollStubs` helper. Preserve the topology mock and restore mocks after every test. Delete the old
combined file only after the three new suites pass.

Verification:

```powershell
pnpm run test:unit -- src/dev-dashboard/flows/__tests__/FlowDestinationMap.navigation.test.tsx
pnpm run test:unit -- src/dev-dashboard/flows/__tests__/FlowDestinationMap.mutations.test.tsx
pnpm run test:unit -- src/dev-dashboard/flows/__tests__/FlowDestinationMap.focus.test.tsx
pnpm run check:architecture
```

### 8. Split `EducationScreens.test.tsx`

Reuse `educationScreensTestUtils.tsx`; do not duplicate its content-provider setup or shipped-content lookup logic.
Move tests into:

- `EducationLibraryScreen.test.tsx`: library rendering, navigation, card source behavior, group headings/order, default
  group handling, dangling group references, and resource ordering.
- `educationResourcePreview.test.ts`: local material/group draft preview, changed IDs, removals, unchanged patches, and
  preview-warning state.
- `videoEmbeds.test.ts`: YouTube, Instagram post/reel, and generic-link resolution.
- `ResourceDetailScreen.test.tsx`: published resources/groups, route lookup, and preserved line breaks.

Each file that uses local storage must clear it independently. Keep dynamic imports where the existing tests use them
to avoid module-cache state leaking between cases.

Verification:

```powershell
pnpm run test:unit -- src/features/education/__tests__
pnpm run check:architecture
```

### 9. Clean the architecture baseline

After all original files are below their ordinary budgets or have been replaced by small aggregators, remove these
eight obsolete keys from `scripts/architecture-baseline.json`:

```text
src/content/flows/documentFlows.ts
src/content/flows/neutral.ts
src/content/services/canoas-services.ts
src/dev-dashboard/__tests__/dashboardStorage.test.ts
src/dev-dashboard/contacts/ContactsDashboard.tsx
src/dev-dashboard/flows/FlowDestinationMap.tsx
src/dev-dashboard/flows/__tests__/FlowDestinationMap.test.tsx
src/features/education/__tests__/EducationScreens.test.tsx
```

Some test files will no longer exist, which is expected. Do not alter unrelated baseline entries.

## Final Verification

Run these commands from the repository root:

```powershell
git diff --check
pnpm run format
pnpm run check:architecture
pnpm run check
git status --short
git diff --stat
```

If `pnpm run check` fails, fix the reported issue and rerun the entire command until it exits with code 0. Do not
report success based only on focused tests. Do not push unless explicitly asked, and never push without the full gate.

## Definition of Done

- `pnpm run check:architecture` exits with code 0 and reports zero files over 500 lines.
- Every new production `.ts` file is at most 300 lines and every new production `.tsx` file is at most 320 lines.
- Every test file is at most 500 lines; shared non-test test support obeys its ordinary `.ts`/`.tsx` budget.
- No new architecture baseline entries were added, and the eight obsolete entries were removed.
- Public exports and runtime behavior are unchanged.
- The service and flow arrays retain byte-for-byte values and their original ordering apart from formatting/imports.
- All moved tests still run and no assertions were silently dropped.
- `pnpm run check` exits with code 0.
- The final handoff lists changed files, verification results, and any unrelated pre-existing working-tree changes.
