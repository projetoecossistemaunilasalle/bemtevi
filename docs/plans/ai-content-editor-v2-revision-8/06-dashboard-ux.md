# Dashboard UX

The exact service APIs, save/recovery/publication state transitions and PT-BR save copy are frozen in [16-dashboard-state-machine.md](16-dashboard-state-machine.md). Follow the existing design system; no redesign or new provider-selection architecture.

## Information Architecture

1. `Ajuda rápida com ChatGPT`: default, no-installation export/import. Export current selected material or whole corpus only after flushing local edits. Assistant returns operations.json, never context.json or data.json. Preview and explicitly apply returned operations against the durable owner-only Neon base.
2. `Assistentes conectados`: advanced standalone MCP setup, connection name, creation, one-time secret configuration, expiry, last use and confirmed revocation.

Connection UI discloses that assistant acts as its creating admin, can edit and perform guarded publication, expires after one year and must not be shared. No publish-permission toggle, repo clone, local bridge, project command, or administrator login instructions for the assistant.

## Concurrent Editing

React updates immediately, cache at 250 ms, canonical saves at 750 ms trailing/5-second maximum wait. Only one mutation in flight. Preserve edits typed during save and rebase them on acknowledged merged candidate. Poll head at 15 seconds while visible and on focus/online. Payload is fetched only for initial load/new remote state/recovery, not unchanged head polling.

Automatic complete merge is nonblocking with `Alterações de outro editor foram combinadas`. Unresolved conflicts suspend autosave and show `Sua alteração` versus `Rascunho atual do BemTeVi`. Never reuse a conflict decision after its input fingerprint changes. No AI-specific shadow draft.

## Publication

Flush, validate exact canonical generation, show complete shared-draft diff, explicit Publicar, prepare and publish through database transaction. No direct published_content update after cutover. Intervening changes close confirmation and require review. Public read/query refresh follows success; other editors' newer changes must not be overwritten with the publication result. Rollback disables mutation and preserves canonical data.
