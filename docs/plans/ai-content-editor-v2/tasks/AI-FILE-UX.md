# File Workflow And AI Presentation Tasks

Read 14 file contract, 05 limits, 16 actions. Service interfaces are frozen; no database/route persistence implementation here.

## AI-FILE-01: Durable Archive Roundtrip

**Depends:** MERGE-03. **Unblocks:** AI-FILE-02. **Parallel:** file lane.
**Owns:** src/dev-dashboard/ai/files/{exportRepository,createEditorialArchive,parseEditorialArchive,zipBounds,archiveInstructions,importEditorialOperations}.ts and tests; ai/aiArchive.ts, ai/aiPrompts.ts compatibility adapters/tests.
Implement exact filenames/manifest/selection/image refs in 14. Export base comes from server capture; import gets owner base and checks digest/ID/generation. Never substitute latest draft. Return candidate/diff/issues to caller, no hidden mutation. ZIP preflight plus bounded actual inflation; use JSZip only after safe central-directory bounds and bounded extraction wrapper, and reject unsupported roots.
**Tests:** full/scoped export, cross-session durable base mock, wrong owner/digest/missing/expired export, V1 rejection, context not accepted as operations, JSON and image ZIP roundtrip, duplicate paths/zip bomb/encrypted/symlink/ZIP64/CRC/truncation, atomic rejection, explicit no partial mutation. Replayed operations reconcile to no-op.
**Commands:** common, focused ai/files and ai operation/archive prompt tests.
**Acceptance:** operations.json is the sole returned operation filename; unchanged context images are read-only, returned image operations share core semantics.

## AI-FILE-02: File-First And Connections UI

**Depends:** AI-FILE-01. **Unblocks:** INTEGRATION-01.
**Owns:** ai/AiArchiveSection.tsx; new ai/AiFileArchiveSection.tsx (does not currently exist); ai/connections/{ConnectedAssistantsSection,ConnectionCreateDialog,ConnectionList}.tsx, connectionConfig.ts and tests.
File section takes {draft: ContentDraft, flush:()=>Promise<boolean>, applyCandidate:(base, candidate)=>Promise<boolean>, exportRepository}; compose ChatGPT first, connections second. Connected section takes {repository: ConnectionRepository, authUrl:string, dataApiUrl:string}; interface from 16. Integration supplies real service. No stub happy-path data in final UI.
Implement preview/apply/validation/error states, clean flush requirement, one-time config generation with crypto, disclosure and expiry/revocation states. Use existing components/design tokens; PT-BR strings. Config generated only in explicit action, never cached. Remove new UI links to bridges; old module deletion waits LEGACY-01.
**Tests:** UI order, no clone/project login instructions, export/apply blocked while dirty flush fails, preview before apply, token not regenerated on rerender, raw token absent from storage/logs/list responses, close clears secret, same UUID on ambiguous retry, all-admin revoke and self creator, no publish switch.
**Commands:** common, focused ai presentation/files tests.
**Acceptance:** zero-setup flow first and actionable; portable MCP JSON schema matches 04 exactly, including BEMTEVI_AUTH_URL and exact package pin.
