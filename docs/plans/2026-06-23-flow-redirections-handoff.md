# Flow Redirections Implementation — Handoff

> **Status:** Tasks 1–7 complete, Tasks 8–10 remaining.
> **Branch:** `dev/dashboard-overhaul` (clean working tree)
> **Plan:** `mocks/2026-06-22-flow-redirections-implementation-plan.md`

This file documents what has been done so far, key deviations from the plan, and everything the next agent needs to finish Tasks 8, 9, and 10.

## TL;DR for the next agent

1. Read this entire file before doing anything.
2. Read the original plan: `mocks/2026-06-22-flow-redirections-implementation-plan.md` (Tasks 8, 9, 10 only — Tasks 1–7 are done).
3. The deferred-safety engine, content, and dashboard tab are wired up. You need to (a) add the deferred-safety editor UI on Q17, (b) refactor `FlowPreview` to use the real engine, and (c) run the full verification gate.
4. Several deviations from the plan's literal text were necessary and are documented below. **Do not "fix" them back to the plan's wording** without understanding why the deviation was made.

## Repo state

```
On branch: dev/dashboard-overhaul
Working tree: clean

Recent commits (newest first):
202bfaf feat: add large flow navigation filters                  (Task 7)
f323c53 feat: add flow redirections dashboard tab                (Task 6)
9f4397e feat: derive flow redirection audit rows                 (Task 5)
baeeb22 test: cover deferred SRQ-20 support navigation in orientation (Task 4)
a7be81f fix: defer SRQ-20 safety routing until final result      (Task 3)
6d451f2 test: validate deferred safety flow effects              (Task 2)
38834f5 feat: add deferred safety routing to flow engine         (Task 1)
```

Test count after Task 7: **220 tests pass** across 20 files. `pnpm run typecheck` and `pnpm run lint` clean. `pnpm run validate:flows` passes for 9 flows.

## What was implemented (Tasks 1–7)

### Task 1 — Deferred safety domain types ✅

**Commit:** `38834f5`

Files:

- `src/domain/flow-engine/types.ts` — added `DeferredSafetyFlowEffect`, `DeferredNavigationState`, the new variant in `FlowEffect`, and `deferredNavigation?` on `FlowRuntimeState`.
- `src/domain/flow-engine/advanceFlow.ts` — added a `deferred_safety` branch in `applyOptionEffects` (records flag + routing target, **does not** short-circuit) and updated `advanceToNode` so reaching a `result` node with `deferredNavigation` appends the deferred message and sets `pendingNavigation`.
- `src/domain/flow-engine/__tests__/flow-engine.test.ts` — added the spec test verbatim.
- **`src/domain/flow-engine/validateFlow.ts`** — also modified (see deviation 1.1 below).

### Task 2 — Validate deferred safety effects ✅

**Commit:** `6d451f2`

Files:

- `src/domain/flow-engine/validateFlow.ts` — branch placed after `safety_interrupt`, allow-list `['/apoio', '/contatos', '/educacao']`. Error message: `Flow ${flowLabel} option ${optionId} deferred safety effect must include flagKey, message, and supported destination.`
- `src/domain/flow-engine/__tests__/flow-engine.test.ts` — added `validates deferred safety effects` test.

### Task 3 — Update SRQ-20 Q17 content ✅

**Commit:** `a7be81f`

Files:

- `src/content/flows/srq20.json` — q17 `yes` option changed from `safety_interrupt` to `deferred_safety` with the spec message, `flagKey: "self_harm_ideation"`, `destination: "/apoio"`. `next: "q18"` preserved. No score effect.
- `src/domain/flow-engine/__tests__/flow-engine.test.ts` — replaced old Q17 test with the new spec test (verbatim).
- **`scripts/validate-flows.ts`** + **`scripts/__tests__/validate-flows.test.ts`** — also modified (see deviation 3.1 below).

### Task 4 — Preserve orientation UX ✅

**Commit:** `baeeb22`

Files:

- `src/features/orientation/__tests__/OrientationScreen.test.tsx` — added test that drives SRQ-20 q1-q20 and asserts (a) `mockNavigate('/apoio')` is NOT called after Q17 yes, (b) IS called after final result. Added `vi.hoisted` + `vi.mock('react-router-dom')` for the navigate mock.
- `src/features/orientation/OrientationScreen.tsx` — **unchanged** (the `!isRevealing` guard was already in place at line 120).

### Task 5 — Flow redirection derivation utility ✅

**Commit:** `9f4397e` (amended)

Files:

- `src/dev-dashboard/flows/flowRedirections.ts` — exports `FlowRedirectionKind`, `FlowRedirectionRow`, `getFlowRedirections(flow)`. Handles all 7 kinds (6 effect kinds + `score_branch` as a node).
- `src/dev-dashboard/__tests__/flowRedirections.test.ts` — 3 tests covering the spec test plus `safety_interrupt`+`navigate` and `flow_start`+`end_flow`.

### Task 6 — Render Redirections tab in dashboard ✅

**Commit:** `f323c53` (amended)

Files:

- `src/dev-dashboard/flows/FlowRedirectionsPanel.tsx` (new) — renders the rows from `getFlowRedirections`. Empty state when no rows.
- `src/dev-dashboard/flows/FlowDashboard.tsx` — added `activeDetailTab` (`'editor' | 'preview' | 'map' | 'redirections'`) and `expandedNodeIds` state (lifted from `FlowEditor`). 4 tab buttons with `aria-pressed`. Clicking "Editar etapa" commits expansion and switches to the editor tab.
- `src/dev-dashboard/flows/FlowEditor.tsx` — now receives `expandedNodeIds` + `onExpandedChange` from parent (controlled for expansion). No internal `expandedNodeIds` state. `useState` is the only React import needed.
- `src/dev-dashboard/__tests__/dashboardRoute.test.tsx` — added mock `mock-flow-srq20` (title `"SRQ-20"`, with `q17` carrying a `deferred_safety` effect and `q18` as a result node). Added the spec test and a round-trip test.

### Task 7 — Large-flow navigation filters ✅

**Commit:** `202bfaf`

Files:

- `src/dev-dashboard/flows/FlowEditor.tsx` — added `nodeSearch` and `activeNodeFilter` state, `nodeHasDeferredSafety` helper, `visibleNodes` derivation, and toolbar JSX (search input + 4 filter buttons + visible count). Render loop changed from `nodes.map` → `visibleNodes.map`. Node titles now show as `Etapa N — nodeId` (em-dash) so reviewers see the underlying id.
- `src/dev-dashboard/__tests__/dashboardRoute.test.tsx` — added `mock-flow-srq20` with 17 placeholder intro choice nodes + q17 (deferred_safety) + q18 + final result, so q17 = Etapa 18 and q18 = Etapa 19. Added the spec test. Updated one existing assertion from `getAllByText('Etapa 3')` to `getAllByText(/Etapa 3/)` because the title format changed.

## Key deviations from the plan

These are intentional and documented by reviewers. Do not "revert" them without understanding why.

### Deviation 1.1 — `validateFlow.ts` was modified in Task 1

**Plan:** Task 1 said to modify only `types.ts`, `advanceFlow.ts`, and the test file.

**What happened:** `createInitialFlowState` calls `validateFlow`, which rejects unknown effect kinds. Without adding a `deferred_safety` branch to `validateFlow.ts`, the Task 1 test would never reach the runtime code (it fails at `createInitialFlowState`). The implementer added the minimal branch (mirroring `safety_interrupt`/`navigate`).

**Status:** Task 2 then formalized this branch with proper test coverage.

### Deviation 1.2 — Sort order in `flowRedirections.ts`

**Plan:** `compareRows` order map was `deferred_safety: 0, safety_interrupt: 1, score_branch: 2, score: 3, navigate: 4, flow_start: 5, end_flow: 6`.

**What happened:** The plan's own test expects output order `[deferred_safety, score, score_branch]` — a direct contradiction. The implementer swapped to `score: 2, score_branch: 3` so the test passes.

**Status:** The test is the authoritative spec. Sort order in code: `deferred_safety: 0, safety_interrupt: 1, score: 2, score_branch: 3, navigate: 4, flow_start: 5, end_flow: 6`.

### Deviation 3.1 — `scripts/validate-flows.ts` was modified in Task 3

**Plan:** Task 3 said to modify only `srq20.json` and the test file.

**What happened:** The content-level validator in `scripts/validate-flows.ts` had a hardcoded rule requiring `safety_interrupt` on q17. Plan Step 4 explicitly required `pnpm run validate:flows` to pass. Without updating the validator, that command would fail. The implementer updated the rule to require `deferred_safety` + non-empty `flagKey` + non-empty `message` + `destination: '/apoio'`. The validator test got a fixture update and 2 new negative tests.

**Status:** This is the same pattern as deviation 1.1 — necessary because the plan's Step 4 expectation couldn't be satisfied without it.

### Deviation 4.1 — Test uses `fireEvent` and autocomplete, not `userEvent` + `startOrientationWithStarter`

**Plan:** Spec test used `user.click(...)` and `startOrientationWithStarter('Quero responder o SRQ-20')`.

**What happened:**

- The existing 24 tests in `OrientationScreen.test.tsx` all use `fireEvent`, so the implementer matched that convention. Switching to `userEvent` would be inconsistent.
- `'Quero responder o SRQ-20'` is an `enteringPhrases` entry, not an `INTRO_STARTERS` button. Using `startOrientationWithStarter('Quero responder o SRQ-20')` would have been broken. The implementer used the autocomplete pattern that the existing `'starts SRQ-20 through chatbot autocomplete from JSON flow content'` test uses.

### Deviation 4.2 — Q18 assertion regex

**Plan:** `expect(screen.getByText(/Você tem dormido mal/i))`.

**What happened:** The actual q18 text in `srq20.json` is `"Sente-se cansado(a) o tempo todo?"`, not "Você tem dormido mal". The implementer used `/Sente-se cansado/i`. The deferred message assertion (`/Obrigado por responder com sinceridade/i`) matches `srq20.json:271`.

### Deviation 6.1 — `FlowRedirections.tsx` was renamed to `FlowRedirectionsPanel.tsx`

**Plan:** Create `src/dev-dashboard/flows/FlowRedirections.tsx`.

**What happened:** On Windows (case-insensitive NTFS/FAT), `FlowRedirections.tsx` and the existing `flowRedirections.ts` collide — TypeScript reports them as the same module and rejects the import. The implementer renamed to `FlowRedirectionsPanel.tsx` to dodge the collision. Import in `FlowDashboard.tsx` updated accordingly.

**Important:** If you do any Task 8/9/10 work that needs to import the FlowRedirections component, import from `./FlowRedirectionsPanel` (not `./FlowRedirections`).

### Deviation 6.2 — `getByText` became `getAllByText`

**Plan:** `expect(screen.getByText('Encaminhamento de segurança ao final')).toBeInTheDocument();`

**What happened:** The spec JSX renders that exact string twice per row — once in the kind-label chip (`kindLabels[row.kind]`) and once in the row title (`row.title`). `getByText` errors on multiple matches; the implementer changed to `getAllByText(...).length).toBeGreaterThan(0)`.

### Deviation 6.3 — Mock added `q18` (originally `score_branch`, then changed to `result`)

**Plan:** Spec test asserts `/continua para q18/i` and `/depois abre \/apoio/i`, which require a row whose summary contains `q18` and `/apoio`.

**What happened:** The existing `mock-flow` didn't have a `deferred_safety` effect, so the test would have nothing to assert on. The implementer added a `handoff` option with `next: 'q18'` and a `deferred_safety` effect, plus a `q18` node. First attempt used `kind: 'score_branch'` with `branches: []`, which surfaced a real validation error in the dashboard. Amended to `kind: 'result'`.

### Deviation 6.4 — Focus effect refactored (no more `useEffect`/`setState`/`eslint-disable`)

**Plan:** Task 6 said to add `focusedNodeId` + `onFocusedNodeHandled` props and a `useEffect` that calls `setExpandedNodeIds`.

**What happened:** The spec's `useEffect` triggered the `react-hooks/set-state-in-effect` lint rule, requiring an `eslint-disable-next-line`. The implementer lifted `expandedNodeIds` state to `FlowDashboard` and made `FlowEditor` a controlled component for expansion. `FlowEditor` now takes `expandedNodeIds` + `onExpandedChange` props; the parent commits the expansion synchronously when "Editar etapa" is clicked. No eslint-disable, no useEffect round-trip.

**Implication for Task 8:** When you add deferred-safety editing fields to `FlowEditor`, the editor already receives `expandedNodeIds` from the parent. New fields are local to the editor's option card; no need to lift them.

### Deviation 7.1 — Test mock added `mock-flow-srq20`

**Plan:** Spec test clicks `getByRole('button', { name: 'SRQ-20' })`.

**What happened:** The existing `mock-flow` was titled `"Fluxo de teste"`, not `"SRQ-20"`. The implementer added a third mock flow (`mock-flow-srq20`) with `title: 'SRQ-20'`, 17 placeholder intro nodes, q17 (with deferred_safety), q18 (result), and `done`. This gives the test a flow with 19+ nodes where q17 lands at Etapa 18.

## Remaining tasks

### Task 8 — Add deferred safety editing UI (Plan ref: `mocks/2026-06-22-flow-redirections-implementation-plan.md` lines 941–1036)

**Files:**

- Modify: `src/dev-dashboard/flows/FlowEditor.tsx`
- Test: `src/dev-dashboard/__tests__/dashboardRoute.test.tsx`

**What to do (per plan):**

1. Add helpers inside `FlowEditor`:
   - `getDeferredSafetyEffect(option)` — returns the deferred_safety effect on an option, or undefined.
   - `updateOptionEffects(node, optionId, updater)` — applies an updater fn to an option's effects array; clears the array if empty.
2. Render a "Encaminhamento de segurança" block under each choice option, with:
   - Flag key input (text)
   - Destination `<select>` with options `/apoio`, `/contatos`, `/educacao`
   - Message textarea
   - "Ativar" and "Remover encaminhamento" buttons
3. Use `updateOptionEffects` in each `onChange` to update only the deferred_safety effect.
4. For SRQ-20 q17 specifically, render this note when the option has deferred safety and no score effect:
   ```
   "Q17 não soma pontos no SRQ-20. Ela fica separada da pontuação para não esconder uma regra de segurança dentro do cálculo."
   ```

**Spec test (verbatim):**

```tsx
it('shows deferred safety editor separately from score editor on SRQ-20 Q17', async () => {
  const user = userEvent.setup();
  render(<DashboardRoute />);

  await user.click(screen.getByRole('button', { name: 'SRQ-20' }));
  await user.click(screen.getByRole('button', { name: 'Editor' }));
  await user.click(screen.getByRole('button', { name: /Etapa 18 — q17/i }));

  expect(screen.getByText('Encaminhamento de segurança')).toBeInTheDocument();
  expect(screen.getByDisplayValue('self_harm_ideation')).toBeInTheDocument();
  expect(screen.getByText(/Q17 não soma pontos/i)).toBeInTheDocument();
});
```

**Things to verify before implementing:**

- `updateChoiceOption` — find its signature. The plan assumes it exists with shape `updateChoiceOption(node, optionId, { effects: ... })`. If the real signature differs, adjust.
- The note text in the plan is hardcoded to "Q17 não soma pontos no SRQ-20." If you want to make this generic, leave it as a TODO comment. The plan's exact text is fine.
- The test requires `getByDisplayValue('self_harm_ideation')` — make sure the flag key input has that exact initial value when editing SRQ-20 q17. The flow content (`srq20.json`) already has `flagKey: "self_harm_ideation"`, so the editor should populate the input from there.
- Where exactly to insert the "Encaminhamento de segurança" block in the option card — the plan says "after the primary action fields and before score UI". Read `FlowEditor.tsx` to find the right spot.

**Commit:** `feat: edit deferred safety routing in flow dashboard`

### Task 9 — Make FlowPreview use real engine behavior (Plan ref: lines 1041–1123)

**Files:**

- Modify: `src/dev-dashboard/flows/FlowPreview.tsx`
- Test: `src/dev-dashboard/__tests__/dashboardRoute.test.tsx`

**What to do (per plan):**

1. Import:
   ```ts
   import { advanceFlow } from '../../domain/flow-engine/advanceFlow';
   import { createInitialFlowState } from '../../domain/flow-engine/loadFlows';
   import { resolveOptions } from '../../domain/flow-engine/resolveOptions';
   ```
2. Replace local active node/message state with:
   ```ts
   const [state, setState] = useState(() => createInitialFlowState(flow, flows));
   const options = resolveOptions(state, flows).filter((option) => option.kind === 'node_option');
   ```
3. Add `chooseOption(label)` and `clearChat()` helpers.
4. Render `state.transcript` and call `chooseOption(option.label)` from option buttons.

**Spec test (verbatim):**

```tsx
it('previews deferred safety after SRQ-20 final result', async () => {
  const user = userEvent.setup();
  render(<DashboardRoute />);

  await user.click(screen.getByRole('button', { name: 'SRQ-20' }));
  await user.click(screen.getByRole('button', { name: 'Testar conversa' }));

  await user.click(screen.getByRole('button', { name: 'Quero responder' }));
  await user.click(screen.getByRole('button', { name: 'Continuar' }));

  for (let question = 1; question <= 16; question++) {
    await user.click(screen.getByRole('button', { name: 'Não' }));
  }

  await user.click(screen.getByRole('button', { name: 'Sim' }));

  expect(screen.getByText(/Você tem dormido mal/i)).toBeInTheDocument();
  expect(screen.queryByText(/vamos abrir a página de apoio agora/i)).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Não' }));
  await user.click(screen.getByRole('button', { name: 'Não' }));
  await user.click(screen.getByRole('button', { name: 'Não' }));

  expect(screen.getByText(/vamos abrir a página de apoio agora/i)).toBeInTheDocument();
});
```

**Things to verify before implementing:**

- **`mock-flow-srq20` from Task 7 does NOT match the real SRQ-20 structure.** The test mock has 17 placeholder intro nodes + q17 + q18 + done. Real `srq20.json` has `consent`, `instructions`, `q1`–`q20`, `srq20-score`, and result nodes. The test will fail if it relies on the mock to exercise the full flow.
  - **Decision needed:** Either (a) extend `mock-flow-srq20` to mirror real SRQ-20 structure (consent/instructions/q1–q20/score/results), or (b) use the real `flowRegistry.flows` in the test instead of the mock. Option (b) is cleaner but requires the test to look up SRQ-20 from the registry.
  - The spec test phrases like "Quero responder" → "Continuar" → "Não"×16 → "Sim" suggest it expects to drive the full real flow. Verify by reading the existing `srq20.json` enteringPhrases.
- **Q18 text in real SRQ-20:** `/Você tem dormido mal/i` — read `srq20.json` to confirm q18's text. The Task 4 reviewer found q18's actual text is `"Sente-se cansado(a) o tempo todo?"` — confirm whether that's still the case or whether q18 was changed.
- **`/vamos abrir a página de apoio agora/i`** — should match the deferred message in `srq20.json`. The current message contains "vamos abrir a página de apoio agora" (Task 3 set it). Confirm.
- The spec assumes FlowPreview renders `state.transcript` messages and option buttons. If `FlowPreview` currently has a different rendering style, you'll need to refactor it.
- `resolveOptions` return shape — verify it actually returns `{ kind: 'node_option', ... }` items with `.label`. If different, adjust.

**Commit:** `fix: preview flows through real engine`

### Task 10 — Full verification (Plan ref: lines 1126–1171)

**Files:** Only files touched by earlier tasks if verification reveals issues.

**Steps:**

1. `pnpm run validate:flows` — must pass.
2. `pnpm run test` — must pass.
3. `pnpm run lint` — must pass.
4. `pnpm run build` — must pass.
5. `pnpm run check` — must pass.
6. If any verification failed and required a fix, commit it with `fix: stabilize flow redirections implementation`. If nothing needed fixing, do NOT create an empty commit.

## Key file references

| File                                                | Purpose                                                                                       |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `src/domain/flow-engine/types.ts`                   | `DeferredSafetyFlowEffect`, `DeferredNavigationState`, `FlowEffect` union, `FlowRuntimeState` |
| `src/domain/flow-engine/advanceFlow.ts`             | `applyOptionEffects` (line ~148), `advanceToNode` (line ~201)                                 |
| `src/domain/flow-engine/validateFlow.ts`            | `deferred_safety` validator branch (line ~165)                                                |
| `src/content/flows/srq20.json`                      | q17 has `deferred_safety` to `/apoio`                                                         |
| `src/features/orientation/OrientationScreen.tsx`    | `!isRevealing` guard at line 120                                                              |
| `src/dev-dashboard/flows/flowRedirections.ts`       | `getFlowRedirections`, types                                                                  |
| `src/dev-dashboard/flows/FlowRedirectionsPanel.tsx` | tab component (note: NOT `FlowRedirections.tsx`)                                              |
| `src/dev-dashboard/flows/FlowDashboard.tsx`         | `activeDetailTab`, `expandedNodeIds`, 4 tabs                                                  |
| `src/dev-dashboard/flows/FlowEditor.tsx`            | search/filter toolbar; receives `expandedNodeIds` from parent                                 |
| `src/dev-dashboard/flows/FlowPreview.tsx`           | currently has simplified routing — Task 9 will refactor                                       |
| `scripts/validate-flows.ts`                         | content-level validator (includes q17 rule)                                                   |

## Test conventions to remember

- `src/dev-dashboard/__tests__/dashboardRoute.test.tsx` uses **`userEvent.setup()`** (not `fireEvent` — the orientation tests use `fireEvent`).
- `mock-flow` (mock title `"Fluxo de teste"`) and `mock-flow-srq20` (mock title `"SRQ-20"`) coexist. The production SRQ-20 (`srq20.json`) is also available via `flowRegistry.flows` — the spec test for Task 9 may need to use it instead of the mock.
- `Etapa N — nodeId` (em-dash) is the current title format. Use `getByText(/Etapa 18 — q17/i)` not `getByText('Etapa 18 — q17')`.

## Final notes for the next agent

- **TDD:** Each task has a spec test that should fail first, then pass.
- **Two-stage review:** After implementing, dispatch a spec-compliance reviewer and a code-quality reviewer (use the same workflow as Tasks 1–7).
- **Deviations:** If you encounter a plan vs. reality conflict (similar to those documented above), resolve it pragmatically and document the deviation in your report.
- **Don't break existing tests:** All 220 tests should keep passing after each commit.
- **The plan is `mocks/2026-06-22-flow-redirections-implementation-plan.md`** — Tasks 8, 9, 10 sections are authoritative for the remaining work.
