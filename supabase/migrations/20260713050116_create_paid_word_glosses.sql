-- Paid EN -> target-language word gloss cache and generation accounting.
-- All access is through the translate Edge Function using service_role.

create table public.word_glosses (
  normalized_word text not null check (
    char_length(normalized_word) between 1 and 64
    and normalized_word = lower(btrim(normalized_word))
  ),
  lang text not null check (lang in ('ko', 'ja', 'zh-Hans', 'es', 'pt-BR')),
  content_version text not null,
  translations jsonb not null default '[]'::jsonb
    check (jsonb_typeof(translations) = 'array'),
  gloss text not null default '',
  model text not null,
  status text not null default 'pending' check (status in ('pending', 'ready')),
  lease_token uuid,
  lease_expires_at timestamptz,
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (normalized_word, lang, content_version),
  check (
    (status = 'pending' and lease_token is not null and lease_expires_at is not null)
    or
    (status = 'ready' and lease_token is null and lease_expires_at is null and generated_at is not null)
  )
);
alter table public.word_glosses enable row level security;
revoke all on public.word_glosses from anon, authenticated;
grant select, insert, update, delete on public.word_glosses to service_role;
create table public.gloss_user_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default (timezone('utc', now()))::date,
  count integer not null default 0 check (count >= 0),
  primary key (user_id, day)
);
alter table public.gloss_user_usage enable row level security;
revoke all on public.gloss_user_usage from anon, authenticated;
grant select, insert, update, delete on public.gloss_user_usage to service_role;
create table public.gloss_global_usage (
  day date primary key default (timezone('utc', now()))::date,
  count integer not null default 0 check (count >= 0)
);
alter table public.gloss_global_usage enable row level security;
revoke all on public.gloss_global_usage from anon, authenticated;
grant select, insert, update, delete on public.gloss_global_usage to service_role;
create or replace function public.increment_gloss_user_usage(p_user_id uuid)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  new_count integer;
begin
  insert into public.gloss_user_usage (user_id, day, count)
  values (p_user_id, (timezone('utc', now()))::date, 1)
  on conflict (user_id, day)
  do update set count = gloss_user_usage.count + 1
  returning count into new_count;
  return new_count;
end;
$$;
revoke all on function public.increment_gloss_user_usage(uuid)
  from public, anon, authenticated;
grant execute on function public.increment_gloss_user_usage(uuid) to service_role;
create or replace function public.increment_gloss_global_usage()
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  new_count integer;
begin
  insert into public.gloss_global_usage (day, count)
  values ((timezone('utc', now()))::date, 1)
  on conflict (day)
  do update set count = gloss_global_usage.count + 1
  returning count into new_count;
  return new_count;
end;
$$;
revoke all on function public.increment_gloss_global_usage()
  from public, anon, authenticated;
grant execute on function public.increment_gloss_global_usage() to service_role;
-- Insert a generation lease, or reclaim an expired one. The returned token is
-- required when the worker marks the row ready, preventing a slow expired
-- worker from overwriting a newer generation.
create or replace function public.claim_gloss_generation(
  p_word text,
  p_lang text,
  p_content_version text,
  p_model text,
  p_lease_seconds integer default 30
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  claimed_token uuid := gen_random_uuid();
  returned_token uuid;
begin
  insert into public.word_glosses (
    normalized_word,
    lang,
    content_version,
    model,
    status,
    lease_token,
    lease_expires_at
  ) values (
    p_word,
    p_lang,
    p_content_version,
    p_model,
    'pending',
    claimed_token,
    now() + make_interval(secs => greatest(5, least(p_lease_seconds, 120)))
  )
  on conflict (normalized_word, lang, content_version)
  do update set
    model = excluded.model,
    status = 'pending',
    lease_token = excluded.lease_token,
    lease_expires_at = excluded.lease_expires_at,
    updated_at = now()
  where word_glosses.status = 'pending'
    and word_glosses.lease_expires_at <= now()
  returning lease_token into returned_token;

  return returned_token;
end;
$$;
revoke all on function public.claim_gloss_generation(text, text, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.claim_gloss_generation(text, text, text, text, integer)
  to service_role;
