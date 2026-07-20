create table if not exists public.admin_users (
  user_id uuid primary key references neon_auth."user" (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

revoke all on table public.admin_users from anonymous, authenticated;
grant select on table public.admin_users to authenticated;

create policy "Users can read their own admin membership"
on public.admin_users
for select
to authenticated
using ((select auth.user_id()) = user_id::text);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id::text = (select auth.user_id())
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

comment on table public.admin_users is
  'Allowlist of Neon Auth users authorized to access BemTeVi administration.';
comment on function public.is_admin() is
  'Neon Data API RLS predicate for administrator-only database operations.';
