# System Architecture

## Purpose

Define system boundaries for editorial content and AI assistance. This document answers where truth lives, which component may mutate what, and which architectures are explicitly forbidden.

## Sources of truth

### GitHub — software truth

GitHub owns:

- React/TypeScript application code.
- Database migrations and database function definitions.
- Validation logic and content operation protocols.
- MCP client source code and release/build configuration.
- Tests, CI, and engineering documentation.
- Bundled/generated fallback snapshots.

Coding agents MAY edit these artifacts when performing engineering work.

### Neon — editorial truth

Neon owns:

- The current published content.
- The current canonical editorial draft.
- Draft generation/concurrency metadata.
- AI connection/capability metadata.
- Temporary ChatGPT/file-edit export bases used for durable reconciliation.
- Short-lived publication preparations used by the guarded agent publication protocol.
- Publication history already supported by the application.

Editorial agents MUST NOT edit repository files to change production editorial content.

### Browser storage — local resilience only

IndexedDB MAY store:

- Unsynced local edits while a request is in flight or offline.
- The local base snapshot needed for three-way reconciliation.
- Local UI undo/history state.

IndexedDB MUST NOT be treated as the authoritative shared draft.
IndexedDB MUST NOT be the only copy of a ChatGPT/file-edit export base. Cross-browser/device imports recover that base from a temporary Neon `content_edit_exports` row.

## Runtime topology

```text
Authenticated admin browser
        |
        | Neon Auth + HTTPS
        v
Neon Data API ---------------------> Postgres
        |                               |
        |                               +-- published_content
        |                               +-- content_drafts
        |                               +-- content_agent_connections
        |                               +-- content_edit_exports
        |                               +-- content_publish_preparations
        |
        +<------------------------------+

External AI host (Codex/Claude/etc.)
        |
        | stdio MCP
        v
Standalone BemTeVi Content MCP
        |
        | HTTPS + restricted capability
        v
Neon Data API -> restricted agent RPCs -> canonical draft
```

There is **no BemTeVi application server** between these clients and Neon.

## Editor roles

A provider does not imply a role.

### Engineering agent

An engineering agent:

- Works in the Git repository.
- May modify application code, migrations, tests, and tooling.
- May use engineering database tooling for schema/migration work.
- MUST NOT implement editorial requests by manually changing bundled content files.

### Editorial agent

An editorial agent:

- Works through the BemTeVi editorial protocol.
- Reads and mutates the canonical Neon draft.
- Does not need or receive the repository.
- Does not receive raw SQL, schema mutation, or arbitrary/raw publication capabilities. It MAY invoke the guarded two-phase draft publication protocol when the user explicitly requests publication.

Each connection is bound to exactly one admin principal. An agent action is authorized and attributed as an action by that principal, while the connection id and `actor_kind = agent` remain available for execution audit. A connection must not be shared between admins.

## Trust boundary

A capability secret grants delegated editorial authority over the fixed V2 surface. It is not an adversarial sandbox around an otherwise untrusted secret holder.

Postgres is authoritative for authentication, capability expiry/revocation, operation structure and size bounds, generation compare-and-swap, publication revision checks, and transactional state transitions. The browser and standalone MCP consume the same `content-core` implementation for complete semantic validation and reconciliation.

Drafts may be temporarily semantically invalid while an editor is working. Official dashboard and MCP flows MUST run complete `content-core` validation before requesting publication. The architecture does not claim that Postgres independently reproduces the full TypeScript domain validator or prevents a malicious capability holder from bypassing that client-side semantic validation.

## Published content vs. draft content

`published_content` remains the public/live content source.

`content_drafts` becomes the canonical in-progress editorial workspace.

Editing a draft and publishing are different operations. Draft mutations MUST NOT publish implicitly.

## V2 shared workspace scope

V2 uses one shared active editorial workspace for admins. This is intentionally collaborative: multiple admins and connected editorial agents can target the same draft and therefore use the same concurrency model.

Future support for multiple named editorial branches/drafts is out of scope for V2 unless explicitly added to this source of truth.

## Forbidden architectures

Implementation MUST NOT introduce any of the following:

- A required `git clone` for content editors.
- A filesystem DraftStore as canonical state.
- A required localhost sync server between dashboard and draft state.
- A broad Neon MCP as the editorial mutation interface.
- A database connection string or Neon API key in the editorial MCP.
- Reusing an administrator browser session as the editorial MCP credential.
- AI tools that can publish arbitrary content or bypass the guarded `prepare_publish` + `publish_draft` protocol.
- Direct AI edits to `src/content` or generated content snapshots.
- A new general-purpose BemTeVi backend solely to host the MCP.

## Generated fallback content

Bundled repository content remains fallback/generated data. It SHOULD be regenerated from Neon through an explicit engineering process. It MUST be treated as read-only from an editorial workflow perspective.
