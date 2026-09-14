# Executor Dispatch — V2 Dossier Completion

You are the execution agent for the BemTeVi repository at `C:\Users\Vitor\Desktop\Vinicius\Projetos\bemtevi` (Windows, Git Bash).

Your single instruction source is:

**`docs/plans/ai-content-editor-v2-revision-8/REMAINING-WORK-EXECUTION-BUNDLE.md`** (read it first, completely, before doing anything else).

Execute its tasks in the literal serial order: INTEGRATION-03 → LEGACY-01 → LEGACY-02 → PRAGMA-STRIP → INTEGRATION-04, then the completion audit at the end of the bundle. You may use your own subagents for implementation and review of each task; every decision you need is already made in the bundle — do not reinterpret, and when reality differs from the bundle, STOP that slice and report the exact mismatch with evidence instead of improvising.

Repository state: all work through INTEGRATION-02 is committed on `main` (base commit `91d3efe61780509a73303c1d0ca9be212f938b65`), the working tree is clean, and the full gate is green there. Per the bundle's Ground rules, you commit each completed task (never push), so HEAD advances only through your own task commits.

Supplementary sources when a task references them (all inside `docs/plans/ai-content-editor-v2-revision-8/`): the dossier task files under `tasks/`, the frozen contracts `14/15/16-*.md`, the upstream handoffs under `handoffs/` (DB-04 and MCP-04 are essential for INTEGRATION-03), and root `AGENTS.md` for the quality gates.

Report after each task with that task's handoff file written into `handoffs/` (prettier-formatted), and a final message summarizing all tasks, exact gate results, and any STOP/change-control items.
