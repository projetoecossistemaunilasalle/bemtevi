# Oversized Files Refactor: Handover and Next Plan

Date: 2026-09-12

## Objective

Continue reducing architectural concentration after the first pass removed every TypeScript, TSX, and MJS file over
1,000 physical lines. The next pass should optimize for cohesive ownership and reusable boundaries, not line count alone.

Target guidelines:

| File role                       | Preferred size | Current architecture hard limit for new files |
| ------------------------------- | -------------: | --------------------------------------------: |
| React coordinator or screen     |  250-400 lines |                                     320 lines |
| React leaf component            |   80-250 lines |                                     320 lines |
| Domain or infrastructure module |  150-300 lines |                                     300 lines |
| Test file                       |  200-450 lines |                                     500 lines |

Existing baseline allowances are migration tolerances. They are not target sizes.

## Current State

- No `.ts`, `.tsx`, or `.mjs` file under `src`, `scripts`, `packages`, or `neon/tests` is over 1,000 lines.
- The architecture baseline was tightened to the new sizes for files reduced during this pass.
- `pnpm run check` passes: typecheck, lint, format, flow validation, 902 tests in 102 files, architecture checks, and the
  production build.
- The second pass completed the Education dashboard, Dashboard route, content-agent server, Flow dashboard/validation,
  topology, and mutation workstreams. Their former concentration points are now coordinators or public facades.
- Vite still reports the existing advisory about chunks larger than 500 kB. It does not fail the build and is outside
  this refactor's scope.
- The working tree contains unrelated pre-existing work. Review `git status` and `git diff` before staging, and do not
  revert or combine unrelated changes accidentally.

## Completed Refactors

| Original file                                        | Before | After | Main extraction                                                                            |
| ---------------------------------------------------- | -----: | ----: | ------------------------------------------------------------------------------------------ |
| `src/dev-dashboard/flows/FlowDestinationMap.tsx`     |  2,095 |   648 | Analysis, fallback, layout, presentation, node, and quick-action modules                   |
| `src/dev-dashboard/flows/NodeEditorPanel.tsx`        |  1,532 |   431 | Choice, option, branch, media, navigation, fields, and editor utility modules              |
| `src/dev-dashboard/flows/FlowEditor.tsx`             |  1,470 |   422 | Node cards, initial settings, media, options, branches, drawers, and effect editors        |
| `src/dev-dashboard/education/EducationDashboard.tsx` |  1,384 |   952 | Block fields, group management, and shared image-value helpers                             |
| `src/dev-dashboard/flows/flowTopology.ts`            |  1,255 |   736 | Graph, edge, and shared flow-text modules                                                  |
| `scripts/content-agent/server.ts`                    |  1,213 |   791 | MCP input and output protocol schemas                                                      |
| `src/dev-dashboard/DashboardRoute.tsx`               |  1,108 |   900 | Draft factories, record-origin resolution, payload conversion, and patch helpers           |
| `src/dev-dashboard/education/EducationDashboard.tsx` |    952 |   212 | Selection/upload hooks plus resource list, metadata, featured image, and body editors      |
| `src/dev-dashboard/DashboardRoute.tsx`               |    900 |   320 | Derived content, scope mutations, import/restore, tab composition, and publication adapter |
| `scripts/content-agent/server.ts`                    |    791 |   178 | Read, draft, publish, and protocol-safe error tool modules                                 |
| `src/dev-dashboard/flows/FlowDashboard.tsx`          |    772 |   156 | Selection/focus controller, import hook, sidebar, workspace, and target routing            |
| `src/dev-dashboard/flows/flowValidation.ts`          |    766 |    72 | Structural, effect, score, context, and navigation validation modules                      |
| `src/dev-dashboard/flows/flowTopology.ts`            |    736 |     3 | Public facade over flow views, per-flow topology, and system composition                   |
| `src/dev-dashboard/flows/flowMutations.ts`           |    649 |    33 | Public facade over connection, node, option, and settings mutation modules                 |

Large tests were also divided by behavior:

- `dashboardRoute.test.tsx` became navigation, contacts, flows, education, group, flow-editing, and publishing suites
  backed by `dashboardRouteTestHarness.tsx`.
- `NodeEditorPanel.test.tsx` became eight focused suites backed by shared test support.
- `flowMutations.test.ts`, `flow-engine.test.ts`, and `EducationScreens.test.tsx` were split into focused suites and
  reusable fixtures.

## Reusable Boundaries Added

- `dashboardModel.ts` provides generic record-origin resolution and dashboard draft factories.
- `educationImageValue.ts` centralizes uploaded/public image recognition and labels.
- `flowEditorFields.tsx` and `flowNavigation.ts` are shared by multiple flow editors.
- `flowText.ts` centralizes flow text normalization used by display, target selection, and topology code.
- `flowTopologyGraph.ts` and `flowTopologyEdges.ts` isolate reusable graph primitives.
- `protocolInput.ts` and `protocolOutput.ts` separate MCP contracts from execution.
- Test harnesses and fixtures keep split suites consistent without copying setup.

## Priority Queue

### 1. Education Dashboard (Completed)

File: `src/dev-dashboard/education/EducationDashboard.tsx`  
Current size: 212 lines  
Target: 300-400 lines

Status: completed with focused tests for stable selection, validation routing, upload failures, and external/local
focus precedence. The coordinator intentionally stopped below the target range because it now only composes cohesive
boundaries and owns the public callback contract.

Extract these cohesive boundaries:

- `useEducationResourceSelection` for stable ID/index selection, external focus, and fallback selection.
- `useEducationImageUpload` for upload state, errors, and safe data URL reads.
- `EducationResourceList` for the resource navigation and empty state.
- `EducationMetadataEditor` for title, source, description, tags, audience, group, and review fields.
- `EducationFeaturedImageEditor` for catalog, public path, external URL, and upload modes.
- `EducationBodyEditor` for block creation, ordering, collapse state, and removal.
- `educationValidationNavigation.ts` for normalized validation paths and issue actions.

Constraints:

- Keep `EducationDashboard` as the orchestration boundary that owns the public callback contract.
- Do not move editorial content into code or edit `src/content` as though it were the canonical production store.
- Preserve ID-based selection when indexes shift after additions, removals, or reordering.
- Reuse the existing `EducationBlockFields`, `EducationGroupManagement`, and `educationImageValue` modules.

Verification:

- Run the focused education dashboard suites and split dashboard-route education suites.
- Add hook or pure-helper tests for selection fallback and validation-path routing.
- Run `pnpm run check` before finalizing.

### 2. Dashboard Route (Completed)

File: `src/dev-dashboard/DashboardRoute.tsx`  
Current size: 320 lines  
Target: 300-450 lines

Status: completed with separate derived-content, flow, education, contact, import/restore, tab-composition, and
publication boundaries. Focused tests cover duplicate source indexes, rebasing, tombstones, and confirmed cleanup.

Extract these cohesive boundaries:

- `useDashboardDerivedContent` for merging shipped payloads, validation, and semantic comparison.
- Scope-specific mutation controllers for flows, education, contacts, and locations.
- `useDashboardImportRestore` for file input, payload parsing, AI payloads, and workspace restoration.
- `DashboardTabContent` for tab-to-feature composition.
- A small publication adapter that builds the payload and clears drafts only after confirmed success.

Constraints:

- Keep source-index and stable-ID semantics intact for duplicate IDs and reordered published records.
- Use `resolveRecordOrigin` and the helpers already extracted into `dashboardModel.ts`.
- Avoid one catch-all hook that merely relocates the current 900 lines.
- Keep the public route component responsible for page shell, active tab, and high-level orchestration only.

Verification:

- Run all split `dashboardRoute.*.test.tsx` suites.
- Add focused controller tests for duplicate IDs, reorder rebasing, tombstones, failed publication, and revision conflicts.
- Run `pnpm run check` before finalizing.

### 3. Content Agent Server (Completed)

File: `scripts/content-agent/server.ts`  
Current size: 178 lines  
Target: 300-450 lines

Status: completed. `ContentMcpServer` is now the dispatcher and dependency composition layer; read, draft, publish,
and error handling are independently testable modules.

Extract these cohesive boundaries:

- `contentReadTools.ts` for revision, list, reference search, and single-item reads.
- `contentDraftTools.ts` for validation, creation, update, retrieval, and diff operations.
- `contentPublishTools.ts` for prepare, token expiry, publish locking, remote digest confirmation, and outcome mapping.
- `contentAgentErrors.ts` for payload parsing, argument validation, and protocol-safe error conversion.
- Keep `ContentMcpServer` as the JSON-RPC dispatcher and dependency composition layer.

Constraints:

- Preserve publish locking, token expiry, idempotency, stale-generation detection, and uncertain-outcome behavior.
- Pass `reader`, `store`, and `publisher` as explicit dependencies; do not introduce hidden globals.
- Reuse `protocolInput.ts` and `protocolOutput.ts` rather than rebuilding schemas in handlers.

Verification:

- Run `scripts/content-agent/__tests__/server.test.ts` plus draft-store and publisher suites.
- Test read handlers, draft handlers, and destructive publication separately.
- Run `pnpm run check` before finalizing.

### 4. Flow Dashboard and Validation (Completed)

Files: `FlowDashboard.tsx` at 772 lines and `flowValidation.ts` at 766 lines  
Targets: 300-400 lines for the dashboard and 250-350 lines per validation module

Final sizes: `FlowDashboard.tsx` is 156 lines and `flowValidation.ts` is a 72-line facade. Every extracted controller,
component, structural translator, effect/score validator, and target resolver is below 300 lines.

Recommended boundaries:

- Extract flow selection, external validation focus, and active-node state into a controller hook.
- Extract sidebar/list actions and the editor/map/conversation workspace into focused components.
- Split structural validation, effect validation, score validation, and validation-target resolution.
- Keep validation results in the existing common issue shape.
- Share node, option, branch, video, and visual lookup utilities instead of repeating path logic.

These two files should be handled in the same workstream because validation focus drives dashboard selection behavior.

### 5. Flow Topology and Mutations (Completed)

Files: `flowTopology.ts` at 736 lines and `flowMutations.ts` at 649 lines

Final sizes: `flowTopology.ts` is a 3-line facade and `flowMutations.ts` is a 33-line facade. Their extracted modules
preserve existing exports and stay within the 300-line domain-module limit.

Recommended boundaries:

- Make `flowTopology.ts` a facade over per-flow topology building and system topology composition.
- Divide mutations into connection/effect operations, node lifecycle, option/branch operations, and settings/order operations.
- Preserve immutable update semantics and existing exported API names through a facade or re-exports.
- Do not split graph algorithms further unless the resulting modules have independent concepts and tests.

### 6. Remaining UI Concentrations

| File                     | Lines | Suggested next boundary                                                    |
| ------------------------ | ----: | -------------------------------------------------------------------------- |
| `FlowDestinationMap.tsx` |   648 | Viewport/selection hooks and canvas orchestration                          |
| `ContactsDashboard.tsx`  |   618 | Directory list, contact editor, location editor, and validation navigation |
| `DirectAgentSection.tsx` |   500 | Connection/status controller and archive/draft presentation                |
| `OrientationScreen.tsx`  |   473 | Runtime controller hook and transcript/action presentation                 |
| `NodeEditorPanel.tsx`    |   431 | Stop unless a clear remaining responsibility can be named                  |
| `FlowEditor.tsx`         |   422 | Stop unless tests reveal another stable reusable boundary                  |
| `PublishDashboard.tsx`   |   410 | Publication status, comparison, and action panels                          |

`NodeEditorPanel` and `FlowEditor` have already reached reasonable coordinator sizes. Do not reduce them mechanically.

### 7. Data and Test Debt

Lower-priority production data modules:

- `src/content/services/canoas-services.ts` at 647 lines.
- `src/content/flows/documentFlows.ts` at 642 lines.
- `src/content/flows/neutral.ts` at 566 lines.

Treat these as fallback data/code organization work, not editorial updates. Neon remains the canonical editorial source.

Remaining tests above the preferred 500-line limit:

- `dashboardStorage.test.ts` at 774 lines.
- `EducationScreens.test.tsx` at 597 lines.
- `FlowDestinationMap.test.tsx` at 533 lines.

Split tests by behavior only when shared fixtures can remain reusable and each new test file stays under 500 lines.

## Recommended Execution Order

1. Stabilize and review the current dirty tree; stage only the refactor-specific files when creating commits.
2. Continue with `ContactsDashboard.tsx`, keeping contact and location selection semantics explicit.
3. Reassess `FlowDestinationMap.tsx` for viewport/selection hooks without splitting graph algorithms mechanically.
4. Address `DirectAgentSection.tsx`, `OrientationScreen.tsx`, and `PublishDashboard.tsx` only at named ownership seams.
5. Split the remaining oversized tests by behavior and shared fixtures.
6. Treat fallback data modules as code organization only; Neon remains the canonical editorial source.

## Definition of Done for Each Step

- The original file reaches its stated target or has a documented cohesion-based reason to stop above it.
- Every extracted module has one named responsibility and stays within architecture hard limits.
- Similar logic is reused rather than copied.
- Public behavior, callback contracts, persistence semantics, and PT-BR user text remain unchanged.
- New behavior boundaries receive focused tests; existing integration suites remain green.
- `git diff --check` passes.
- `pnpm run check` passes before push or handoff.
- Database-affecting changes additionally require `pnpm run check:db` or the protected `v2-database` CI job.
