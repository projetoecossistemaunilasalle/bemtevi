# Concurrency and Semantic Merge

## Purpose

Use one concurrency system for every editor: multiple admins, multiple tabs, and AI assistants.

## Core rule

**Detection happens in Neon. Resolution happens in the client/domain reconciliation layer.**

Neon MUST NOT implement a second semantic merge algorithm in SQL.

## Optimistic concurrency

Every content-changing draft mutation is conditional. An identical candidate is a no-op with no generation increment; stale no-op requests still fail CAS. Exact RPC and digest contracts are in [14-contracts.md](14-contracts.md) and [15-database-contract.md](15-database-contract.md).

```text
client read generation N
        |
        v
edit locally
        |
        v
write(expectedGeneration = N)
        |
        +-- success -> generation N + 1
        |
        +-- stale -> conflict; never overwrite
```

The persistence layer MUST implement the equivalent compare-and-swap behavior through the frozen draft mutation RPC:

```sql
UPDATE content_drafts
SET payload = :payload,
    generation = generation + 1,
    updated_at = now()
WHERE id = :draft_id
  AND generation = :expected_generation
RETURNING ...;
```

The mutation RPC accepts item-level operations rather than an unrestricted replacement payload. It applies those operations to the generation it conditionally owns, increments the generation exactly once when content changes, and returns the resulting head and changed flag. No-op behavior is defined above.

After an ambiguous network result, a client MUST fetch the current draft head/payload and compare the attempted candidate with `sameContent` before reconciling. Database digests are verified using returned canonical text, not local JSON.stringify. It MUST NOT blindly retry the operation against a newer generation.

## Reuse existing reconciliation

The existing semantic reconciliation code is the basis for V2. Do not create an AI-specific merge engine.

The current three inputs are exactly what V2 needs:

- **base** — payload at the generation the editor started from.
- **local** — editor's locally changed candidate.
- **remote** — newest canonical draft payload from Neon.

Use the existing semantic content reconciliation behavior:

- If only local changed a value, keep local.
- If only remote changed a value, keep remote.
- If both reached the same value, keep it.
- If both changed the same semantic value differently, create a conflict.
- Preserve item identity by id.
- Reconcile compatible ordering changes when possible.
- Treat unresolved order conflicts as real conflicts.

## Code placement

The reconciliation code MUST no longer conceptually belong only to publishing.

Canonical package location:

```text
packages/content-core/src/content-reconciliation/
  types.ts
  identity.ts
  compareContent.ts
  reconcileContent.ts
  describePath.ts
  index.ts
```

The files inside that package may be split further without changing its public API, but `publishing/semanticDiff.ts` MUST NOT remain the long-term owner of generic edit concurrency.

Compatibility wrappers remain during extraction as required by MERGE-01 and MERGE-03. The exact cleanup and permitted thin re-exports are defined in LEGACY-01 and 10; workstreams do not independently decide deletion timing.

## Dashboard conflict flow

When a dashboard save receives `stale_generation`:

1. Preserve the user's local candidate.
2. Fetch the latest remote draft.
3. Use the locally retained base payload and the semantic reconciler.
4. If merge is complete, attempt a new conditional save against the new remote generation.
5. If merge is incomplete, show the existing semantic conflict UI adapted to draft editing.
6. After the admin resolves conflicts, save the resolved candidate conditionally against the latest generation.

Each save cycle permits at most one automatic merge-and-CAS retry. A second intervening generation enters explicit conflict/reload handling; it MUST NOT create an automatic retry loop.

## Agent conflict flow

The MCP applies the exact same model.

The MCP process MUST cache the base snapshot under the exact three-entry/15-minute policy in 04. When applying operations:

1. Build the local candidate by applying agent operations to the cached base.
2. Attempt the conditional write.
3. On stale generation, fetch remote.
4. If the base snapshot is available, run the same semantic reconciliation.
5. If the merge is complete, retry once against the newest generation.
6. If unresolved conflicts remain, return structured conflict data to the AI host.
7. If the MCP no longer has the required base snapshot (for example after restart), return `rebase_required`; never blindly reapply intent to unknown newer content.

The volatile MCP base cache is sufficient only for a live connected-agent session. ChatGPT/file exports use the durable `content_edit_exports` base in Neon and do not depend on this process cache or on a particular browser's IndexedDB.

## Publication concurrency

Publication is a single database transaction. The transaction locks the preparation, canonical draft, and current published row; verifies connection validity, prepared generation/digest, and expected revision; then updates publication/history, draft `base_revision`/generation, preparation outcome, and actor metadata together.

A successfully consumed preparation is replay-safe: the same valid connection and preparation token receive the recorded successful revision. A failed or stale preparation can never be rebound to another draft generation, digest, or publication revision.

## Conflict identity

Conflict ids MUST remain tied to the semantic path and input values so a decision cannot be accidentally reused after an overlapping remote edit. Preserve the existing fingerprint/identity behavior unless tests prove a deliberate replacement is equivalent.

## No special AI concurrency table

V2 MUST NOT introduce a separate `ai_proposals` concurrency system solely because the editor is an AI. A connected agent is another editor of the same draft.

A future proposal/review feature may be added as a product feature, but it must be explicitly justified and must not replace the universal generation + reconciliation model.

## Required concurrency tests

At minimum:

- Admin A edits title; Admin B edits description -> automatic merge succeeds.
- Admin A and Admin B edit same title differently -> semantic conflict.
- Admin reorders one collection while another edits an item -> merge behaves according to existing semantics.
- Admin deletes an item while agent edits the same item -> conflict, not resurrection or silent deletion.
- Two simultaneous saves with the same expected generation -> exactly one wins.
- Stale client with no base snapshot -> safe failure.
- Auto-merge retry encountering another intervening generation -> bounded retry and safe conflict result.
