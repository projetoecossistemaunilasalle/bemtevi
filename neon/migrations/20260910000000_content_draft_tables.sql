-- Migration: 20260910000000_content_draft_tables.sql
-- Description: V2 editorial draft persistence (dossier 15): private helper
--   schema, four new tables with structural checks/indexes, RLS without
--   policies (RPC-only access) and the publication audit amendment
--   (published_via_connection_id + history trigger copy).

create schema if not exists content_private;

revoke all on schema content_private from public, anonymous, authenticated;

create table if not exists public.content_drafts (
  id text primary key default 'current' check (id = 'current'),
  schema_version text not null default '1.0.0' check (schema_version = '1.0.0'),
  base_revision bigint not null check (base_revision between 1 and 9007199254740991),
  generation bigint not null default 1 check (generation between 1 and 9007199254740991),
  payload jsonb not null,
  digest text not null check (digest ~ '^[0-9a-f]{64}$'),
  status text not null default 'active' check (status = 'active'),
  created_at timestamptz not null default now(),
  created_by uuid not null references neon_auth."user" (id),
  updated_at timestamptz not null default now(),
  last_actor_kind text check (last_actor_kind in ('admin', 'agent')),
  last_actor_id uuid,
  last_principal_user_id uuid references neon_auth."user" (id),
  check (last_actor_kind is distinct from 'admin' or last_actor_id = last_principal_user_id)
);

create table if not exists public.content_agent_connections (
  id uuid primary key,
  draft_id text not null references public.content_drafts (id) check (draft_id = 'current'),
  principal_user_id uuid not null references neon_auth."user" (id),
  label text not null check (char_length(btrim(label)) between 1 and 80),
  token_hash bytea not null check (octet_length(token_hash) = 32),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null check (expires_at = created_at + interval '1 year'),
  revoked_at timestamptz,
  last_used_at timestamptz
);

create index if not exists idx_content_agent_connections_principal
  on public.content_agent_connections (principal_user_id, created_at desc, id);

create table if not exists public.content_edit_exports (
  export_id uuid primary key,
  draft_id text not null references public.content_drafts (id) check (draft_id = 'current'),
  schema_version text not null check (schema_version = '2.0.0'),
  base_generation bigint not null check (base_generation between 1 and 9007199254740991),
  base_digest text not null check (base_digest ~ '^[0-9a-f]{64}$'),
  published_revision bigint not null check (published_revision between 1 and 9007199254740991),
  base_payload jsonb not null,
  selection jsonb,
  created_by uuid not null references neon_auth."user" (id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null check (expires_at = created_at + interval '14 days')
);

create index if not exists idx_content_edit_exports_creator
  on public.content_edit_exports (created_by, created_at desc, export_id);

create index if not exists idx_content_edit_exports_expiry
  on public.content_edit_exports (expires_at);

create table if not exists public.content_publish_preparations (
  id uuid primary key,
  draft_id text not null references public.content_drafts (id) check (draft_id = 'current'),
  actor_kind text not null check (actor_kind in ('admin', 'agent')),
  principal_user_id uuid not null references neon_auth."user" (id),
  connection_id uuid references public.content_agent_connections (id),
  generation bigint not null check (generation between 1 and 9007199254740991),
  expected_revision bigint not null check (expected_revision between 1 and 9007199254740991),
  candidate_digest text not null check (candidate_digest ~ '^[0-9a-f]{64}$'),
  token_hash bytea not null check (octet_length(token_hash) = 32),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null check (expires_at = created_at + interval '10 minutes'),
  outcome text not null default 'pending' check (outcome in ('pending', 'published', 'stale', 'expired')),
  completed_at timestamptz,
  result jsonb,
  check ((actor_kind = 'agent') = (connection_id is not null)),
  check ((result is not null) = (outcome = 'published')),
  check ((completed_at is not null) = (outcome <> 'pending'))
);

create index if not exists idx_content_publish_preparations_connection
  on public.content_publish_preparations (connection_id, created_at desc);

create index if not exists idx_content_publish_preparations_principal
  on public.content_publish_preparations (principal_user_id, created_at desc);

-- RLS enabled with no policies and no grants: every access is RPC-only,
-- including administrators. Never add policies granting direct table access.
alter table public.content_drafts enable row level security;
alter table public.content_agent_connections enable row level security;
alter table public.content_edit_exports enable row level security;
alter table public.content_publish_preparations enable row level security;

revoke all on table public.content_drafts from public, anonymous, authenticated;
revoke all on table public.content_agent_connections from public, anonymous, authenticated;
revoke all on table public.content_edit_exports from public, anonymous, authenticated;
revoke all on table public.content_publish_preparations from public, anonymous, authenticated;

-- Publication audit amendment: nullable delegating connection reference on the
-- live snapshot and on history. Existing rows stay null; published_by keeps
-- recording the principal admin, never a connection UUID.
alter table public.published_content
  add column if not exists published_via_connection_id uuid
  references public.content_agent_connections (id);

alter table public.published_content_history
  add column if not exists published_via_connection_id uuid
  references public.content_agent_connections (id);

create or replace function public.archive_published_content()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if OLD.id = 'current' and OLD.revision is not null then
    insert into public.published_content_history (
      revision,
      schema_version,
      payload,
      published_at,
      published_by,
      archived_at,
      published_via_connection_id
    )
    values (
      OLD.revision,
      OLD.schema_version,
      OLD.payload,
      OLD.published_at,
      OLD.published_by,
      now(),
      OLD.published_via_connection_id
    )
    on conflict (revision) do update
    set
      payload = excluded.payload,
      schema_version = excluded.schema_version,
      published_at = excluded.published_at,
      published_by = excluded.published_by,
      archived_at = excluded.archived_at,
      published_via_connection_id = excluded.published_via_connection_id;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_archive_published_content on public.published_content;

create trigger trg_archive_published_content
before update on public.published_content
for each row
execute function public.archive_published_content();

comment on schema content_private is
  'Unexposed V2 editorial helpers; no USAGE/EXECUTE for API roles or PUBLIC.';
comment on table public.content_drafts is
  'Singleton V2 editorial draft with generation CAS; source of truth for in-progress content.';
comment on table public.content_agent_connections is
  'Delegated agent connections bound to one admin principal; token stored only as 32-byte hash.';
comment on table public.content_edit_exports is
  'Durable cross-device ChatGPT export bases with creator-isolated retrieval and five-row pruning.';
comment on table public.content_publish_preparations is
  'Two-phase guarded publication preparations with terminal outcomes and replayable results.';
