-- Migration: 20260826000000_published_content_history.sql
-- Description: Historical revision retention for published content alterations.

create table if not exists public.published_content_history (
  revision bigint primary key check (revision > 0),
  schema_version text not null,
  payload jsonb not null,
  published_at timestamptz not null,
  published_by uuid not null references neon_auth."user" (id),
  archived_at timestamptz not null default now()
);

alter table public.published_content_history enable row level security;

revoke all on table public.published_content_history from anonymous, authenticated;
grant select on table public.published_content_history to authenticated;

create policy "Administrators can read published content history"
on public.published_content_history
for select
to authenticated
using (public.is_admin());

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
      archived_at
    )
    values (
      OLD.revision,
      OLD.schema_version,
      OLD.payload,
      OLD.published_at,
      OLD.published_by,
      now()
    )
    on conflict (revision) do update
    set
      payload = excluded.payload,
      schema_version = excluded.schema_version,
      published_at = excluded.published_at,
      published_by = excluded.published_by,
      archived_at = excluded.archived_at;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_archive_published_content on public.published_content;

create trigger trg_archive_published_content
before update on public.published_content
for each row
execute function public.archive_published_content();

comment on table public.published_content_history is
  'Historical log of past published content revisions for audit and emergency recovery.';
