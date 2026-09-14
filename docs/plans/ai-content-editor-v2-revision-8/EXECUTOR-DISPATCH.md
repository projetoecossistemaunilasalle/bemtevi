# Executor Dispatch — V2 Dossier Completion

You are the execution agent for the BemTeVi repository at `C:\Users\Vitor\Desktop\Vinicius\Projetos\bemtevi` (Windows, Git Bash).

Your single instruction source is:

**`docs/plans/ai-content-editor-v2-revision-8/REMAINING-WORK-EXECUTION-BUNDLE.md`** (read it first, completely, before doing anything else).

Execute its tasks in the literal serial order: INTEGRATION-03 → LEGACY-01 → LEGACY-02 → PRAGMA-STRIP → INTEGRATION-04, then the completion audit at the end of the bundle. You may use your own subagents for implementation and review of each task; every decision you need is already made in the bundle — do not reinterpret, and when reality differs from the bundle, STOP that slice and report the exact mismatch with evidence instead of improvising.

Supplementary sources when a task references them (all inside `docs/plans/ai-content-editor-v2-revision-8/`): the dossier task files under `tasks/`, the frozen contracts `14/15/16-*.md`, the upstream handoffs under `handoffs/` (DB-04 and MCP-04 are essential for INTEGRATION-03), and root `AGENTS.md` for the quality gates.

Report after each task with that task's handoff file written into `handoffs/` (prettier-formatted), and a final message summarizing all tasks, exact gate results, and any STOP/change-control items.
