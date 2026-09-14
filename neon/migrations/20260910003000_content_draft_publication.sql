-- Migration: 20260910003000_content_draft_publication.sql
-- Description: V2 atomic guarded publication (dossier 15): private two-phase
--   publication helpers (preparation with token-hash bindings, terminal
--   outcomes and stored-result replay) plus the admin and anonymous-gateway
--   wrappers. The publish token is 43-character canonical unpadded base64url
--   of exactly 32 bytes; the RPC path receives only its SHA-256 hash (prepare)
--   or the raw token (publish, hashed inside SQL). The existing history
--   trigger stays the sole history writer. Legacy direct-publication
--   privileges on published_content are intentionally kept until the
--   separately staged cutover (neon/cutover/, applied manually).
--
-- Error protocol: private helpers raise SQLSTATE P0001 (RAISE EXCEPTION)
-- whose MESSAGE_TEXT is exactly a frozen domain error code from doc 14.
-- Wrappers catch known codes and return Result<T> JSONB; unexpected
-- exceptions re-raise and roll the whole request back. Domain errors raised
-- after a terminal-outcome mark are caught by the wrapper so the mark
-- commits with the request.

-- ---------------------------------------------------------------------------
-- Private preparation projection
-- ---------------------------------------------------------------------------

create or replace function content_private.preparation_json(
  p_prep public.content_publish_preparations
)
returns jsonb
language plpgsql
stable
set search_path = ''
set timezone = 'UTC'
as $$
begin
  return jsonb_build_object(
    'preparationId', p_prep.id::text,
    'draftId', p_prep.draft_id,
    'generation', p_prep.generation,
    'expectedRevision', p_prep.expected_revision,
    'digest', p_prep.candidate_digest,
    'expiresAt', content_private.iso8601(p_prep.expires_at)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Private prepare: bind generation/revision/digest/token-hash immutably
-- (dossier 15, Publication Transaction). Lock order: draft, then published,
-- before inserting the new preparation. No payload write. Preparation UUID
-- replay requires all bound fields/hash/actor identical and still pending/
-- unexpired; otherwise preparation_invalid (or preparation_expired for a
-- matching expired row). Only published completion, not prepare, replays
-- after expiry.
-- ---------------------------------------------------------------------------

create or replace function content_private.prepare_publish(
  p_preparation_id uuid,
  p_generation bigint,
  p_expected_revision bigint,
  p_digest text,
  p_token_hash text,
  p_actor_kind text,
  p_principal uuid,
  p_connection uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
set timezone = 'UTC'
as $$
declare
  v_draft public.content_drafts;
  v_existing public.content_publish_preparations;
  v_hash bytea;
  v_revision bigint;
  v_prep public.content_publish_preparations;
begin
  if p_preparation_id is null
    or p_generation is null
    or p_expected_revision is null
    or p_principal is null then
    raise exception 'invalid_input';
  end if;
  if p_actor_kind is distinct from 'admin' and p_actor_kind is distinct from 'agent' then
    raise exception 'invalid_input';
  end if;
  -- Agent preparations must bind the connection; admin preparations must not.
  if (p_actor_kind = 'agent') is distinct from (p_connection is not null) then
    raise exception 'invalid_input';
  end if;
  if p_digest is null or p_digest !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_input';
  end if;
  v_hash := content_private.decode_token_hash(p_token_hash);

  -- Idempotent replay of the caller-generated preparation UUID.
  select * into v_existing
  from public.content_publish_preparations
  where id = p_preparation_id;
  if found then
    if v_existing.actor_kind = p_actor_kind
      and v_existing.principal_user_id = p_principal
      and v_existing.connection_id is not distinct from p_connection
      and v_existing.generation = p_generation
      and v_existing.expected_revision = p_expected_revision
      and v_existing.candidate_digest = p_digest
      and v_existing.token_hash = v_hash then
      if v_existing.outcome = 'pending'
        and v_existing.expires_at > clock_timestamp() then
        return content_private.preparation_json(v_existing);
      end if;
      if v_existing.outcome = 'pending' then
        raise exception 'preparation_expired';
      end if;
    end if;
    raise exception 'preparation_invalid';
  end if;

  -- Lock order (dossier 15): draft, then published, before the insert.
  select * into v_draft
  from public.content_drafts
  where id = 'current'
  for update;
  if not found then
    raise exception 'draft_unavailable';
  end if;
  if v_draft.generation <> p_generation then
    raise exception 'stale_generation;%',
      jsonb_build_object('currentHead', content_private.draft_head(v_draft))::text;
  end if;
  if v_draft.digest <> p_digest then
    raise exception 'preparation_invalid';
  end if;

  select revision into v_revision
  from public.published_content
  where id = 'current'
  for share;
  if not found then
    raise exception 'published_base_unavailable';
  end if;
  -- expectedRevision must equal both the live revision and the draft base.
  if p_expected_revision is distinct from v_revision
    or p_expected_revision is distinct from v_draft.base_revision then
    raise exception 'revision_conflict;%',
      jsonb_build_object('currentRevision', v_revision)::text;
  end if;

  insert into public.content_publish_preparations (
    id, draft_id, actor_kind, principal_user_id, connection_id,
    generation, expected_revision, candidate_digest, token_hash,
    created_at, expires_at
  )
  values (
    p_preparation_id, 'current', p_actor_kind, p_principal, p_connection,
    p_generation, p_expected_revision, p_digest, v_hash,
    now(), now() + interval '10 minutes'
  )
  returning * into v_prep;
  return content_private.preparation_json(v_prep);
end;
$$;

-- ---------------------------------------------------------------------------
-- Private publish: reauthenticate outside (wrapper), verify binding/token,
-- advance revision exactly once under the preparation/draft/published locks,
-- store the exact result atomically, and replay published outcomes from the
-- stored result even after preparation expiry (never after capability
-- expiry/revocation/admin removal). Stale/expired rows never rebind. The
-- existing archive trigger is the sole history writer.
--
-- The helper RETURNS the Result<T> envelope directly (instead of raising
-- domain codes) because a plpgsql EXCEPTION block is a subtransaction:
-- catching a raised domain error would roll back the terminal-outcome mark
-- made before it. Domain errors are therefore returned after the mark so the
-- mark commits with the request. Unexpected SQL exceptions still propagate
-- and abort the whole request, rolling back publication/history/draft/outcome
-- changes together.
-- ---------------------------------------------------------------------------

create or replace function content_private.publish_draft(
  p_preparation_id uuid,
  p_publish_token text,
  p_actor_kind text,
  p_principal uuid,
  p_connection uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
set timezone = 'UTC'
as $$
declare
  v_prep public.content_publish_preparations;
  v_draft public.content_drafts;
  v_published public.published_content;
  v_bytes bytea;
  v_hash bytea;
  v_new_revision bigint;
  v_result jsonb;
begin
  if p_preparation_id is null or p_principal is null then
    return jsonb_build_object('ok', false, 'error',
      jsonb_build_object('code', 'invalid_input'));
  end if;
  if p_actor_kind is distinct from 'admin' and p_actor_kind is distinct from 'agent' then
    return jsonb_build_object('ok', false, 'error',
      jsonb_build_object('code', 'invalid_input'));
  end if;
  if (p_actor_kind = 'agent') is distinct from (p_connection is not null) then
    return jsonb_build_object('ok', false, 'error',
      jsonb_build_object('code', 'invalid_input'));
  end if;

  select * into v_prep
  from public.content_publish_preparations
  where id = p_preparation_id
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'error',
      jsonb_build_object('code', 'preparation_invalid'));
  end if;
  -- Preparation actor/connection binding is immutable and private.
  if v_prep.actor_kind <> p_actor_kind
    or v_prep.principal_user_id is distinct from p_principal
    or v_prep.connection_id is distinct from p_connection then
    return jsonb_build_object('ok', false, 'error',
      jsonb_build_object('code', 'preparation_invalid'));
  end if;
  -- The raw publish token is hashed here; only its 32-byte digest is stored.
  if p_publish_token is null or p_publish_token !~ '^[A-Za-z0-9_-]{43}$' then
    return jsonb_build_object('ok', false, 'error',
      jsonb_build_object('code', 'preparation_invalid'));
  end if;
  begin
    v_bytes := pg_catalog.decode(translate(p_publish_token, '-_', '+/') || '=', 'base64');
  exception
    when others then
      return jsonb_build_object('ok', false, 'error',
        jsonb_build_object('code', 'preparation_invalid'));
  end;
  if octet_length(v_bytes) is distinct from 32 then
    return jsonb_build_object('ok', false, 'error',
      jsonb_build_object('code', 'preparation_invalid'));
  end if;
  v_hash := pg_catalog.sha256(v_bytes);
  if v_prep.token_hash is distinct from v_hash then
    return jsonb_build_object('ok', false, 'error',
      jsonb_build_object('code', 'preparation_invalid'));
  end if;

  -- Published completion replays the stored result even after preparation
  -- expiry; the wrapper reauthenticated, so capability/admin removal and
  -- capability expiry/revocation already failed the call before this point.
  if v_prep.outcome = 'published' then
    return jsonb_build_object('ok', true, 'data', v_prep.result);
  end if;
  -- Terminal non-published rows never rebind.
  if v_prep.outcome <> 'pending' then
    return jsonb_build_object('ok', false, 'error',
      jsonb_build_object('code', 'preparation_invalid'));
  end if;

  -- Pending expired: mark the terminal outcome, then return the error so the
  -- mark commits with the request.
  if v_prep.expires_at <= clock_timestamp() then
    update public.content_publish_preparations
    set outcome = 'expired', completed_at = clock_timestamp()
    where id = v_prep.id;
    return jsonb_build_object('ok', false, 'error',
      jsonb_build_object('code', 'preparation_expired'));
  end if;

  select * into v_draft
  from public.content_drafts
  where id = v_prep.draft_id
  for update;
  if not found then
    update public.content_publish_preparations
    set outcome = 'stale', completed_at = clock_timestamp()
    where id = v_prep.id;
    return jsonb_build_object('ok', false, 'error',
      jsonb_build_object('code', 'draft_unavailable'));
  end if;
  if v_draft.generation <> v_prep.generation
    or v_draft.digest <> v_prep.candidate_digest then
    update public.content_publish_preparations
    set outcome = 'stale', completed_at = clock_timestamp()
    where id = v_prep.id;
    return jsonb_build_object('ok', false, 'error',
      jsonb_build_object('code', 'preparation_stale'));
  end if;

  select * into v_published
  from public.published_content
  where id = 'current'
  for update;
  if not found then
    update public.content_publish_preparations
    set outcome = 'stale', completed_at = clock_timestamp()
    where id = v_prep.id;
    return jsonb_build_object('ok', false, 'error',
      jsonb_build_object('code', 'published_base_unavailable'));
  end if;
  -- Live/base revision mismatch (including legacy direct writes that left the
  -- draft baseRevision behind during coexistence) fails closed: mark stale,
  -- preserve the draft, require explicit engineering reconciliation.
  if v_published.revision <> v_prep.expected_revision
    or v_draft.base_revision <> v_prep.expected_revision then
    update public.content_publish_preparations
    set outcome = 'stale', completed_at = clock_timestamp()
    where id = v_prep.id;
    return jsonb_build_object('ok', false, 'error',
      jsonb_build_object('code', 'revision_conflict')
        || jsonb_build_object('currentRevision', v_published.revision));
  end if;

  -- Success: exactly one revision increment; the existing before-update
  -- trigger archives OLD as the sole history writer. published_by is always
  -- the principal admin, never a connection UUID.
  v_new_revision := v_published.revision + 1;
  update public.published_content
  set
    schema_version = v_draft.schema_version,
    revision = v_new_revision,
    payload = v_draft.payload,
    published_at = clock_timestamp(),
    published_by = p_principal,
    published_via_connection_id = p_connection
  where id = v_published.id;

  -- Draft advances atomically with the publication: base_revision moves to
  -- the new revision, generation advances; payload/digest stay unchanged.
  update public.content_drafts
  set
    base_revision = v_new_revision,
    generation = v_draft.generation + 1,
    updated_at = clock_timestamp(),
    last_actor_kind = p_actor_kind,
    last_actor_id = coalesce(p_connection, p_principal),
    last_principal_user_id = p_principal
  where id = v_draft.id;

  v_result := jsonb_build_object(
    'revision', v_new_revision,
    'publishedAt', content_private.iso8601(clock_timestamp()),
    'draftGeneration', v_draft.generation + 1,
    'digest', v_draft.digest
  );

  -- Exact result/outcome/completed_at stored atomically with the writes above.
  update public.content_publish_preparations
  set outcome = 'published', completed_at = clock_timestamp(), result = v_result
  where id = v_prep.id;

  return jsonb_build_object('ok', true, 'data', v_result);
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin wrappers (authenticated only)
-- ---------------------------------------------------------------------------

create or replace function public.prepare_content_draft_publish(
  p_preparation_id uuid,
  p_generation bigint,
  p_expected_revision bigint,
  p_digest text,
  p_token_hash text
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
  v_err_code text;
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
  begin
    return jsonb_build_object('ok', true, 'data',
      content_private.prepare_publish(
        p_preparation_id, p_generation, p_expected_revision, p_digest,
        p_token_hash, 'admin', v_principal, null));
  exception
    when raise_exception then
      get stacked diagnostics v_err_code = MESSAGE_TEXT;
      -- MESSAGE_TEXT may carry a `;{json}` detail suffix after the code.
      if split_part(v_err_code, ';', 1) in (
        'invalid_input', 'draft_unavailable', 'published_base_unavailable',
        'stale_generation', 'preparation_invalid', 'preparation_expired',
        'preparation_stale', 'revision_conflict'
      ) then
        return jsonb_build_object('ok', false, 'error',
          jsonb_build_object('code', split_part(v_err_code, ';', 1))
            || coalesce(
              substring(v_err_code from ';(.*)$')::jsonb, '{}'::jsonb));
      end if;
      raise;
  end;
end;
$$;

create or replace function public.publish_content_draft(
  p_preparation_id uuid,
  p_publish_token text
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
  -- The helper returns the Result envelope (domain errors included); only
  -- unexpected SQL exceptions propagate and roll the request back.
  return content_private.publish_draft(
    p_preparation_id, p_publish_token, 'admin', v_principal, null);
end;
$$;

-- ---------------------------------------------------------------------------
-- Anonymous gateway wrappers (anonymous only; capability-checked)
-- ---------------------------------------------------------------------------

create or replace function public.agent_prepare_publish(
  p_connection_id uuid,
  p_token text,
  p_preparation_id uuid,
  p_generation bigint,
  p_expected_revision bigint,
  p_digest text,
  p_token_hash text
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
  begin
    return jsonb_build_object('ok', true, 'data',
      content_private.prepare_publish(
        p_preparation_id, p_generation, p_expected_revision, p_digest,
        p_token_hash, 'agent', v_conn.principal_user_id, v_conn.id));
  exception
    when raise_exception then
      get stacked diagnostics v_err_code = MESSAGE_TEXT;
      if split_part(v_err_code, ';', 1) in (
        'invalid_input', 'draft_unavailable', 'published_base_unavailable',
        'stale_generation', 'preparation_invalid', 'preparation_expired',
        'preparation_stale', 'revision_conflict'
      ) then
        return jsonb_build_object('ok', false, 'error',
          jsonb_build_object('code', split_part(v_err_code, ';', 1))
            || coalesce(
              substring(v_err_code from ';(.*)$')::jsonb, '{}'::jsonb));
      end if;
      raise;
  end;
end;
$$;

create or replace function public.agent_publish_draft(
  p_connection_id uuid,
  p_token text,
  p_preparation_id uuid,
  p_publish_token text
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
  -- Publish reauthenticates even on replay.
  begin
    v_conn := content_private.authenticate_agent(p_connection_id, p_token);
  exception
    when raise_exception then
      get stacked diagnostics v_err_code = MESSAGE_TEXT;
      if split_part(v_err_code, ';', 1) = 'invalid_capability' then
        return jsonb_build_object('ok', false, 'error',
          jsonb_build_object('code', 'invalid_capability'));
      end if;
      raise;
  end;
  return content_private.publish_draft(
    p_preparation_id, p_publish_token, 'agent',
    v_conn.principal_user_id, v_conn.id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges: helpers private; admin wrappers authenticated; agent wrappers
-- anonymous only; no broad role grants and no new table policies
-- ---------------------------------------------------------------------------

revoke all on function content_private.preparation_json(public.content_publish_preparations) from public, anonymous, authenticated;
revoke all on function content_private.prepare_publish(uuid, bigint, bigint, text, text, text, uuid, uuid) from public, anonymous, authenticated;
revoke all on function content_private.publish_draft(uuid, text, text, uuid, uuid) from public, anonymous, authenticated;

revoke all on function public.prepare_content_draft_publish(uuid, bigint, bigint, text, text) from public, anonymous, authenticated;
revoke all on function public.publish_content_draft(uuid, text) from public, anonymous, authenticated;
revoke all on function public.agent_prepare_publish(uuid, text, uuid, bigint, bigint, text, text) from public, anonymous, authenticated;
revoke all on function public.agent_publish_draft(uuid, text, uuid, text) from public, anonymous, authenticated;

grant execute on function public.prepare_content_draft_publish(uuid, bigint, bigint, text, text) to authenticated;
grant execute on function public.publish_content_draft(uuid, text) to authenticated;

grant execute on function public.agent_prepare_publish(uuid, text, uuid, bigint, bigint, text, text) to anonymous;
grant execute on function public.agent_publish_draft(uuid, text, uuid, text) to anonymous;

comment on function content_private.preparation_json(public.content_publish_preparations) is
  'PublicationPreparation wire projection; never exposes the stored token hash.';
comment on function content_private.prepare_publish(uuid, bigint, bigint, text, text, text, uuid, uuid) is
  'Two-phase preparation: draft/published lock order, immutable bindings with only the token hash, idempotent pending replay.';
comment on function content_private.publish_draft(uuid, text, text, uuid, uuid) is
  'Atomic guarded publication: terminal outcomes, stored-result replay, exactly one revision increment, trigger-written history.';
comment on function public.prepare_content_draft_publish(uuid, bigint, bigint, text, text) is
  'Admin guarded publication preparation; receives only the publish-token hash.';
comment on function public.publish_content_draft(uuid, text) is
  'Admin guarded publication with terminal outcomes and stored-result replay.';
comment on function public.agent_prepare_publish(uuid, text, uuid, bigint, bigint, text, text) is
  'Anonymous gateway: capability-checked publication preparation attributed to the delegated connection.';
comment on function public.agent_publish_draft(uuid, text, uuid, text) is
  'Anonymous gateway: capability-checked publication that reauthenticates even on replay.';
