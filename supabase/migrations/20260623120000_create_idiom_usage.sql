-- Per-IP daily usage counter for the `idioms` Edge Function, used to protect the
-- shared STANDS4 free-tier quota from being drained via the public anon key.
--
-- Only the service role (used by the Edge Function) touches this table. RLS is
-- enabled with NO policies, so anon/authenticated clients can neither read nor
-- write it.

create table if not exists public.idiom_usage (
  ip text not null,
  day date not null default current_date,
  count integer not null default 0,
  primary key (ip, day)
);

alter table public.idiom_usage enable row level security;

-- Atomic increment so concurrent requests can't undercount. Returns the new
-- per-IP count for today.
create or replace function public.increment_idiom_usage(p_ip text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  insert into public.idiom_usage (ip, day, count)
  values (p_ip, current_date, 1)
  on conflict (ip, day)
  do update set count = idiom_usage.count + 1
  returning count into new_count;
  return new_count;
end;
$$;

revoke all on function public.increment_idiom_usage(text) from public, anon, authenticated;
