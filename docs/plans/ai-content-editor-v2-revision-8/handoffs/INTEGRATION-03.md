# INTEGRATION-03 Handoff — Live Replacement And Deployment Proof

**Task ID:** INTEGRATION-03 (revision 8 dossier, remaining-work bundle)
**Starting HEAD:** `f835309d774cda50d9e58a6a8b60eb75307d23c9` (docs-only descendant of `91d3efe`; tree clean)
**Ending HEAD before task commit:** `6f64794d9306972d433c79920f6765e053d47659` (explicit DB-04 handback); the INTEGRATION-03 commit contains this handoff and follows with no push.
**Worktree before:** clean. **Worktree after:** clean (owned files committed).
**Status:** COMPLETE — Gates C/D/E-live green; staged release evidence complete.

## Inventory (files created/modified)

| Path                                                                    | Lines             | Role                                                                                          |
| ----------------------------------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------- |
| `neon/tests/editorial-e2e.test.ts`                                      | 487 (≤500 budget) | New live E2E suite (8 tests), auto-discovered by the DB-04 harness                            |
| `neon/tests/mcp-package-live.test.ts`                                   | 379 (≤500 budget) | Packed/installed MCP live suite: Auth, capability edit, guarded publish, revocation           |
| `docs/editorial-v2-rollout.md`                                          | 93                | Fixed rollout, browser smoke procedure, rollback, staged evidence, resolved change-control    |
| `docs/plans/ai-content-editor-v2-revision-8/handoffs/INTEGRATION-03.md` | this file         | Handoff                                                                                       |
| `neon/tests/run.ts`                                                     | 293               | Explicit DB-04 handback: forwards the existing disposable-branch Auth URL to live test suites |
| `docs/plans/ai-content-editor-v2-revision-8/handoffs/DB-04.md`          | 80                | Records the CC-I03-1 impact analysis, handback, and live result                               |

**Forbidden files otherwise untouched:** `provision.ts`, `fixtures.ts`, `clients.ts`, `vitest.config.ts`, `.github/workflows/ci.yml`, and MCP package sources.

## Editorial E2E cases (all green under `pnpm run check:db`)

| #   | Test name                                                                                                             | Proves                                                          |
| --- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 1   | initializes the draft with baseRevision equal to the live published revision                                          | Aligned base/live                                               |
| 2   | rejects the second same-generation writer and applies the loser after refetch                                         | Distinct-field merge                                            |
| 3   | gives stale_generation on overlapping fields and invalid_operations on a non-permutation reorder after delete         | Overlapping/delete/order conflict                               |
| 4   | lets the first prepare+publish win; the second prepare hits revision_conflict and the stale publish preparation_stale | Same-generation one-winner CAS                                  |
| 5   | captures an image-bearing material export with stable digest and owner-only retrieval                                 | Image/file roundtrip + cross-session export + owner-only denial |
| 6   | allows agent context before revoke and denies after revoke                                                            | Revoked capability denial                                       |
| 7   | publishes via admin with null connection id and via agent with the delegating connection                              | Guarded admin + MCP/agent publication                           |
| 8   | denies an already-loaded client after revoke and documents full kill-artifact proof as cutover-phase                  | Weak post-kill linearization                                    |

Image storage note: uploaded featured images persist as `{kind:'uploaded', dataUrl:'data:image/png;base64,…'}` (see `materialImageSlots.ts`), not a bare `base64` field — first run asserted the wrong shape and failed; fixed to `dataUrl`.

## Change-control

| ID           | Item                                                                                                                                                                                                                                                                                          | Classification                                                                                                                                       |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CC-I03-1** | Harness did not forward its existing `authBaseUrl` to live test suites, blocking the required real anonymous Auth acquisition by the installed MCP package.                                                                                                                                   | **Resolved by explicit DB-04 handback.** One suiteEnv entry added; no new authority, provisioning path, or normative contract. Full live gate green. |
| **CC-I03-2** | Phase-2 vitest filter hardcodes `grants.test.ts` only. Strong kill-artifact proof cannot live in editorial-e2e without editing run.ts.                                                                                                                                                        | Disclosed — weak revocation proof used; full proof stays in grants cutover phase + rollout doc.                                                      |
| **CC-I03-3** | Transient Neon API connectivity during check:db (two failed runs: "Could not reach the Neon API" / "Unknown error"); leaked disposable branches manually deleted (`br-wispy-mouse-acgruhrv`, `br-falling-mountain-acewl4io`). Final successful run created+deleted `br-mute-meadow-ac0147s6`. | Environmental — not a code defect; final gate green.                                                                                                 |
| **CC-I03-4** | The first installed-package live run used `conformanceBasePayload`, whose two semantic errors are intentional; the MCP correctly rejected prepare while lower-level SQL publication tests do not perform complete semantic validation.                                                        | Fixed within the owned live test by applying the same two fixture repairs used by MCP publication tests. The next live run passed.                   |

## Dashboard browser smoke

Not executed (no authorized disposable env driven in-browser this session). Procedure recorded in `docs/editorial-v2-rollout.md` § Dashboard browser smoke procedure; status: "staged — procedure recorded, execution pending authorized environment".

## Commands and exact results (final successful run)

| Command                       | Result                                                                                                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm run check:db`           | **PASS, exit 0** — coexistence: 10 files, 128 passed, 2 skipped; cutover grants phase: 6 passed, 2 skipped. Disposable branch `br-floral-morning-acqia14j` created and deleted. |
| `pnpm run typecheck`          | PASS, exit 0                                                                                                                                                                    |
| `pnpm run lint`               | PASS, exit 0 (after removing unused `TApplyContentDraftOperations` import)                                                                                                      |
| `pnpm run check:architecture` | PASS — "Architecture check passed (565 source files)." (+editorial-e2e and mcp-package-live)                                                                                    |
| `pnpm run format:check`       | PASS — "All matched files use Prettier code style!"                                                                                                                             |
| `pnpm run check:mcp-package`  | PASS, exit 0 — Gate E-local (pack 49010 bytes; stdoutNoise 0; cleanedUp true)                                                                                                   |
| `pnpm run check` (full)       | PASS, exit 0 — typecheck, lint, format, validate:flows (8 flows), test **144 files / 1269 tests**, architecture 564, build, test:mcp 12 files/120, build:mcp                    |

## Deviations from bundle

1. **DB-04 handback** — CC-I03-1 required one out-of-allowlist harness edit. Strong-model impact analysis found no normative change: `authBaseUrl` already existed and doc 04 plus Gate E-live already required it. The handback was recorded in `DB-04.md` before resuming INTEGRATION-03.
2. **MCP live fixture** — the first run exposed the conformance fixture's two deliberate semantic errors. The owned test now applies the same repairs as `packages/content-mcp/tests/publication.test.ts`; the production MCP correctly remains fail-closed.
3. **Image export assertion** initially used the wrong field (`base64` vs `dataUrl`) and was corrected within the allowlist.
4. **Transient Neon API flakiness** affected earlier editorial-only attempts; no permanent infrastructure change was made.

## Skipped gates + why

- None of the required local gates skipped. Live `check:db` was run (green). Dashboard browser smoke not executed (procedure only, per bundle 3.5).

## Downstream unblocked / blocked

- **LEGACY-01** may proceed: editorial replacement proof, MCP-04 Gate E-local, and installed-package Gate E-live are green.
- **INTEGRATION-04** may treat CC-I03-1 as resolved. Production deploy, flag enablement, cutover, dashboard browser smoke, and npm publication remain separately owner-authorized/staged actions.
