create table if not exists public.page_view_counts (
  view_date date not null,
  route text not null check (
    route in (
      '/',
      '/orientacao',
      '/apoio',
      '/contatos',
      '/educacao',
      '/educacao/:resourceId'
    )
  ),
  view_count bigint not null default 0 check (view_count >= 0),
  primary key (view_date, route)
);

alter table public.page_view_counts enable row level security;

revoke all on table public.page_view_counts from anonymous, authenticated;

create or replace function public.record_page_view(p_route text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_route is null or p_route not in (
    '/',
    '/orientacao',
    '/apoio',
    '/contatos',
    '/educacao',
    '/educacao/:resourceId'
  ) then
    raise exception using
      errcode = '22023',
      message = 'unsupported analytics route';
  end if;

  insert into public.page_view_counts (view_date, route, view_count)
  values (
    pg_catalog.timezone('America/Sao_Paulo', pg_catalog.statement_timestamp())::date,
    p_route,
    1
  )
  on conflict (view_date, route)
  do update set view_count = public.page_view_counts.view_count + 1;
end;
$$;

revoke all on function public.record_page_view(text) from public;
grant execute on function public.record_page_view(text) to anonymous;

create or replace function public.get_page_view_counts(p_start_date date)
returns table (
  view_date date,
  route text,
  view_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_start_date is null then
    raise exception using
      errcode = '22023',
      message = 'start date is required';
  end if;

  if not public.is_admin() then
    raise exception using
      errcode = '42501',
      message = 'administrator access required';
  end if;

  return query
  select
    counts.view_date,
    counts.route,
    case
      when counts.route = '/apoio' then counts.view_count - (counts.view_count % 10)
      else counts.view_count
    end as view_count
  from public.page_view_counts as counts
  where counts.view_date >= p_start_date
    and (counts.route <> '/apoio' or counts.view_count >= 10)
  order by counts.view_date, counts.route;
end;
$$;

revoke all on function public.get_page_view_counts(date) from public;
grant execute on function public.get_page_view_counts(date) to authenticated;

comment on table public.page_view_counts is
  'Daily aggregate page counters. Contains no raw events, timestamps, user/session IDs, IP addresses, or user agents.';
comment on function public.record_page_view(text) is
  'Increments one allowlisted daily page counter without retaining request or visitor identifiers.';
comment on function public.get_page_view_counts(date) is
  'Returns admin-only daily page counters; support-page counts below 10 are suppressed and larger counts are rounded down to tens.';
