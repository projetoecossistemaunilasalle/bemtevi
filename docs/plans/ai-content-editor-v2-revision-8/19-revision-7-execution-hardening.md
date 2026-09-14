# Revision 7 Execution Hardening

> Historical record. Revision 8 supersedes this file wherever executor-determinism wording, ownership or gate sequencing differs.

## Summary

Revision 7 is a narrow implementation-execution hardening pass over Revision 6. It uses the same audited repository base, `e030264786ae7010aac7832203244882d12f9265`, and does not redesign V2 product behavior, schema, RPC semantics, merge semantics, publication semantics, MCP tools, archive format, or dashboard state behavior.

## Changes

1. **Feature repository ownership is explicit.** `draftRepository.ts`, `exportRepository.ts`, and `connectionRepository.ts` own their public interfaces, narrow structural RPC transports, factories, and fake-driven mapping tests in their feature lanes. INTEGRATION-01 does not re-own or reimplement them.
2. **Typed Neon composition is explicit and ordered.** INTEGRATION-01 updates the handwritten `src/app/neon/database.ts` V2 types first, then owns `src/dev-dashboard/editorialNeonServices.ts`, which supplies the existing authenticated `defaultNeonClient` structurally to the three feature-owned factories. Pre-integration feature code may not import/cast the application Neon client or handwritten Database types.
3. **MCP-04 ownership/dependency is explicit.** MCP-04 depends on both MCP-03 and DB-04 and owns `packages/content-mcp/scripts/tarball-smoke.mjs` plus the packed clean-install tests.
4. **Packed MCP proof has one live owner.** MCP-04 proves the credential-free clone-free installed artifact through `pnpm run check:mcp-package`. INTEGRATION-03 owns `neon/tests/mcp-package-live.test.ts`, reuses the DB-04 disposable-branch harness, and exercises that installed tarball through real test Auth/Data API edit + guarded publication.

## Unchanged

- audited implementation base;
- architecture baseline;
- files 01–07 and 14–15 product/database contracts;
- canonical draft/CAS/reconciliation semantics;
- connection/export/publication security model;
- MCP package/tool/config/version contracts;
- UI behavior and rollout intent;
- default serial execution strategy.

## Implementation instruction

A capable implementation model may inspect adjacent code and create private helpers inside task-owned subtrees, but it must not choose alternative ownership or transport boundaries. Execute one task ID at a time, honor 08 dependencies, and run the task gates before advancing.
