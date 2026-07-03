-- Per-IP daily usage counter for the `krdict` Edge Function, protecting the
-- shared krdict Open API key (50k calls/day) from being drained via the public
-- anon key.
--
-- Only the service role (used by the Edge Function) touches this table. RLS is
-- enabled with NO policies, so anon/authenticated clients can neither read nor
-- write it.

create table if not exists public.krdict_usage (
  ip text not null,
  day date not null default current_date,
  count integer not null default 0,
  primary key (ip, day)
);

alter table public.krdict_usage enable row level security;

-- Atomic increment so concurrent requests can't undercount. Returns the new
-- per-IP count for today.
create or replace function public.increment_krdict_usage(p_ip text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  insert into public.krdict_usage (ip, day, count)
  values (p_ip, current_date, 1)
  on conflict (ip, day)
  do update set count = krdict_usage.count + 1
  returning count into new_count;
  return new_count;
end;
$$;

revoke all on function public.increment_krdict_usage(text) from public, anon, authenticated;
grant execute on function public.increment_krdict_usage(text) to service_role;
