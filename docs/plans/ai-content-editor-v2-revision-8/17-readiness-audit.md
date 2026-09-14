# Stage 0 / Revision 8 Readiness Audit

**Date:** 2026-09-12  
**Specification revision:** 8  
**Audited implementation base:** `e030264786ae7010aac7832203244882d12f9265`  
**Result:** `IMPLEMENTATION_READY` against this repository shape after executor-determinism hardening. This is not a claim that V2 runtime code, live database gates, npm publication or production deployment are complete.

## Why Revision 8 exists

Revision 6 realigned the dossier to the post-remediation repository. Revision 7 clarified feature-repository versus authenticated-Neon composition and the packed/live MCP gate handoff. A new literal-executor review against the same repository base then found one impossible task sequence and several avoidable inference points:

1. DB-02/DB-03 instructed `check:db` before DB-04 creates the fail-closed `neon/tests/run.ts` harness.
2. INTEGRATION-02 had regressed from exact path ownership to phrases such as “files explicitly needed,” while temporary `legacyPublication.ts` lacked an explicit creation owner.
3. task-local ownership and 08's central ownership table disagreed around integration/legacy hot files.
4. the operation contract referred to V1 `ITEM_KEYS`/domain optionality instead of freezing V2 add/update/unset key lists.
5. cutover SQL referred to “the two administrator policies” instead of their audited literal names.
6. Vite feature-flag parsing did not specify string semantics.
7. DB-04's pinned CLI requirement still left command-shape discovery during a security-sensitive provisioning task.
8. INTEGRATION-03/04 retained conditional or non-executable ownership language even though audited CI/DB discovery already exists.

Revision 8 closes these execution ambiguities without changing the product/source-of-truth/security/concurrency/publication architecture.

## Repository evidence revalidated

Connected GitHub inspection confirmed on 2026-09-12:

- repository `main` remains exactly `e030264786ae7010aac7832203244882d12f9265`, so the audited implementation base did not drift during this revision pass;
- root `package.json` already has V2 command/dependency scaffolding and the pinned package-manager/development dependency versions expected by INTEGRATION-00;
- `@bemtevi/content-mcp` scaffold is version `1.0.0` with exact `@modelcontextprotocol/server` `2.0.0` dependency;
- `scripts/run-project-command.mjs` deliberately fails `check:db` if `neon/tests/run.ts` is absent, proving DB-01..03 cannot literally run that command before DB-04;
- `.github/workflows/ci.yml` already contains the protected `v2-database` job and invokes `pnpm run check:db`;
- `neon/tests/vitest.config.ts` already discovers `**/*.test.ts`, so INTEGRATION-03 does not need root CI edits for its new live test files;
- `DashboardRoute.tsx` and `DashboardTabContent.tsx` are separate audited composition files;
- current publication still exposes direct table writing through `publishedContentRepository`/provider/context/controller seams that INTEGRATION-02 can name exactly;
- audited `published_content` write policies are literally `"Administrators can create published content"` and `"Administrators can update published content"`; public-read policy is distinct and must survive cutover;
- legacy local content-agent/agent-bridge/draft-sync paths and old browser-canonical storage remain present for later verified cleanup;
- `.mcp.json` and `.cursor/mcp.json` contain a legacy `bemtevi-content` repository MCP entry while `.vscode/mcp.json` contains only unrelated Neon MCP configuration.

## Revision 8 contract closures

### Gate sequencing

DB-01, DB-02 and DB-03 author live suites but never invoke `check:db`. Their handoffs record an explicit deferral. DB-04 creates the one live harness and executes the accumulated suites before Gate B can be green.

### Exact operation surface

14 now contains literal add/update/unset field lists for every scope. V2 implementation may not consult the V1 `ITEM_KEYS` object or infer unsetability from optional TypeScript properties. Generic education-material updates cannot mutate protected top-level image slots; retained image-block slot changes use the specialized image contract.

### Exact integration/coexistence ownership

INTEGRATION-02 names the route/tab, feature flags, draft UI/hook, publication/provider files and exact temporary `src/dev-dashboard/publishing/legacyPublication.ts`. The V2 branch never imports/falls back to that adapter. LEGACY-01 later deletes it and exact V1/local persistence artifacts. LEGACY-02 removes the enablement branch and old root/config/docs commands while retaining emergency read-only mode.

### Exact flag semantics

Only the exact JavaScript string `"true"` enables `VITE_EDITOR_V2_ENABLED` or `VITE_EDITOR_READ_ONLY`; all other/missing values are false. After LEGACY-02, the enablement flag is removed and V2 is unconditional while read-only remains.

### Exact cutover policy names

15 now freezes literal `DROP POLICY IF EXISTS` names for the two audited administrator write policies and explicitly preserves the anonymous/authenticated public-read policy.

### Pinned DB provisioning command contract

DB-04 freezes the allowed `neon@4.14.6` command/flag shapes and requires the local binary version check. If the pinned binary rejects those shapes, the implementer reports specification drift with help output rather than improvising another management client or hidden context.

### Verification-only endgame

INTEGRATION-03 owns no root CI composition. INTEGRATION-04 owns no source/config and has an exact final command sequence. A final-gate failure returns to its actual owner/change control.

## Readiness boundary

Gate S means an implementation model should not need to decide:

- an alternative domain/operation/image contract;
- an alternative database/RPC/publication architecture;
- an alternative feature repository/Neon composition scheme;
- an alternative DB harness ordering/provisioning command family;
- an alternative V2/legacy coexistence file boundary;
- an alternative feature-flag truthiness rule;
- or a second live MCP provisioning harness.

Normal local implementation freedom remains limited to private helper decomposition inside an owned subtree, naming of private symbols not frozen by the contract, and straightforward adaptation to already-audited public exports.

## What this audit did not prove

This specification pass did not execute the BemTeVi checkout's pnpm build/test/live Neon gates locally and did not apply migrations, create capabilities, publish packages, change production content, or deploy code. INTEGRATION-00 must run the real credential-free baseline in the implementer's checkout. DB-04 and later release tasks must run their credentialed gates with approved test credentials.

## Bundle verification requirements

The distributed Revision-8 ZIP is acceptable only if:

- every path listed in `SHA256SUMS.txt` hashes correctly;
- all internal Markdown links resolve within the complete bundle;
- numbered chapters 00–20, all task files, architecture baseline and apply helpers are present;
- current-authority revision labels are 8; mentions of revisions 6/7 are explicitly historical/contextual;
- suspicious open-ended ownership phrases are absent from normative `Owns` sections;
- the audited base SHA is consistent across current-authority documents.

No documentation evidence waives implementation Gates A–F.
