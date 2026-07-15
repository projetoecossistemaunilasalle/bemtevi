create table if not exists public.published_content (
  id text primary key check (id = 'current'),
  schema_version text not null,
  revision bigint not null check (revision > 0),
  payload jsonb not null,
  published_at timestamptz not null default now(),
  published_by uuid not null references neon_auth."user" (id)
);

alter table public.published_content enable row level security;

revoke all on table public.published_content from anonymous, authenticated;
grant select on table public.published_content to anonymous, authenticated;
grant insert, update on table public.published_content to authenticated;

create policy "Anyone can read current published content"
on public.published_content
for select
to anonymous, authenticated
using (id = 'current');

create policy "Administrators can create published content"
on public.published_content
for insert
to authenticated
with check (
  public.is_admin()
  and published_by::text = (select auth.user_id())
);

create policy "Administrators can update published content"
on public.published_content
for update
to authenticated
using (public.is_admin())
with check (
  public.is_admin()
  and published_by::text = (select auth.user_id())
);

comment on table public.published_content is
  'Singleton live SeCuida content snapshot read by the public application.';
comment on column public.published_content.revision is
  'Optimistic concurrency revision incremented by each successful publication.';
