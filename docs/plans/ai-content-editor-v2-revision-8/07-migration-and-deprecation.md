# Migration and Deprecation Plan

## Purpose

Move from overlapping local AI architectures to one canonical Neon-draft architecture without breaking publication or losing existing validation/merge behavior.

## Migration principle

Do not build V2 on top of the local filesystem DraftStore/sync architecture. Create the Neon draft path first, migrate callers, then delete obsolete local infrastructure.

## Phase 1 — establish shared contracts

- Extract semantic reconciliation from publishing-specific ownership into a reusable domain module.
- Move/centralize AI content operation schemas into framework-neutral shared code.
- Add tests before changing behavior.
- Add file-size/architecture guard scripts early so new implementation cannot recreate a god file.

**Exit gate:** existing reconciliation behavior is unchanged and existing tests remain green.

## Phase 2 — Neon canonical draft

- Add `content_drafts` migration.
- Add the exact authenticated admin draft RPCs in 15 with optimistic generation checks; no direct table-write alternative.
- Add `content_agent_connections` migration and restricted capability validation functions.
- Add `content_edit_exports` with owner-only retrieval, 14-day expiry, and five-active-exports-per-admin pruning.
- Add durable `content_publish_preparations` and principal/connection publication audit fields.
- Add the atomic publication function and route dashboard/agent publication through it before revoking direct authenticated writes to `published_content`.
- Update the handwritten `src/app/neon/database.ts` through INTEGRATION-01; this repository does not currently generate it.

**Exit gate:** database integration tests prove one winner for same-generation concurrent writes and prove stale writes cannot overwrite.

Database deployment order is fixed by the exact filenames in 15: additive tables/columns, draft/connection/export RPCs, atomic publication RPCs, and separate cutover revocation only after the new dashboard path is deployed and proven. The revocation file lives in `neon/cutover/`, outside automatic migration enumeration.

## Phase 3 — dashboard persistence cutover

- Introduce a Neon draft repository/client.
- Refactor `useDraftWorkspace` so Neon is canonical.
- Keep IndexedDB as local cache/recovery only.
- Adapt current workspace history/undo behavior without making browser state authoritative.
- Wire stale-generation handling to semantic reconciliation.

**Exit gate:** two browser clients can edit distinct fields concurrently without loss; overlapping edits produce a conflict.

## Phase 4 — file/ChatGPT flow cutover

- Make exports read the canonical current draft.
- Apply imported operations to the canonical draft through generation checks.
- Persist each export's exact reconciliation base in Neon and recover it by `exportId` from any browser/device owned by the same admin.
- Unify operation file naming and image operation semantics.
- Move this path to the top of the AI tab.

**Exit gate:** no-setup ChatGPT edit roundtrip works with concurrent draft safety.

## Phase 5 — standalone MCP

- Add standalone publishable MCP package.
- Add capability connection management UI.
- Add restricted Data API RPC client.
- Implement draft read/edit/diff tools.
- Add image tool.
- Implement guarded `prepare_publish` + `publish_draft` against the canonical Neon draft.
- Ship explicit agent/tool instructions that editing does not imply publication and publication requires an explicit user request.
- Implement client-side base snapshot cache and safe stale-generation behavior.

**Exit gate:** a clean machine with an MCP-capable host can edit BemTeVi content without the BemTeVi repo and without any Neon admin/database credential.

## Phase 6 — remove legacy AI infrastructure

After V2 dashboard and MCP paths are proven:

- Remove local filesystem content DraftStore path.
- Remove localhost draft sync server/client path.
- Remove content-agent admin login/logout path.
- Remove direct local provider bridge product flow.
- Remove the **legacy implementation** of MCP publication while preserving the V2 `prepare_publish` + `publish_draft` contract in the standalone package.
- Remove repo-level BemTeVi content MCP configuration intended for repository agents.
- Remove/update obsolete scripts from `package.json`.
- Replace or explicitly mark obsolete AI docs as superseded.
- Rewrite `AGENTS.md` AI routing rules so coding and editorial roles are unambiguous.

**Exit gate:** searching the product/docs does not instruct content editors to clone the repo, run a local sync bridge, or use a filesystem draft.

## Phase 7 — cleanup and hardening

- Remove temporary compatibility adapters that no longer have callers.
- Run complete security tests on anonymous agent RPC grants/RLS.
- Run full repo gate.
- Validate generated/fallback content workflow still reads from Neon and is not used as editorial truth.

## Rollback strategy

The safe rollback boundary is the dashboard client, not the database truth.

- Keep existing published content untouched until the V2 publication path is verified.
- Adding `content_drafts` is additive and does not alter `published_content` semantics.
- During cutover, `VITE_EDITOR_V2_ENABLED` defaults false, selects exactly one client path, and is removed in LEGACY-02. After activation, rollback uses `VITE_EDITOR_READ_ONLY`, never returns to browser-canonical editing.
- Do not maintain two canonical draft systems in production.

Rollout order is migrations, disabled application/package code, disposable-Neon E2E verification, V2 enablement, and legacy deletion in a later verified release. Once V2 is enabled and direct publication writes are revoked, rollback disables editorial mutation while preserving public reads and Neon draft data. It MUST NOT restore the browser or filesystem as canonical draft storage.
