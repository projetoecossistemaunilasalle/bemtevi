# BemTeVi AI Content Editor V2 — Implementation Source of Truth

**Status:** Decision-complete implementation specification; Stage 0 complete  
**Specification status:** `IMPLEMENTATION_READY`  
**Specification revision:** `5`  
**Language:** English for engineering documentation; user-facing UI remains PT-BR  
**Scope:** Admin editorial drafts, concurrent editing, AI-assisted content editing, MCP integration, images, migration from the current local-agent architecture, testing, and implementation constraints.

## Authority

This directory is the source of truth for the V2 implementation. If an older AI/content document conflicts with this directory, **this directory wins**.

Implementation agents MUST read this file and the concern-specific file relevant to their work before editing code. **No V2 implementation may begin while `Specification status` is `HARDENING_REQUIRED`.** Stage 0 must first make the dossier decision-complete and change the status to `IMPLEMENTATION_READY`.

Normative changes to this dossier after Stage 0 are governed by [`13-dossier-change-control.md`](13-dossier-change-control.md) and temporarily return the specification to `HARDENING_REQUIRED`.

## Start Implementation

Follow [tasks/README.md](tasks/README.md) in its default serial order, beginning with **INTEGRATION-00**. It contains 23 bounded tasks; do not ask an implementation model to repeat hardening or invent shared interfaces.

Read [14-contracts.md](14-contracts.md) for exact domain/wire contracts, [15-database-contract.md](15-database-contract.md) for exact SQL/RPCs, and [16-dashboard-state-machine.md](16-dashboard-state-machine.md) for exact save/recovery behavior. Concern summaries refer to these contracts rather than providing competing alternatives. The [readiness audit](17-readiness-audit.md) records repository/official-source evidence and separates implementation readiness from later credentialed deployment gates.

## Non-negotiable decisions

1. **GitHub is the source of truth for software.** Code, tests, migrations, schemas, configuration, and generated tooling belong in GitHub.
2. **Neon is the source of truth for editorial content.** Published content and the canonical editable draft live in Neon.
3. **The application remains frontend + Neon.** No BemTeVi application backend is introduced for this feature.
4. **The browser is not the canonical draft store.** IndexedDB is a local cache/recovery aid only.
5. **Content editing never requires cloning the BemTeVi repository.**
6. **Coding agents edit code; content editors edit content.** A provider name does not determine the role.
7. **The AI content MCP is a standalone local client, not a repository tool.** It talks to the Neon Data API over HTTPS.
8. **The AI content MCP does not receive a Neon API key, database connection string, or administrator session.**
9. **The AI content MCP can publish through the same guarded publication protocol.** Publication is available to a connected editorial agent, but the shipped agent instructions MUST state that publication happens only when the user explicitly asks for it. Editing alone never implies publish intent.
10. **All editors use the same concurrency protocol.** Admin-vs-admin and admin-vs-agent use optimistic concurrency by `generation` plus the existing semantic three-way merge.
11. **No last-write-wins for draft mutations.** Every mutation is conditional on the expected generation. An accepted no-op does not advance generation; a stale no-op still fails CAS.
12. **No new god files.** File-size and responsibility constraints are part of the quality gate.
13. **The easiest AI workflow is shown first.** File export/import for ChatGPT is the default path; connected MCP assistants are an advanced path.
14. **V2 supports images in the agent workflow.** In V2, images continue to be represented inside the editorial payload; no new object-storage/backend dependency is introduced.
15. **An agent connection is delegated authority from exactly one admin principal.** The connection acts as the admin who created it, must not be shared between admins, and records the connection id separately for execution audit.
16. **ChatGPT export bases are durable in Neon.** Temporary `content_edit_exports` rows preserve the exact reconciliation base for cross-browser/device import; IndexedDB is not the sole store for an export base.
17. **Capability connections expire exactly one year after creation.** V2 does not renew a connection in place; continued access requires a replacement connection.
18. **Capability holders are trusted delegated editors, not sandboxed adversaries.** Postgres enforces authorization, structural bounds, optimistic concurrency, revision checks, and atomicity. The shared `content-core` TypeScript package owns complete semantic validation. Drafts may be temporarily semantically invalid.
19. **The standalone MCP release is version-pinned.** V2 starts with `@bemtevi/content-mcp@1.0.0` and pins `@modelcontextprotocol/server` to exactly `2.0.0`; generated configurations never use `latest` or an unversioned package.

## Documents

- [`00-specification-hardening.md`](00-specification-hardening.md) — mandatory strong-model pre-implementation pass that closes decisions and produces executable task specs.
- [`01-system-architecture.md`](01-system-architecture.md) — system boundaries and source-of-truth rules.
- [`02-draft-data-model.md`](02-draft-data-model.md) — Neon draft and capability-connection data model.
- [`03-concurrency-and-merge.md`](03-concurrency-and-merge.md) — universal optimistic concurrency and semantic merge.
- [`04-agent-auth-and-mcp.md`](04-agent-auth-and-mcp.md) — standalone MCP, capability credentials, RPC surface, and tool contract.
- [`05-assets-and-images.md`](05-assets-and-images.md) — image editing/generation constraints and V2 storage decision.
- [`06-dashboard-ux.md`](06-dashboard-ux.md) — admin UX, save state, AI paths, conflicts, and connected assistants.
- [`07-migration-and-deprecation.md`](07-migration-and-deprecation.md) — migration sequence and removal of the legacy local/repo architecture.
- [`08-parallel-workstreams.md`](08-parallel-workstreams.md) — what can run in parallel, dependencies, integration points, and ownership.
- [`09-testing-and-gates.md`](09-testing-and-gates.md) — mandatory tests and quality/security gates.
- [`10-code-organization-constraints.md`](10-code-organization-constraints.md) — module boundaries, file budgets, and anti-god-file enforcement.
- [`11-agent-execution-rules.md`](11-agent-execution-rules.md) — rules for implementation agents.
- [`12-change-inventory.md`](12-change-inventory.md) — expected create/modify/remove inventory.
- [`13-dossier-change-control.md`](13-dossier-change-control.md) — strong-model impact process for any later normative specification change.
- [`14-contracts.md`](14-contracts.md) — exact shared types, operations, images, digests and file contract.
- [`15-database-contract.md`](15-database-contract.md) — exact schema, RPC catalog, grants and transaction algorithms.
- [`16-dashboard-state-machine.md`](16-dashboard-state-machine.md) — exact dashboard services, transitions and recovery.
- [`17-readiness-audit.md`](17-readiness-audit.md) — completed Stage 0 findings, evidence and readiness boundary.
- [`tasks/README.md`](tasks/README.md) — executable task index and default serial order.

## Current-state facts that motivate V2

The current repository contains two overlapping AI/content approaches: a direct local agent bridge and a repository-local content MCP with filesystem drafts and localhost synchronization. The current `scripts/content-agent/server.ts` is approximately 45 KB and combines protocol schemas, tool definitions, dispatch, domain logic, draft logic, diffing, and publishing concerns. V2 intentionally removes that architecture instead of extending it.

The current frontend already talks directly to Neon using Neon Auth + Neon Data API. The existing content publication model already has optimistic publication revision checks. The existing semantic diff/reconciliation implementation already performs three-way content reconciliation and MUST be reused rather than replaced.

## Definition of done

V2 is done only when all of the following are true:

- An admin can edit a canonical draft stored in Neon and resume it from another browser/session.
- Concurrent admin edits never silently overwrite each other.
- Existing semantic reconciliation resolves non-overlapping concurrent changes and surfaces true conflicts.
- The ChatGPT file workflow works against the current Neon draft and appears as the easiest/default AI option.
- A ChatGPT export created by an admin can be imported by the same admin from another browser/device for 14 days because its exact base is retained in Neon.
- A connected MCP assistant can read and edit the same draft without cloning the repository.
- The MCP can prepare and publish the canonical Neon draft, but only through validation, pinned `generation`, `expectedRevision`, digest/token checks, and explicit user intent governed by the shipped agent instructions; it still has no broad Neon/database credential.
- MCP image changes are supported and validated.
- Legacy repo-local draft sync, local content-agent login, local filesystem DraftStore, and direct-agent bridge paths are removed from the product flow.
- New code satisfies the file/module constraints and the complete quality gate.
- The standalone MCP reports version `1.0.0`, uses the pinned MCP SDK `2.0.0`, targets protocol revision `2026-07-28`, and remains compatible with `2025-06-18` hosts through SDK stdio negotiation.
