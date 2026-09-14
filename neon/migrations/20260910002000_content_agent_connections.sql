-- Migration: 20260910002000_content_agent_connections.sql
-- Description: V2 delegation and durable exports (dossier 15): private agent
--   capability verifier with decoded-token hashing and current admin
--   membership, admin connection management (create/list/revoke), owner-only
--   durable edit exports with serial five-row pruning, and the anonymous
--   gateway wrappers (editor context, draft read, published read, mutations).
--   Publication wrappers belong to migration 20260910003000. List/get-item/
--   reference MCP tools are client projections and never become SQL RPCs.
--
-- Error protocol: private helpers raise SQLSTATE P0001 (RAISE EXCEPTION) whose
-- MESSAGE_TEXT is exactly a frozen domain error code from doc 14. Wrappers
-- catch known codes and return Result<T> JSONB; unexpected exceptions re-raise.

-- ---------------------------------------------------------------------------
-- Capability verifier (dossier 15, Authorization)
-- ---------------------------------------------------------------------------

-- Canonical unpadded 43-character base64url token of exactly 32 bytes; hash
-- the decoded bytes, never the token text. Any missing/invalid/expired/
-- revoked/wrong-secret/removed-principal case raises the same
-- invalid_capability code.
create or replace function content_private.authenticate_agent(
  p_connection_id uuid,
  p_token text
)
returns public.content_agent_connections
language plpgsql
volatile
security definer
set search_path = ''
set timezone = 'UTC'
as $$
declare
  v_row public.content_agent_connections;
  v_bytes bytea;
  v_hash bytea;
begin
  if p_connection_id is null
    or p_token is null
    or p_token !~ '^[A-Za-z0-9_-]{43}$' then
    raise exception 'invalid_capability';
  end if;
  begin
    v_bytes := pg_catalog.decode(translate(p_token, '-_', '+/') || '=', 'base64');
  exception
    when others then
      raise exception 'invalid_capability';
  end;
  if octet_length(v_bytes) is distinct from 32 then
    raise exception 'invalid_capability';
  end if;
  v_hash := pg_catalog.sha256(v_bytes);

  -- Same lock serializes authentication and revocation: in-flight work may
  -- still commit, but every call starting after a revoke completes fails.
  select * into v_row
  from public.content_agent_connections
  where id = p_connection_id
  for update;
  if not found then
    raise exception 'invalid_capability';
  end if;
  if v_row.token_hash is distinct from v_hash then
    raise exception 'invalid_capability';
  end if;
  if v_row.expires_at <= clock_timestamp() then
    raise exception 'invalid_capability';
  end if;
  if v_row.revoked_at is not null then
    raise exception 'invalid_capability';
  end if;
  -- Draft binding: the connection's draft row must still exist.
  if not exists (
    select 1 from public.content_drafts where id = v_row.draft_id
  ) then
    raise exception 'invalid_capability';
  end if;
  -- Current admin membership of the delegating principal (not the caller's).
  if not exists (
    select 1 from public.admin_users where user_id = v_row.principal_user_id
  ) then
    raise exception 'invalid_capability';
  end if;

  -- Throttled usage stamp: at most once per 15 minutes, only after successful
  -- authentication (a later domain failure still commits it).
  if v_row.last_used_at is null
    or clock_timestamp() - v_row.last_used_at >= interval '15 minutes' then
    update public.content_agent_connections
    set last_used_at = clock_timestamp()
    where id = v_row.id;
  end if;
  return v_row;
end;
$$;

-- Hash arguments are 64 lowercase hex strings decoded inside SQL; the raw
-- capability secret never reaches the database as text.
create or replace function content_private.decode_token_hash(p_token_hash text)
returns bytea
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_input';
  end if;
  return pg_catalog.decode(p_token_hash, 'hex');
end;
$$;

-- ---------------------------------------------------------------------------
-- Private projections
-- ---------------------------------------------------------------------------

create or replace function content_private.agent_connection_json(
  p_conn public.content_agent_connections
)
returns jsonb
language plpgsql
stable
set search_path = ''
set timezone = 'UTC'
as $$
begin
  return jsonb_build_object(
    'id', p_conn.id::text,
    'draftId', p_conn.draft_id,
    'principalUserId', p_conn.principal_user_id::text,
    'label', p_conn.label,
    'createdAt', content_private.iso8601(p_conn.created_at),
    'expiresAt', content_private.iso8601(p_conn.expires_at),
    'revokedAt', case when p_conn.revoked_at is null
      then null else content_private.iso8601(p_conn.revoked_at) end,
    'lastUsedAt', case when p_conn.last_used_at is null
      then null else content_private.iso8601(p_conn.last_used_at) end
  );
end;
$$;

-- Full ContentDraft projection (no initialization, no secrets).
create or replace function content_private.draft_json(p_draft public.content_drafts)
returns jsonb
language plpgsql
stable
set search_path = ''
set timezone = 'UTC'
as $$
begin
  return jsonb_build_object(
    'id', p_draft.id,
    'schemaVersion', p_draft.schema_version,
    'baseRevision', p_draft.base_revision,
    'generation', p_draft.generation,
    'digest', p_draft.digest,
    'updatedAt', content_private.iso8601(p_draft.updated_at),
    'lastActor', (content_private.draft_head(p_draft) -> 'lastActor'),
    'status', p_draft.status,
    'payload', p_draft.payload,
    'canonicalPayload', p_draft.payload::text,
    'createdAt', content_private.iso8601(p_draft.created_at),
    'createdBy', p_draft.created_by::text
  );
end;
$$;

create or replace function content_private.edit_export_json(
  p_export public.content_edit_exports
)
returns jsonb
language plpgsql
stable
set search_path = ''
set timezone = 'UTC'
as $$
begin
  return jsonb_build_object(
    'exportId', p_export.export_id::text,
    'draftId', p_export.draft_id,
    'schemaVersion', p_export.schema_version,
    'baseGeneration', p_export.base_generation,
    'baseDigest', p_export.base_digest,
    'publishedRevision', p_export.published_revision,
    'basePayload', p_export.base_payload,
    'canonicalPayload', p_export.base_payload::text,
    'createdBy', p_export.created_by::text,
    'createdAt', content_private.iso8601(p_export.created_at),
    'expiresAt', content_private.iso8601(p_export.expires_at),
    'selection', p_export.selection
  );
end;
$$;

-- Selection is null or {scope, ids} with 1..200 unique existing item IDs.
create or replace function content_private.assert_export_selection(
  p_selection jsonb,
  p_payload jsonb
)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_scope text;
  v_count integer;
begin
  if p_selection is null then
    return;
  end if;
  if jsonb_typeof(p_selection) is distinct from 'object'
    or content_private.json_keys(p_selection)
      is distinct from array['ids', 'scope'] then
    raise exception 'invalid_input';
  end if;
  if not content_private.is_scope(p_selection -> 'scope') then
    raise exception 'invalid_input';
  end if;
  v_scope := p_selection ->> 'scope';
  if jsonb_typeof(p_selection -> 'ids') is distinct from 'array' then
    raise exception 'invalid_input';
  end if;
  v_count := jsonb_array_length(p_selection -> 'ids');
  if v_count < 1 or v_count > 200 then
    raise exception 'invalid_input';
  end if;
  if (select count(distinct k) from jsonb_array_elements_text(p_selection -> 'ids') k)
    is distinct from v_count then
    raise exception 'invalid_input';
  end if;
  if exists (
    select 1
    from jsonb_array_elements_text(p_selection -> 'ids') k
    where k is null
      or char_length(k) < 1
      or char_length(k) > 200
      or not exists (
        select 1
        from jsonb_array_elements(p_payload -> v_scope) e
        where jsonb_typeof(e) = 'object' and e ->> 'id' = k
      )
  ) then
    raise exception 'invalid_input';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin connection management (authenticated only)
-- ---------------------------------------------------------------------------

create or replace function public.create_content_agent_connection(
  p_connection_id uuid,
  p_token_hash text,
  p_label text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
set timezone = 'UTC'
as $$
declare
  v_principal uuid;
  v_hash bytea;
  v_label text;
  v_existing public.content_agent_connections;
  v_conn public.content_agent_connections;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'error',
      jsonb_build_object('code', 'unauthorized'));
  end if;
  v_principal := nullif(auth.user_id(), '')::uuid;
  if v_principal is null then
    return jsonb_build_object('ok', false, 'error',
      jsonb_build_object('code', 'unauthorized'));
  end if;
  if p_connection_id is null then
    return jsonb_build_object('ok', false, 'error',
      jsonb_build_object('code', 'invalid_input'));
  end if;
  begin
    v_hash := content_private.decode_token_hash(p_token_hash);
  exception
    when raise_exception then
      return jsonb_build_object('ok', false, 'error',
        jsonb_build_object('code', 'invalid_input'));
  end;
  if p_label is null then
    return jsonb_build_object('ok', false, 'error',
      jsonb_build_object('code', 'invalid_input'));
  end if;
  v_label := btrim(p_label);
  if char_length(v_label) not between 1 and 80 then
    return jsonb_build_object('ok', false, 'error',
      jsonb_build_object('code', 'invalid_input'));
  end if;
  if not exists (select 1 from public.content_drafts where id = 'current') then
    return jsonb_build_object('ok', false, 'error',
      jsonb_build_object('code', 'draft_unavailable'));
  end if;

  -- Idempotent create: replaying the caller-generated UUID succeeds only with
  -- the same creator, hash, label and draft; any mismatch is invalid_input.
  select * into v_existing
  from public.content_agent_connections
  where id = p_connection_id;
  if found then
    if v_existing.principal_user_id = v_principal
      and v_existing.token_hash = v_hash
      and v_existing.label = v_label
      and v_existing.draft_id = 'current' then
      return jsonb_build_object('ok', true, 'data',
        content_private.agent_connection_json(v_existing));
    end if;
    return jsonb_build_object('ok', false, 'error',
      jsonb_build_object('code', 'invalid_input'));
  end if;

  -- Creation always binds to the requesting admin (never request fields).
  insert into public.content_agent_connections (
    id, draft_id, principal_user_id, label, token_hash,
    created_at, expires_at
  )
  values (
    p_connection_id, 'current', v_principal, v_label, v_hash,
    now(), now() + interval '1 year'
  )
  returning * into v_conn;
  return jsonb_build_object('ok', true, 'data',
    content_private.agent_connection_json(v_conn));
end;
$$;

create or replace function public.list_content_agent_connections()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'UTC'
as $$
declare
  v_principal uuid;
  v_list jsonb;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'error',
      jsonb_build_object('code', 'unauthorized'));
  end if;
  v_principal := nullif(auth.user_id(), '')::uuid;
  if v_principal is null then
    return jsonb_build_object('ok', false, 'error',
      jsonb_build_object('code', 'unauthorized'));
  end if;
  -- Metadata only (no hash column); every admin lists every connection.
  select coalesce(jsonb_agg(content_private.agent_connection_json(c) order by c.created_at desc, c.id asc), '[]'::jsonb)
    into v_list
  from public.content_agent_connections c;
  return jsonb_build_object('ok', true, 'data', v_list);
end;
$$;

create or replace function public.revoke_content_agent_connection(
  p_connection_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
set timezone = 'UTC'
as $$
declare
  v_principal uuid;
  v_conn public.content_agent_connections;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'error',
      jsonb_build_object('code', 'unauthorized'));
  end if;
  v_principal := nullif(auth.user_id(), '')::uuid;
  if v_principal is null then
    return jsonb_build_object('ok', false, 'error',
      jsonb_build_object('code', 'unauthorized'));
  end if;
  if p_connection_id is null then
    return jsonb_build_object('ok', false, 'error',
      jsonb_build_object('code', 'invalid_input'));
  end if;
  -- Any admin revokes any connection; rows are retained for audit.
  select * into v_conn
  from public.content_agent_connections
  where id = p_connection_id
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'error',
      jsonb_build_object('code', 'invalid_input'));
  end if;
  if v_conn.revoked_at is null then
    update public.content_agent_connections
    set revoked_at = clock_timestamp()
    where id = v_conn.id
    returning * into v_conn;
  end if;
  -- Replay preserves the original revoked_at timestamp.
  return jsonb_build_object('ok', true, 'data',
    content_private.agent_connection_json(v_conn));
end;
$$;

-- ---------------------------------------------------------------------------
-- Durable edit exports (authenticated, creator-isolated)
-- ---------------------------------------------------------------------------

create or replace function public.create_content_edit_export(
  p_export_id uuid,
  p_expected_generation bigint,
  p_selection jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
set timezone = 'UTC'
as $$
declare
  v_principal uuid;
  v_draft public.content_drafts;
  v_revision bigint;
  v_existing public.content_edit_exports;
  v_export public.content_edit_exports;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'error',
      jsonb_build_object('code', 'unauthorized'));
  end if;
  v_principal := nullif(auth.user_id(), '')::uuid;
  if v_principal is null then
    return jsonb_build_object('ok', false, 'error',
      jsonb_build_object('code', 'unauthorized'));
  end if;
  if p_export_id is null or p_expected_generation is null then
    return jsonb_build_object('ok', false, 'error',
      jsonb_build_object('code', 'invalid_input'));
  end if;

  -- Replay: the caller-generated UUID returns the original export only with
  -- the same owner, generation and selection, and only while unexpired.
  select * into v_existing
  from public.content_edit_exports
  where export_id = p_export_id;
  if found then
    if v_existing.created_by = v_principal
      and v_existing.base_generation = p_expected_generation
      and v_existing.selection is not distinct from p_selection
      and v_existing.expires_at > clock_timestamp() then
      return jsonb_build_object('ok', true, 'data',
        content_private.edit_export_json(v_existing));
    end if;
    return jsonb_build_object('ok', false, 'error',
      jsonb_build_object('code', 'export_base_unavailable'));
  end if;

  -- Lock order (dossier 15): creator admin row, then draft, then published.
  perform 1 from public.admin_users where user_id = v_principal for update;

  select * into v_draft
  from public.content_drafts
  where id = 'current'
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'error',
      jsonb_build_object('code', 'draft_unavailable'));
  end if;
  if v_draft.generation <> p_expected_generation then
    return jsonb_build_object('ok', false, 'error',
      jsonb_build_object('code', 'stale_generation')
        || jsonb_build_object('currentHead', content_private.draft_head(v_draft)));
  end if;
  begin
    perform content_private.assert_export_selection(p_selection, v_draft.payload);
  exception
    when raise_exception then
      return jsonb_build_object('ok', false, 'error',
        jsonb_build_object('code', 'invalid_input'));
  end;

  select revision into v_revision
  from public.published_content
  where id = 'current'
  for share;
  if not found then
    return jsonb_build_object('ok', false, 'error',
      jsonb_build_object('code', 'published_base_unavailable'));
  end if;

  insert into public.content_edit_exports (
    export_id, draft_id, schema_version, base_generation, base_digest,
    published_revision, base_payload, selection, created_by,
    created_at, expires_at
  )
  values (
    p_export_id, 'current', '2.0.0', v_draft.generation, v_draft.digest,
    v_revision, v_draft.payload, p_selection, v_principal,
    now(), now() + interval '14 days'
  )
  returning * into v_export;

  -- Serial pruning (serialized by the creator admin-row lock): drop this
  -- creator's expired rows, then keep only the newest five ordered
  -- (created_at desc, export_id desc).
  delete from public.content_edit_exports
  where created_by = v_principal
    and expires_at <= clock_timestamp();
  delete from public.content_edit_exports
  where created_by = v_principal
    and export_id in (
      select export_id
      from public.content_edit_exports
      where created_by = v_principal
      order by created_at desc, export_id desc
      offset 5
    );

  return jsonb_build_object('ok', true, 'data',
    content_private.edit_export_json(v_export));
end;
$$;

create or replace function public.get_content_edit_export(
  p_export_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'UTC'
as $$
declare
  v_principal uuid;
  v_export public.content_edit_exports;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'error',
      jsonb_build_object('code', 'unauthorized'));
  end if;
  v_principal := nullif(auth.user_id(), '')::uuid;
  if v_principal is null then
    return jsonb_build_object('ok', false, 'error',
      jsonb_build_object('code', 'unauthorized'));
  end if;
  if p_export_id is null then
    return jsonb_build_object('ok', false, 'error',
      jsonb_build_object('code', 'invalid_input'));
  end if;
  -- Owner-only retrieval, even against other admins.
  select * into v_export
  from public.content_edit_exports
  where export_id = p_export_id
    and created_by = v_principal;
  if not found then
    return jsonb_build_object('ok', false, 'error',
      jsonb_build_object('code', 'export_base_unavailable'));
  end if;
  -- Expiry is enforced on read even without pruning.
  if v_export.expires_at <= clock_timestamp() then
    return jsonb_build_object('ok', false, 'error',
      jsonb_build_object('code', 'export_base_unavailable'));
  end if;
  return jsonb_build_object('ok', true, 'data',
    content_private.edit_export_json(v_export));
end;
$$;

-- ---------------------------------------------------------------------------
-- Anonymous gateway wrappers (anonymous only; capability-checked)
-- ---------------------------------------------------------------------------

create or replace function public.agent_get_editor_context(
  p_connection_id uuid,
  p_token text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
set timezone = 'UTC'
as $$
declare
  v_conn public.content_agent_connections;
  v_draft public.content_drafts;
  v_revision bigint;
  v_err_code text;
begin
  begin
    v_conn := content_private.authenticate_agent(p_connection_id, p_token);
  exception
    when raise_exception then
      get stacked diagnostics v_err_code = MESSAGE_TEXT;
      if v_err_code = 'invalid_capability' then
        return jsonb_build_object('ok', false, 'error',
          jsonb_build_object('code', 'invalid_capability'));
      end if;
      raise;
  end;

  select * into v_draft from public.content_drafts where id = v_conn.draft_id;
  if not found then
    return jsonb_build_object('ok', false, 'error',
      jsonb_build_object('code', 'draft_unavailable'));
  end if;
  select revision into v_revision
  from public.published_content
  where id = 'current';
  if not found then
    return jsonb_build_object('ok', false, 'error',
      jsonb_build_object('code', 'published_base_unavailable'));
  end if;
  return jsonb_build_object('ok', true, 'data',
    jsonb_build_object(
      'head', content_private.draft_head(v_draft),
      'publishedRevision', v_revision,
      'principalUserId', v_conn.principal_user_id::text,
      'connectionId', v_conn.id::text,
      'expiresAt', content_private.iso8601(v_conn.expires_at)));
end;
$$;

create or replace function public.agent_get_draft(
  p_connection_id uuid,
  p_token text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'UTC'
as $$
declare
  v_conn public.content_agent_connections;
  v_draft public.content_drafts;
  v_err_code text;
begin
  begin
    v_conn := content_private.authenticate_agent(p_connection_id, p_token);
  exception
    when raise_exception then
      get stacked diagnostics v_err_code = MESSAGE_TEXT;
      if v_err_code = 'invalid_capability' then
        return jsonb_build_object('ok', false, 'error',
          jsonb_build_object('code', 'invalid_capability'));
      end if;
      raise;
  end;

  -- Never initializes: a missing draft is draft_unavailable.
  select * into v_draft from public.content_drafts where id = v_conn.draft_id;
  if not found then
    return jsonb_build_object('ok', false, 'error',
      jsonb_build_object('code', 'draft_unavailable'));
  end if;
  return jsonb_build_object('ok', true, 'data', content_private.draft_json(v_draft));
end;
$$;

create or replace function public.agent_get_published_content(
  p_connection_id uuid,
  p_token text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'UTC'
as $$
declare
  v_conn public.content_agent_connections;
  v_row public.published_content;
  v_err_code text;
begin
  begin
    v_conn := content_private.authenticate_agent(p_connection_id, p_token);
  exception
    when raise_exception then
      get stacked diagnostics v_err_code = MESSAGE_TEXT;
      if v_err_code = 'invalid_capability' then
        return jsonb_build_object('ok', false, 'error',
          jsonb_build_object('code', 'invalid_capability'));
      end if;
      raise;
  end;

  select * into v_row from public.published_content where id = 'current';
  if not found then
    return jsonb_build_object('ok', false, 'error',
      jsonb_build_object('code', 'published_base_unavailable'));
  end if;
  return jsonb_build_object('ok', true, 'data',
    jsonb_build_object(
      'revision', v_row.revision,
      'payload', v_row.payload,
      'canonicalPayload', v_row.payload::text,
      'digest', content_private.payload_digest(v_row.payload)));
end;
$$;

create or replace function public.agent_apply_operations(
  p_connection_id uuid,
  p_token text,
  p_expected_generation bigint,
  p_operations jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
set timezone = 'UTC'
as $$
declare
  v_conn public.content_agent_connections;
  v_err_code text;
begin
  begin
    v_conn := content_private.authenticate_agent(p_connection_id, p_token);
  exception
    when raise_exception then
      get stacked diagnostics v_err_code = MESSAGE_TEXT;
      if v_err_code = 'invalid_capability' then
        return jsonb_build_object('ok', false, 'error',
          jsonb_build_object('code', 'invalid_capability'));
      end if;
      raise;
  end;

  return content_private.mutate_draft(
    p_expected_generation, p_operations, 'agent', v_conn.principal_user_id, v_conn.id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges: helpers private; admin wrappers authenticated; gateway wrappers
-- anonymous only; no broad role grants
-- ---------------------------------------------------------------------------

revoke all on function content_private.authenticate_agent(uuid, text) from public, anonymous, authenticated;
revoke all on function content_private.decode_token_hash(text) from public, anonymous, authenticated;
revoke all on function content_private.agent_connection_json(public.content_agent_connections) from public, anonymous, authenticated;
revoke all on function content_private.draft_json(public.content_drafts) from public, anonymous, authenticated;
revoke all on function content_private.edit_export_json(public.content_edit_exports) from public, anonymous, authenticated;
revoke all on function content_private.assert_export_selection(jsonb, jsonb) from public, anonymous, authenticated;

revoke all on function public.create_content_agent_connection(uuid, text, text) from public, anonymous, authenticated;
revoke all on function public.list_content_agent_connections() from public, anonymous, authenticated;
revoke all on function public.revoke_content_agent_connection(uuid) from public, anonymous, authenticated;
revoke all on function public.create_content_edit_export(uuid, bigint, jsonb) from public, anonymous, authenticated;
revoke all on function public.get_content_edit_export(uuid) from public, anonymous, authenticated;
revoke all on function public.agent_get_editor_context(uuid, text) from public, anonymous, authenticated;
revoke all on function public.agent_get_draft(uuid, text) from public, anonymous, authenticated;
revoke all on function public.agent_get_published_content(uuid, text) from public, anonymous, authenticated;
revoke all on function public.agent_apply_operations(uuid, text, bigint, jsonb) from public, anonymous, authenticated;

grant execute on function public.create_content_agent_connection(uuid, text, text) to authenticated;
grant execute on function public.list_content_agent_connections() to authenticated;
grant execute on function public.revoke_content_agent_connection(uuid) to authenticated;
grant execute on function public.create_content_edit_export(uuid, bigint, jsonb) to authenticated;
grant execute on function public.get_content_edit_export(uuid) to authenticated;

grant execute on function public.agent_get_editor_context(uuid, text) to anonymous;
grant execute on function public.agent_get_draft(uuid, text) to anonymous;
grant execute on function public.agent_get_published_content(uuid, text) to anonymous;
grant execute on function public.agent_apply_operations(uuid, text, bigint, jsonb) to anonymous;

comment on function content_private.authenticate_agent(uuid, text) is
  'Capability verifier: FOR UPDATE lock, decoded-token sha256, expiry, revoke, draft binding and current admin membership; throttled last_used_at.';
comment on function public.create_content_agent_connection(uuid, text, text) is
  'Admin connection creation bound to self; idempotent replay on identical creator/hash/label/draft.';
comment on function public.list_content_agent_connections() is
  'Admin metadata listing of all connections, newest first; no hash or secret is exposed.';
comment on function public.revoke_content_agent_connection(uuid) is
  'Admin revocation of any connection; replay preserves the original timestamp; rows retained.';
comment on function public.create_content_edit_export(uuid, bigint, jsonb) is
  'Owner-isolated durable export base with generation check under draft lock and serial five-row pruning.';
comment on function public.get_content_edit_export(uuid) is
  'Owner-only export retrieval with expiry enforced on read.';
comment on function public.agent_get_editor_context(uuid, text) is
  'Anonymous gateway: capability-checked head, published revision and connection metadata.';
comment on function public.agent_get_draft(uuid, text) is
  'Anonymous gateway: capability-checked draft read without initialization.';
comment on function public.agent_get_published_content(uuid, text) is
  'Anonymous gateway: capability-checked live publication read with canonical payload and digest.';
comment on function public.agent_apply_operations(uuid, text, bigint, jsonb) is
  'Anonymous gateway: capability-checked CAS draft mutation attributed to the delegated connection.';
