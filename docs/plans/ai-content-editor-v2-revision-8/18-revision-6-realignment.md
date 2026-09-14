# Revision 6 Repository Realignment

> Historical record. Revision 8 supersedes Revisions 6 and 7 wherever current task ownership, dependency sequencing, field/policy/flag exactness, or gate handoff differs. Use README, 08, 14–16, 20, and the task files as current authority.

## Summary

Revision 6 is not a V2 redesign. It reconciles the implementation dossier with repository changes that landed after revision 5.

**Audited base:** `e030264786ae7010aac7832203244882d12f9265`.

## Changed

- repository-base drift preflight;
- current architecture baseline;
- current 500-line global architecture ceiling;
- INTEGRATION-00 changed from create-first to adopt/verify/patch;
- current source/test ownership;
- `DashboardTabContent.tsx` added to integration/cleanup ownership;
- MERGE-01 extraction map updated for split flow-validation modules;
- DASHBOARD-03 test ownership updated for split storage suites;
- readiness evidence no longer cites removed test files or stale line counts.

## Unchanged

- system topology and sources of truth;
- single canonical draft;
- CAS and semantic reconciliation;
- TypeScript operation/error/image/export contracts;
- database tables/RPCs/RLS/grants/transactions;
- dashboard state machine;
- MCP tools/config/pins/instructions;
- file archive and image bounds;
- migration/cutover intent;
- task dependency graph;
- guarded publication requirement.

## Weak-model instruction

Do not infer intent from an old task verb like “create”. Check the audited base. Existing conforming scaffolding is retained. Existing partial scaffolding is patched. Removed monoliths are not recreated.

If the current checkout differs in V2-sensitive paths from the audited base, stop and invoke dossier change control rather than improvising.
