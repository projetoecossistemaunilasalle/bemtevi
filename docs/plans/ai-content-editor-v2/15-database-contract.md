# Frozen Database Contract

Revision 5. Public types are in [14-contracts.md](14-contracts.md). All tables below live in `public`. Foreign keys default to `ON DELETE RESTRICT`. Private functions live in unexposed `content_private`. Do not design SQL interfaces from the earlier logical inventory.

## Migration Order

1. `neon/migrations/20260910000000_content_draft_tables.sql`: private schema, four tables, checks/indexes, publication audit columns and history-trigger amendment.
2. `neon/migrations/20260910001000_content_draft_operations.sql`: structural/digest/image/operation helpers, admin read/initialize/mutate RPCs.
3. `neon/migrations/20260910002000_content_agent_connections.sql`: capability verifier, admin management, agent reads/mutations, durable file export RPCs.
4. `neon/migrations/20260910003000_content_draft_publication.sql`: preparation/publication helpers and admin/agent wrappers. Keep old admin publication privileges until cutover.
5. `neon/cutover/20260910004000_content_draft_revoke_direct_publish.sql`: **not automatically applied with additive migrations**. Run only after INTEGRATION-03 verification. Revoke INSERT/UPDATE/DELETE on `published_content` from authenticated/anonymous/PUBLIC; drop its two administrator write policies. Keep public SELECT and admin-only history SELECT.

Each file runs in a transaction. Revoke new-object default grants inside its creation transaction. Owner is existing migration owner. SECURITY DEFINER wrappers use `SET search_path = ''`, UTC timezone, fully qualified names, no overloads/default arguments. No pgcrypto dependency: use built-in `pg_catalog.sha256(bytea)`; clients generate random UUIDs/secrets.

Separate emergency artifact: `neon/cutover/disable_editorial_writes.sql` is operator-invoked only, never part of normal migration enumeration. It revokes EXECUTE from authenticated on apply_content_draft_operations, prepare_content_draft_publish, publish_content_draft and create_content_agent_connection; revokes EXECUTE from anonymous on agent_apply_operations, agent_prepare_publish and agent_publish_draft, using exact signatures below; marks all active connections revoked_at = clock_timestamp(). Keep all read and admin revoke/list/export-retrieval RPCs and published SELECT. Run after taking the UI read-only. In-flight transactions can finish before revocation is linearized; verify no new write succeeds afterward. Restore only by an owner-reviewed regrant of those exact V2 wrapper signatures, never by regranting direct published-table writes or unrevoking old connections.

## Exact Tables

All columns NOT NULL unless nullable. `counter` below means bigint with column CHECK BETWEEN 1 AND 9007199254740991, not a new SQL domain. `digest` means text CHECK matching `^[0-9a-f]{64}$`.

### content_drafts

| Column                 | Definition                                            |
| ---------------------- | ----------------------------------------------------- |
| id                     | text PK DEFAULT 'current', CHECK = 'current'          |
| schema_version         | text DEFAULT '1.0.0', CHECK = '1.0.0'                 |
| base_revision          | counter                                               |
| generation             | counter DEFAULT 1                                     |
| payload                | jsonb                                                 |
| digest                 | digest                                                |
| status                 | text DEFAULT 'active', CHECK = 'active'               |
| created_at             | timestamptz DEFAULT now()                             |
| created_by             | uuid FK neon_auth."user"(id)                          |
| updated_at             | timestamptz DEFAULT now()                             |
| last_actor_kind        | text CHECK IN ('admin','agent')                       |
| last_actor_id          | uuid; principal id for admin, connection id for agent |
| last_principal_user_id | uuid FK neon_auth."user"(id)                          |

CHECK admin actor id equals principal when kind admin. Agent consistency is enforced by helper because actor id is polymorphic. No extra index (singleton). base_revision is not FK because publications move into history. Wire lastActor.connectionId derives from kind/id.

### content_agent_connections

| Column            | Definition                                            |
| ----------------- | ----------------------------------------------------- |
| id                | uuid PK, caller generated                             |
| draft_id          | text FK content_drafts(id), CHECK = 'current'         |
| principal_user_id | uuid FK neon_auth."user"(id)                          |
| label             | text CHECK char_length(btrim(label)) BETWEEN 1 AND 80 |
| token_hash        | bytea CHECK octet_length = 32                         |
| created_at        | timestamptz DEFAULT now()                             |
| expires_at        | timestamptz CHECK = created_at + interval '1 year'    |
| revoked_at        | timestamptz nullable                                  |
| last_used_at      | timestamptz nullable                                  |

Server assigns expiry under UTC: calendar year, not 365 days. Index `(principal_user_id, created_at DESC, id)`. No renewal/delete RPC. Every agent call also verifies principal membership in admin_users. All admins can list metadata and revoke any connection; creation always binds to self. Revoke preserves original timestamp on replay. Rows retained for audit.

### content_edit_exports

| Column             | Definition                                          |
| ------------------ | --------------------------------------------------- |
| export_id          | uuid PK, caller generated                           |
| draft_id           | text FK content_drafts(id), CHECK = 'current'       |
| schema_version     | text CHECK = '2.0.0'                                |
| base_generation    | counter                                             |
| base_digest        | digest                                              |
| published_revision | counter                                             |
| base_payload       | jsonb                                               |
| selection          | jsonb nullable, exact shape in 14                   |
| created_by         | uuid FK neon_auth."user"(id)                        |
| created_at         | timestamptz DEFAULT now()                           |
| expires_at         | timestamptz CHECK = created_at + interval '14 days' |

Indexes `(created_by, created_at DESC, export_id)` and `(expires_at)`. Capture full draft and live publication atomically. Lock creator's admin_users row to serialize pruning; remove expired rows, insert, delete that creator's rows after newest five ordered `(created_at DESC, export_id DESC)`. Concurrent creation cannot exceed cap. Retrieval is owner-only even for other admins. Return `canonicalPayload = base_payload::text`. Expiry enforced on read even without pruning. No cleanup service.

### content_publish_preparations

| Column            | Definition                                                                 |
| ----------------- | -------------------------------------------------------------------------- |
| id                | uuid PK, caller generated                                                  |
| draft_id          | text FK content_drafts(id), CHECK = 'current'                              |
| actor_kind        | text CHECK IN ('admin','agent')                                            |
| principal_user_id | uuid FK neon_auth."user"(id)                                               |
| connection_id     | uuid nullable FK content_agent_connections(id)                             |
| generation        | counter                                                                    |
| expected_revision | counter                                                                    |
| candidate_digest  | digest                                                                     |
| token_hash        | bytea CHECK octet_length = 32                                              |
| created_at        | timestamptz DEFAULT now()                                                  |
| expires_at        | timestamptz CHECK = created_at + interval '10 minutes'                     |
| outcome           | text DEFAULT 'pending', CHECK IN ('pending','published','stale','expired') |
| completed_at      | timestamptz nullable                                                       |
| result            | jsonb nullable; exact PublishResult from 14                                |

CHECK `(actor_kind = 'agent') = (connection_id IS NOT NULL)`. result nonnull iff published; completed_at nonnull iff not pending. Indexes `(connection_id, created_at DESC)` and `(principal_user_id, created_at DESC)`. Small rows retained for replay/audit, no payload snapshots. Preparing again does not invalidate another pending preparation; generation advancement does.

### Publication Audit

Add nullable `published_via_connection_id uuid REFERENCES content_agent_connections(id)` to current/history tables. Existing rows stay null. Amend `archive_published_content()` to copy OLD connection column in INSERT and conflict-update. Keep existing trigger, do not insert duplicate history in publisher. published_by always principal admin, never connection UUID.

## Authorization

- Four new tables: ENABLE RLS, no policies, REVOKE ALL from PUBLIC/anonymous/authenticated. All access is RPC-only, including admins. Never expose hash columns or direct CAS bypasses.
- content_private: no schema USAGE or helper EXECUTE to API roles/PUBLIC. Migration owner calls helpers through public wrappers. Never grant owner membership to API roles.
- Public schema USAGE to anonymous/authenticated. Revoke each new function's default EXECUTE from PUBLIC and both API roles, then grant admin wrappers to authenticated only, agent wrappers to anonymous only. Leave unrelated content/analytics privileges unchanged.
- Admin wrappers call is_admin() and derive principal from auth.user_id(), never request fields. Authorization precedes any data-bearing error/head return.
- Agent verifier locks connection FOR UPDATE, checks decoded token hash, expiry with clock_timestamp(), revoked_at, draft binding, and current admin membership. Missing/invalid/expired/revoked/removed-principal all return invalid_capability. Token is 43-character canonical unpadded base64url encoding exactly 32 bytes; hash **decoded bytes**, not token text.
- last_used_at updates at most once per 15 minutes after successful authentication (including a later domain failure); invalid authentication never updates it. Revocation uses same lock, so in-flight work can commit first, but every call starting after revoke completes fails.
- SQL owns structural/image-container/byte bounds, identity, CAS and transactions, not complete semantic validation or human publication intent. No claim of timing-side-channel immunity from a regular digest equality comparison.

## Exact RPC Catalog

Every function RETURNS jsonb with Result<T> from 14. Parameters are mandatory; p_selection alone allows JSON null. `G` expands to leading `p_connection_id uuid, p_token text`. No generic RPC router.

| RPC                             | Arguments after G for agent rows                                                                            | Success data                                                                                                   |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| get_content_draft               | none                                                                                                        | ContentDraft, initializes if missing                                                                           |
| get_content_draft_head          | none                                                                                                        | DraftHead, no initialization                                                                                   |
| apply_content_draft_operations  | p_expected_generation bigint, p_operations jsonb                                                            | DraftMutationResult                                                                                            |
| create_content_agent_connection | p_connection_id uuid, p_token_hash text, p_label text                                                       | AgentConnection                                                                                                |
| list_content_agent_connections  | none                                                                                                        | AgentConnection[] sorted created_at DESC, id ASC                                                               |
| revoke_content_agent_connection | p_connection_id uuid                                                                                        | AgentConnection                                                                                                |
| create_content_edit_export      | p_export_id uuid, p_expected_generation bigint, p_selection jsonb                                           | EditExport                                                                                                     |
| get_content_edit_export         | p_export_id uuid                                                                                            | EditExport                                                                                                     |
| prepare_content_draft_publish   | p_preparation_id uuid, p_generation bigint, p_expected_revision bigint, p_digest text, p_token_hash text    | PublicationPreparation                                                                                         |
| publish_content_draft           | p_preparation_id uuid, p_publish_token text                                                                 | PublishResult                                                                                                  |
| agent_get_editor_context        | G only                                                                                                      | {head: DraftHead, publishedRevision: number, principalUserId: string, connectionId: string, expiresAt: string} |
| agent_get_draft                 | G only                                                                                                      | ContentDraft, never initializes                                                                                |
| agent_get_published_content     | G only                                                                                                      | {revision: number, payload: PublishedContentPayload, canonicalPayload: string, digest: string}                 |
| agent_apply_operations          | G, p_expected_generation bigint, p_operations jsonb                                                         | DraftMutationResult                                                                                            |
| agent_prepare_publish           | G, p_preparation_id uuid, p_generation bigint, p_expected_revision bigint, p_digest text, p_token_hash text | PublicationPreparation                                                                                         |
| agent_publish_draft             | G, p_preparation_id uuid, p_publish_token text                                                              | PublishResult                                                                                                  |

List/get-item/reference/diff/image tools are client projections, NOT additional SQL RPCs. Image writes use operation RPC. No RPC takes arbitrary publication content or draft identity other than implied singleton.

Hash arguments are 64 lowercase hex strings decoded inside SQL. Replayed connection creation UUID succeeds only with same creator/hash/label/draft; otherwise invalid_input. Export creation replay returns original unexpired export only with same owner/generation/selection; otherwise export_base_unavailable. Preparation UUID replay requires all bound fields/hash/actor identical and still pending/unexpired; otherwise preparation_invalid (or preparation_expired for matching expired row). Missing draft -> draft_unavailable; missing revoke ID -> invalid_input; unauthorized/missing/expired export -> export_base_unavailable. Only published completion, not prepare, replays after expiry.

## Initialization And Mutation

Initialization uses `pg_advisory_xact_lock(4318, 2)`, rechecks draft, copies current published row under FOR SHARE. Missing publication -> published_base_unavailable. Never seed from bundle/empty payload; new installation's first publication precedes V2 enablement.

Mutation locks draft FOR UPDATE and compares generation before applying. Apply full batch to a local candidate, check structure and final byte bounds, then write payload/digest/actor/time and generation+1 once. Identical JSONB candidate -> changed=false, same metadata/generation. Stale even-no-op -> stale_generation. Failed batch has zero content side effects. Use rollback exception sub-block for operation/constraint failures. base_revision changes only on publication.

create_content_edit_export checks expected generation while holding draft lock, then captures published under FOR SHARE. Connection creation requires existing draft. Total payload structural check: exact six top-level fields, five arrays of objects with unique nonempty id, finite integer defaultGroupOrder, permitted item keys, keyed nested identities compatible with assertComparable, depth<=150, 5 MiB bounds. Semantic required text/reference validity may fail without blocking save.

## Publication Transaction

Lock order: agent connection first; then preparation, draft, published. Prepare locks draft then published before inserting its new preparation; export locks creator admin row, draft, published. Never reverse these orders. SQL time is authoritative.

Prepare checks supplied generation/digest and expectedRevision equals both live revision and draft baseRevision. Store token hash and immutable bindings; return no raw token. Generation mismatch -> stale_generation, digest mismatch -> preparation_invalid, revision mismatch -> revision_conflict. No payload write.

Publish reauthenticates even on replay. Verify preparation actor/connection and decoded token hash. Invalid binding/token/id -> preparation_invalid. Published outcome returns original PublishResult even after preparation expiry, but not after capability expiry/revocation/admin removal. Pending expired -> mark expired then return preparation_expired. Draft generation/digest mismatch -> mark stale and preparation_stale. Live/base revision mismatch -> mark stale and revision_conflict. Stale/expired rows never rebind. Return domain errors normally after marking terminal outcome so the mark commits; do not RAISE it away.

Success updates published payload/schema, revision+1, server timestamp and principal/connection; existing trigger archives OLD. Set draft base_revision to new revision, generation+1, actor/time; payload/digest unchanged. Store exact result/outcome/completed_at atomically. Any SQL write failure rolls back all publication/history/draft/outcome changes.

During coexistence, any old direct publication can leave draft baseRevision behind. V2 deliberately **blocks publication** with revision_conflict; preserve the draft and require explicit engineering reconciliation before enabling cutover. After revocation all V2 writes advance base atomically, so a mismatch indicates out-of-protocol engineering changes. Do not invent a rebase RPC, replace draft with bundle, or permit a weaker model to overwrite live content as recovery. DB-03 tests this failure; INTEGRATION-03 requires aligned base/live revision before activation.

## Private Interfaces

Exact helper signatures, no public grants:

```sql
content_private.payload_digest(jsonb) returns text
content_private.assert_payload(jsonb) returns void
content_private.assert_image(jsonb) returns void
content_private.apply_operations(jsonb, jsonb) returns jsonb
content_private.draft_head(public.content_drafts) returns jsonb
content_private.authenticate_agent(uuid, text) returns public.content_agent_connections
content_private.mutate_draft(bigint, jsonb, text, uuid, uuid) returns jsonb
content_private.prepare_publish(uuid, bigint, bigint, text, text, text, uuid, uuid) returns jsonb
content_private.publish_draft(uuid, text, text, uuid, uuid) returns jsonb
```

Last three arguments for mutation/publication helpers are actor kind, principal, connection (nullable only for admin). Private assertion helpers raise P0001 with a fixed domain error code; wrappers catch known codes inside rollback sub-blocks. Unexpected exceptions roll back request, transport maps to unavailable without raw SQL text. Further private helper splits are non-contractual, provided external signatures/grants/atomicity do not change.
