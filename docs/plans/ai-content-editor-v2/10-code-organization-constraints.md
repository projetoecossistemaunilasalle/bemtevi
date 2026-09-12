# Code Organization Constraints

Revision 5. Source boundaries and paths are normative. Internal helper splits inside task-owned subtrees are allowed; public entry points, dependency direction and file budgets are not optional.

## Physical Line Budgets

| File kind                                | Soft target | Hard maximum |
| ---------------------------------------- | ----------: | -----------: |
| Production .ts                           |         200 |          300 |
| Component/hook .tsx                      |         220 |          320 |
| Test `.test.ts(x)` or `__tests__` source |         350 |          500 |
| Tooling .mjs                             |         220 |          320 |

Count physical lines by normalizing CRLF to LF, removing at most one terminal newline, then splitting on LF; empty file counts zero. Include blanks/comments. Scan `src/`, `scripts/`, `packages/`, `neon/tests/` (handwritten source), including untracked files. Ignore `node_modules` variants, `.worktrees`, `dist`, `coverage`, `.git`, generated filenames beginning `generated-`, `src/content/generated/**`, declarations `*.d.ts`, migrations, lockfiles, documentation and binary fixtures.

Existing over-budget files are allowlisted **only** at the frozen counts in [architecture-baseline.json](architecture-baseline.json), captured during Stage 0. INTEGRATION-00 copies this exact map to scripts/architecture-baseline.json; never regenerate it from a later enlarged worktree. Missing paths are permitted after deletion, shrinking never permits subsequent growth above original limit. New extracted modules cannot inherit old oversized limits. No new entries without change control.

## Automated Gate

scripts/check-architecture.mjs enforces source budgets, no baseline growth and dependency boundaries using TypeScript AST import/export/dynamic import/require string literals (TypeScript dependency already exists). Reject computed imports in content-core/content-mcp production source. Build metafile check confirms installed MCP imports only bundled code or declared public runtime packages, never repo source.

Forbidden edges:

- core -> src/, packages/content-mcp, React, Neon, MCP, `node:*`, DOM runtime/FileReader/window/document.
- frontend -> packages/content-mcp internals or scripts/content-agent.
- MCP -> src/, legacy scripts, filesystem/process execution/Git. Bootstrap may use process stdio/env/signals, not child_process. Test/build tooling can use filesystem/subprocess in explicitly non-runtime paths.
- core and MCP -> generated fallback corpus (even via type-only repository-relative import).
- final product -> legacy draft-sync/agent-bridge imports.

Exact MCP/package version pins and config fixtures are asserted by unit/architecture tests. Publication guards and secret redaction need behavioral tests, not a claim that string scanning proves security. Gate scans committed config fixtures for non-placeholder BEMTEVI_AGENT_TOKEN and never prints secret values. Test fixtures use clearly tagged deterministic fake tokens. A generic secret scanner is not claimed to identify every possible secret.

Root check includes architecture after tests, plus MCP build once package lands. Root Windows/WSL runner remains the only root command adapter. Package test/build scripts do not silently omit core/MCP typechecks.

## Fixed Ownership Boundaries

- packages/content-core/src/model: content types/constants only, no editorial corpus.
- packages/content-core/src/validation: existing semantic validators split by concern.
- packages/content-core/src/contracts: wire types, errors, operations.
- packages/content-core/src/operations and images: parser/application/encoding/validation.
- packages/content-core/src/content-reconciliation: existing pure semantic compare/merge.
- src/dev-dashboard/drafts: repository, coordinator, polling, state/conflict presentation.
- src/dev-dashboard/draft-storage: React hook, IndexedDB adapter, read-only legacy recovery.
- src/dev-dashboard/ai/files: durable export transport, bounded ZIP parse/create, prompts.
- src/dev-dashboard/ai/connections: metadata transport, one-time secret config and UI.
- packages/content-mcp/src/server: composition/dispatch/instructions only.
- packages/content-mcp/src/tools: one handler per named tool, strict schema definitions.
- packages/content-mcp/src/client: Data API transport/error mapping.
- packages/content-mcp/src/session: bounded volatile cache/limiter.
- neon/tests: actual DB integration harness, excluded from credential-free unit suite.

Exact create/modify/delete ownership lives in tasks, not independently negotiated folder names. DashboardRoute stays composition-only for new work and may not grow beyond 1108 physical lines. Existing 371-line publishedContent validator is extracted into under-budget modules; no draft/auth logic is added to it.

Compatibility facades are thin re-exports, not parallel validators. They can remain as stable import paths after V2 if they contain no old persistence behavior. Old V1 operations and legacy hook adapters are removed at LEGACY-01.

## Non-Contractual Freedom

Private variable names, algorithm-preserving helper extraction inside owned new subtrees, equivalent CSS using existing tokens, and PT-BR explanatory copy not frozen in 16 are implementation freedom. They cannot change storage, security, interoperability, ownership, external types, state transitions, test acceptance or user capabilities.
