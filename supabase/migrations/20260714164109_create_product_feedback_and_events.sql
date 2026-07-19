-- Private product feedback and privacy-minimal activation events.
-- Both tables are written only by service-role Edge Functions. RLS has no
-- client policies, and explicit revokes keep Data API clients out even when
-- the public schema is exposed.

create table public.feedback_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  client_request_id uuid not null unique,
  category text not null check (category in ('bug', 'idea', 'dictionary', 'other')),
  message text not null check (char_length(message) between 1 and 1800),
  contact text check (contact is null or char_length(contact) <= 160),
  context text check (context is null or char_length(context) <= 500),
  app_version text not null check (char_length(app_version) between 1 and 80),
  platform text not null check (char_length(platform) between 1 and 80),
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'promoted', 'closed'))
);

alter table public.feedback_submissions enable row level security;
revoke all on table public.feedback_submissions from anon, authenticated;
grant select, insert, update on table public.feedback_submissions to service_role;

create index feedback_submissions_created_at_idx
  on public.feedback_submissions (created_at desc);
create index feedback_submissions_status_created_at_idx
  on public.feedback_submissions (status, created_at desc);

create table public.product_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  client_event_id uuid not null unique,
  session_id uuid not null,
  event_name text not null check (event_name in (
    'first_launch',
    'lookup_success',
    'save_intent_signed_out',
    'oauth_started',
    'oauth_completed',
    'pending_save_completed',
    'first_word_saved',
    'feedback_opened',
    'feedback_submitted'
  )),
  app_version text not null check (char_length(app_version) between 1 and 80),
  platform text not null check (char_length(platform) between 1 and 80)
);

alter table public.product_events enable row level security;
revoke all on table public.product_events from anon, authenticated;
grant select, insert on table public.product_events to service_role;

create index product_events_occurred_at_idx
  on public.product_events (occurred_at desc);
create index product_events_name_occurred_at_idx
  on public.product_events (event_name, occurred_at desc);

-- Atomic hourly quotas for the public feedback/events functions. Only a
-- per-window HMAC is stored; raw network addresses never enter Postgres.
create table public.function_request_quotas (
  scope text not null check (scope in ('feedback', 'events')),
  window_start timestamptz not null,
  key_hash text not null check (char_length(key_hash) = 64),
  request_count integer not null check (request_count between 1 and 10001),
  primary key (scope, window_start, key_hash)
);

alter table public.function_request_quotas enable row level security;
revoke all on table public.function_request_quotas from anon, authenticated;
grant select, insert, update, delete on table public.function_request_quotas to service_role;

create index function_request_quotas_window_start_idx
  on public.function_request_quotas (window_start);

create function public.consume_function_request_quota(
  p_scope text,
  p_key_hash text,
  p_limit integer
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  current_window timestamptz := date_trunc('hour', now());
  current_count integer;
begin
  if p_scope not in ('feedback', 'events')
     or char_length(p_key_hash) <> 64
     or p_limit not between 1 and 10000 then
    raise exception 'invalid quota input';
  end if;

  insert into public.function_request_quotas as quotas (
    scope,
    window_start,
    key_hash,
    request_count
  ) values (
    p_scope,
    current_window,
    p_key_hash,
    1
  )
  on conflict (scope, window_start, key_hash) do update
    set request_count = least(quotas.request_count + 1, p_limit + 1)
  returning request_count into current_count;

  delete from public.function_request_quotas
    where window_start < current_window - interval '48 hours';

  return current_count <= p_limit;
end;
$$;

revoke all on function public.consume_function_request_quota(text, text, integer)
  from public, anon, authenticated;
grant execute on function public.consume_function_request_quota(text, text, integer)
  to service_role;

-- Attribute website redirect intent without pretending it is an additional
-- install. Existing rows remain valid and appear as unattributed.
alter table public.download_events
  add column if not exists source text
    check (source is null or (
      char_length(source) between 1 and 64
      and source ~ '^[a-z0-9][a-z0-9_-]*$'
    )),
  add column if not exists cta text
    check (cta is null or (
      char_length(cta) between 1 and 64
      and cta ~ '^[a-z0-9][a-z0-9_-]*$'
    ));

create index if not exists download_events_source_idx
  on public.download_events (source);
create index if not exists download_events_cta_idx
  on public.download_events (cta);
