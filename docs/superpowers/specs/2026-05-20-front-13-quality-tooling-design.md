# Front 13 Quality Tooling Design

## Context

SeCuida is now a routed, content-driven React/Vite prototype with TypeScript, Vitest, Testing Library, a PWA build, structured content, and pure domain logic for guided flows and SRQ-20. The project already has useful validation through `pnpm run lint`, `pnpm run test`, and `pnpm run build`, but `lint` currently means TypeScript checking and there is no single merge-gate command or repo-wide content validation CLI.

Front 13 should make the repository safer to evolve without adding product features. The app is privacy-sensitive and content-heavy, so content validation must be treated as a first-class quality gate alongside type checking, linting, tests, and build verification.

## Goals

- Give the repo clear command names: type checking, linting, formatting, content validation, tests, build, and one final check command.
- Add practical ESLint and Prettier tooling without creating noisy unrelated rewrites.
- Add a CLI validation layer that catches broken flow and content references before runtime.
- Expand automated coverage around high-risk product surfaces.
- Preserve the existing pnpm workflow and GitHub Pages/Vite deployment assumptions.

## Non-Goals

- Do not implement analytics, dashboards, backend services, authentication, saved answers, saved transcripts, geolocation, or LGPD consent flows.
- Do not rewrite app architecture or reorganize feature folders.
- Do not author new psychoeducational or therapeutic content.
- Do not use this front to resolve the privacy/localStorage policy contradiction; keep that for Front 11.

## Recommended Approach

Implement Front 13 as four separate, reviewable slices:

1. **13A Scripts and Check Command**
2. **13B ESLint and Prettier**
3. **13C Content Validation CLI**
4. **13D Coverage Expansion**

These slices may live on one branch during development, but each should be independently understandable and should avoid mixing configuration changes with broad formatting or unrelated product work.

## Slice 13A: Scripts and Check Command

Add an explicit `typecheck` script that runs `tsc --noEmit`. Keep the current `lint` behavior only temporarily if ESLint is not added in the same slice; once ESLint exists, `lint` should mean ESLint and `typecheck` should own TypeScript checking.

The final script target should use pnpm-native commands:

```json
{
  "typecheck": "tsc --noEmit",
  "lint": "eslint .",
  "format": "prettier --write .",
  "format:check": "prettier --check .",
  "validate:flows": "tsx scripts/validate-flows.ts",
  "check": "pnpm run typecheck && pnpm run lint && pnpm run format:check && pnpm run validate:flows && pnpm run test && pnpm run build"
}
```

`check` should become the local and CI merge gate once all constituent commands exist. Until then, implementation may introduce it at the end of the tooling sequence instead of creating a knowingly broken command.

## Slice 13B: ESLint and Prettier

Add modern flat ESLint configuration for TypeScript and React. The rules should prioritize correctness and maintainability over style policing. Useful coverage includes TypeScript parser support, React hooks rules, React refresh constraints where appropriate, unused variables, and accessibility checks if the dependency footprint stays reasonable.

Add Prettier with a small, explicit configuration. Formatting should be deterministic, but broad formatting churn should either be avoided or isolated in a clearly labeled formatting-only commit. Existing PWA/offline work and other unrelated local edits must not be folded into this slice.

The README should explain the command meanings after the migration:

- `pnpm run typecheck`: TypeScript only
- `pnpm run lint`: ESLint only
- `pnpm run format:check`: formatting verification
- `pnpm run check`: full local gate

## Slice 13C: Content Validation CLI

Create `scripts/validate-flows.ts` and use `tsx` to run it. The script should orchestrate existing domain validators rather than duplicating flow-engine rules in a second implementation. It should load the same registered flows the app uses, then validate the content surface with actionable error messages.

The first version should validate:

- registered flow records parse successfully;
- each flow passes `validateFlow`;
- flow IDs and entering phrases are unique across registered flows;
- options and score branches point to existing nodes;
- option labels and entering phrases are non-empty;
- SRQ-20 remains structurally complete enough for the product contract, including consent, 20 question nodes, scoring effects, score branching, and Q17 safety interruption;
- resource recommendation references are checked where existing content models expose recommendation IDs.

The CLI should fail with a non-zero exit code and messages that name the relevant flow, node, option, or resource ID. It should print a short success message only when all checks pass.

## Slice 13D: Coverage Expansion

Add targeted tests where regressions would be expensive or unsafe:

- route rendering smoke tests for the public routes;
- support screen tests for phone action links and breathing exercise availability;
- contacts screen tests for current service rendering;
- education library and resource detail tests, including missing resource behavior;
- design-system render/accessibility tests for core primitives;
- validation CLI tests if the script exposes testable pure helpers;
- additional SRQ-20/flow registry tests only where current coverage has gaps.

Prefer behavior-oriented assertions over snapshots. Tests should preserve the product constraints: Portuguese-first UI, no fake free-text AI, no sensitive persistence, and clear non-diagnostic framing.

## Architecture and Data Flow

Tooling changes should sit at the repository boundary:

```txt
package.json scripts
  -> ESLint / Prettier / TypeScript / Vitest / Vite
  -> scripts/validate-flows.ts
    -> src/content/flows/registry.ts
    -> src/domain/flow-engine/parseFlow.ts
    -> src/domain/flow-engine/validateFlow.ts
    -> src/content/resources/resources.ts when reference checks are available
```

Runtime app code should not import from `scripts/`. Validation scripts may import app/domain/content modules, but app modules must remain independent of validation-only tooling.

## Error Handling

Validation errors should be boring and direct. A failing script should show each error on its own line and include enough context to fix it, for example:

```txt
Flow srq20 node q17 option yes points to missing node immediate-support.
Duplicate entering phrase "Quero responder o SRQ-20" used by flows srq20 and work-stress.
```

The CLI should not swallow exceptions from malformed JSON or invalid imports. It should normalize known validation errors into readable output and let unexpected tool failures fail loudly.

## Testing and Verification

Each slice should run the smallest relevant command during development and the full available gate before completion.

Expected final verification:

```bash
pnpm run typecheck
pnpm run lint
pnpm run format:check
pnpm run validate:flows
pnpm run test
pnpm run build
pnpm run check
```

The final `pnpm run check` should pass locally and be suitable for CI use. If CI is updated in this front, it should use `pnpm run check` rather than maintaining a separate partial command list.

## Risks and Guardrails

The biggest risk is noisy churn. Keep broad formatting separate from config and validation changes.

The second risk is validator drift. Reuse existing domain validation wherever possible, and keep script-only checks focused on cross-content concerns the runtime validator cannot see.

The third risk is over-scoping. Front 13 should improve confidence in the current prototype; it should not become Front 11 privacy, Front 12 analytics, or Front 14 dashboard readiness.

## Acceptance Criteria

- `pnpm run typecheck` exists and runs TypeScript checking.
- `pnpm run lint` uses ESLint.
- Prettier has `format` and `format:check` scripts.
- `pnpm run validate:flows` exists and fails on invalid registered flow/content references.
- `pnpm run check` exists and runs the full local gate.
- Additional tests cover the highest-risk routes, content screens, support actions, and design-system primitives.
- README and relevant status documentation describe the new commands using pnpm.
- Existing product behavior remains unchanged except for improved validation coverage.
