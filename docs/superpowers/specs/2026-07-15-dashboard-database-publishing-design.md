# Dashboard Database Publishing Design

## Goal

Replace the dashboard's primary ZIP export action with an explicit database publish action. Editors continue working in local browser drafts. A valid draft becomes live content only when an authenticated administrator clicks `Publicar alteracoes`.

Keep the ZIP workflow as an environment-controlled fallback for development and recovery.

## Current State

The dashboard currently:

- reads a baseline from TypeScript content modules;
- stores sparse edits in `localStorage`;
- merges those edits over the shipped baseline for preview and validation;
- exports changed records and uploaded images as a ZIP file;
- authenticates administrators through Neon Auth and checks membership in `public.admin_users`.

Public routes still import their content directly from TypeScript modules. Neon currently contains only the administrator authorization schema, not live content.

## Decisions

### Publishing model

Local drafts remain the editing layer. Field changes must not write to Neon. The dashboard validates the merged draft and publishes only after an explicit confirmation.

Publishing writes one complete content snapshot rather than the current changed-record export bundle. A complete snapshot makes publication atomic, represents deletions without tombstone logic, and does not depend on the exact code version used as the original baseline.

### Persistence mode

Add a build-time setting:

```text
VITE_DASHBOARD_PUBLISH_MODE=database|export
```

The default is `database`. Only the explicit value `export` enables the existing ZIP workflow.

Do not derive persistence mode from `VITE_DISABLE_AUTH`. Authentication bypass and persistence behavior are separate concerns. Database publication requires a real Neon Auth session so PostgreSQL RLS can authorize the write. Local mock-auth development that needs publishing must use `VITE_DASHBOARD_PUBLISH_MODE=export`.

`VITE_ENABLE_DEV_DASHBOARD` remains the master build-time switch for the admin routes. The existing Neon Auth and Data API URL settings remain unchanged.

### Snapshot scope

The published payload contains the complete runtime content needed by the current dashboard:

```ts
interface PublishedContentPayload {
  flows: GuidedFlow[];
  educationMaterials: EducationResource[];
  educationGroups: EducationResourceGroup[];
  contacts: ServiceDirectoryEntry[];
  defaultGroupOrder: number;
}
```

Database metadata is stored separately from the payload. Export-only metadata, validation results, local patch records, removal lists, and local timestamps are not published.

## Database Design

Create one singleton row in `public.published_content`:

```sql
create table public.published_content (
  id text primary key check (id = 'current'),
  schema_version text not null,
  revision bigint not null check (revision > 0),
  payload jsonb not null,
  published_at timestamptz not null default now(),
  published_by uuid not null references neon_auth."user" (id)
);
```

The table intentionally stores a single JSON snapshot. The content model is nested and consumed as complete arrays, so normalizing it now would add multi-table publication and deletion complexity without a current query requirement.

### Grants and RLS

- Enable RLS on `public.published_content`.
- Grant `select` to anonymous and authenticated Data API roles.
- Permit public reads of the `current` row.
- Grant `insert` and `update` only to the authenticated role.
- Require `public.is_admin()` for insert and update policies.
- Require `published_by::text = auth.user_id()` in write policy checks.
- Do not grant delete through the Data API.

The browser receives no connection string, API key, or privileged database credential.

### Revisions and conflicts

The initial database state may have no row. In that state, public consumers use shipped content and the first administrator publish inserts revision `1`.

Later publication updates only where `id = 'current'` and `revision` equals the baseline revision loaded by the editor. The update writes `revision + 1`. If no row is returned, another administrator published first. The dashboard must preserve the local draft, report a conflict, and offer a reload of the current published baseline. It must not silently overwrite newer content.

Two simultaneous initial inserts are resolved by the primary key: one succeeds and the other receives the same conflict treatment.

## Application Architecture

### Shared Neon client

Refactor Neon setup so authentication and content access use the same configuration and client abstraction. Keep auth behavior in the auth service, and add a focused content repository with these operations:

```ts
interface PublishedContentRepository {
  loadPublishedContent(): Promise<PublishedContentSnapshot | null>;
  publishContent(input: PublishContentInput): Promise<PublishedContentSnapshot>;
}
```

The repository owns Data API shapes and error mapping. UI components must not call Neon directly.

### Runtime content provider

Add one application-level content provider that:

1. starts with the bundled TypeScript content as a safe fallback;
2. requests the `current` database snapshot during application startup;
3. parses and validates the snapshot before exposing it;
4. replaces the fallback only when the full snapshot is valid;
5. exposes content, revision, loading state, source, refresh, and an in-memory replacement method after publish.

Orientation, education, contacts, and dashboard baseline reads must consume this provider instead of importing their runtime arrays directly. The TypeScript modules remain the bootstrap and outage fallback.

A successful publish updates the provider immediately in the admin's tab. Other open clients receive the new content on their next page load, window refocus, or explicit provider refresh. Real-time subscriptions and polling are out of scope.

An empty database is not an error. A failed or invalid database read keeps shipped content visible and records a recoverable load state; public pages must not become blank.

### Dashboard data flow

On dashboard entry:

1. Use the provider's current published snapshot, or shipped fallback, as the baseline.
2. Load the existing sparse `localStorage` draft.
3. Merge local edits over that baseline for editor rendering and validation.
4. Retain local autosave on every edit.

On publish:

1. Stop if validation contains errors or there are no changes.
2. Ask for confirmation.
3. Build the complete merged `PublishedContentPayload`.
4. Validate the complete payload again at the repository boundary.
5. Publish with the baseline revision.
6. Replace the provider snapshot with the returned row.
7. Clear local draft storage only after the database confirms success.
8. Reset the dashboard baseline and show the new revision and publication time.

If publication fails, keep all local drafts and leave the action retryable.

## Dashboard UI

In `database` mode, rename the Export tab and its primary action around publication rather than file generation. Keep the existing change summary and validation gating.

The publication view shows:

- counts of added, edited, and removed records;
- the current baseline revision and publication time when available;
- `Publicar alteracoes` as the primary action;
- an explicit confirmation step;
- pending, success, conflict, authentication, and generic failure states;
- a stale indicator when edits occur after the last successful publication.

In `export` mode, retain the current ZIP behavior and wording. The two modes share change counting and validation but use separate persistence actions.

## Uploaded Images

For this migration, uploaded images remain data URLs inside education-resource JSON. This keeps a snapshot self-contained and preserves existing public rendering behavior without adding a second storage product.

Add validation that rejects source image files larger than 1 MiB and rejects a complete serialized published payload larger than 5 MiB. Existing external URLs and bundled catalog image identifiers remain unchanged. Moving uploaded images to object storage is a later optimization, not part of this change.

## Failure Handling

- Missing Neon configuration: public app uses shipped content; database publish reports configuration unavailable.
- Anonymous or mock-auth write: RLS rejects the operation; the dashboard preserves the local draft and explains that real administrator authentication is required.
- Network or Data API failure: retain fallback content for reads and retain local drafts for writes.
- Invalid database payload: ignore it, retain shipped content, and expose a recoverable load error for diagnostics.
- Revision conflict: retain local drafts and require baseline refresh before another publish attempt.
- Invalid local content: keep the publish button disabled through the existing validation summary.

## Migration and Rollout

1. Apply the content table and RLS migration after the existing administrator migration.
2. Deploy code with database mode as the default and shipped content as the read fallback.
3. Sign in with a real authorized account and perform the first publish to create revision `1`.
4. Verify public routes read revision `1` without a redeploy.
5. Keep `VITE_DASHBOARD_PUBLISH_MODE=export` documented as the recovery path.

No one-time SQL seed is required because an empty table deliberately falls back to shipped content.

## Testing

Unit tests must cover:

- persistence-mode parsing and defaults;
- published snapshot parsing and complete-payload validation;
- empty, successful, invalid, and failed database reads;
- initial insert, revisioned update, RLS error mapping, and conflict mapping;
- image and total payload size limits;
- local draft clearing only after successful publication.

Integration tests must cover:

- public screens rendering database content rather than bundled content;
- bundled fallback when no database snapshot exists or loading fails;
- all four content areas updating after a successful publish;
- validation disabling publication;
- a failed or conflicting publish preserving local drafts;
- database mode showing publication UI;
- export mode retaining the ZIP flow;
- mock auth not being treated as database authorization.

The migration should be reviewed to confirm that anonymous users can only read published content and only `public.is_admin()` users can insert or update it.

## Out of Scope

- per-field database autosave;
- draft rows shared between administrators;
- record-level normalized content tables;
- publication history or rollback UI;
- real-time push updates to already-open public sessions;
- object storage and image transformation;
- public content authoring permissions beyond the existing administrator allowlist.
