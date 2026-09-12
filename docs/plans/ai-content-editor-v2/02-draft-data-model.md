# Draft Data Model

V2 uses a single canonical draft with id `current`, initialized transactionally from an existing published snapshot. It has generation-based compare-and-swap; publication advances its base revision and generation atomically without deleting the workspace.

The **exact** table columns, constraints, indexes, RLS/grants, migration names, function signatures, errors and transaction algorithms are frozen in [15-database-contract.md](15-database-contract.md). Wire types, operation semantics and digest rules are frozen in [14-contracts.md](14-contracts.md). Implement those contracts, not a new interpretation of this summary.

## Persistence Boundaries

- `content_drafts`: canonical payload, generation and actor audit.
- `content_agent_connections`: delegated principal, SHA-256 secret hash, one-calendar-year nonrenewable expiry and revocation. No raw tokens.
- `content_edit_exports`: full owner-only reconciliation base for 14 days, at most five active per creator, with selection metadata.
- `content_publish_preparations`: ten-minute immutable generation/revision/digest bindings and replay-safe terminal results for both admin and agent publication.

All four tables are RPC-only for API roles, including authenticated admins. Existing `admin_users` membership remains the authorization source. Public published-content reads and existing publication history are preserved.

## Validation Boundary

Database checks cover authorization, JSON/operation/image-container bounds, identity, CAS and atomicity. Complete semantic validation runs in shared content-core. Structurally valid drafts can be semantically invalid; clients display issues and block publication. A no-op save does not increment generation. A stale no-op still fails its generation check.

The draft is not long-term version history. Browser cache and local undo are recovery aids, not another canonical store. Publication history continues to archive the previous live revision through the existing trigger.
