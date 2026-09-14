# Executor Dispatch — V2 Dossier Completion

You are the execution agent for the BemTeVi repository at `C:\Users\Vitor\Desktop\Vinicius\Projetos\bemtevi` (Windows, Git Bash).

Your single instruction source is:

**`docs/plans/ai-content-editor-v2-revision-8/REMAINING-WORK-EXECUTION-BUNDLE.md`** (read it first, completely, before doing anything else).

INTEGRATION-03 is complete. Execute the remaining tasks in the literal serial order: LEGACY-00 → LEGACY-01 → LEGACY-02 → PRAGMA-STRIP → INTEGRATION-04, then the completion audit at the end of the bundle. LEGACY-00 is the required change-control handback that removes surviving V2/public dependencies on `dashboardStorage.ts`; it does not authorize keeping that file. You may use your own subagents for implementation and review of each task; every decision you need is already made in the bundle — do not reinterpret, and when reality differs from the bundle, STOP that slice and report the exact mismatch with evidence instead of improvising.

Repository state: all work through INTEGRATION-03 is committed on `main` (base commit `cc61a67fd99a70ff83be0ae7b7f4665027ac565d`; DB-04 handback `6f64794`, INTEGRATION-03 `cc61a67`), the working tree was clean when bundle revision 3 was authored, and `check`, `check:db`, and `check:mcp-package` are green there. Start with LEGACY-00 after the commit containing this dispatch update. Per the bundle's Ground rules, commit each completed task (never push), so HEAD advances only through the alignment commit and your task commits.

Supplementary sources when a task references them (all inside `docs/plans/ai-content-editor-v2-revision-8/`): the dossier task files under `tasks/`, the frozen contracts `14/15/16-*.md`, the upstream handoffs under `handoffs/` (DB-04 and MCP-04 are essential for INTEGRATION-03), and root `AGENTS.md` for the quality gates.

Report after each task with that task's handoff file written into `handoffs/` (prettier-formatted), and a final message summarizing all tasks, exact gate results, and any STOP/change-control items.
