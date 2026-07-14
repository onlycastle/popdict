-- Stripe Billing state is server-managed only. The desktop app reads billing
-- status through authenticated Edge Functions; it never receives direct table
-- access. Explicit service_role grants keep this compatible with Supabase's
-- opt-in Data API exposure defaults.

create table public.stripe_customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text not null unique check (stripe_customer_id ~ '^cus_'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.stripe_customers enable row level security;
revoke all on public.stripe_customers from anon, authenticated;
grant select, insert, update, delete on public.stripe_customers to service_role;
create table public.stripe_subscriptions (
  stripe_subscription_id text primary key check (stripe_subscription_id ~ '^sub_'),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id text not null check (stripe_customer_id ~ '^cus_'),
  stripe_price_id text not null check (stripe_price_id ~ '^price_'),
  plan_key text not null check (plan_key in ('monthly', 'annual')),
  status text not null check (
    status in (
      'incomplete',
      'incomplete_expired',
      'trialing',
      'active',
      'past_due',
      'canceled',
      'unpaid',
      'paused'
    )
  ),
  current_period_end timestamptz,
  access_until timestamptz,
  cancel_at_period_end boolean not null default false,
  last_stripe_event_created_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index stripe_subscriptions_user_access_idx
  on public.stripe_subscriptions (user_id, access_until desc);
create index stripe_subscriptions_customer_idx
  on public.stripe_subscriptions (stripe_customer_id);
alter table public.stripe_subscriptions enable row level security;
revoke all on public.stripe_subscriptions from anon, authenticated;
grant select, insert, update, delete on public.stripe_subscriptions to service_role;
create table public.stripe_events (
  stripe_event_id text primary key check (stripe_event_id ~ '^evt_'),
  event_type text not null,
  object_id text,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'processed', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  event_created_at timestamptz not null,
  processing_started_at timestamptz,
  processed_at timestamptz,
  last_error text,
  received_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index stripe_events_pending_idx
  on public.stripe_events (status, received_at)
  where status in ('pending', 'failed');
alter table public.stripe_events enable row level security;
revoke all on public.stripe_events from anon, authenticated;
grant select, insert, update, delete on public.stripe_events to service_role;
create or replace function public.increment_stripe_event_attempts(p_event_id text)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  new_attempts integer;
begin
  update public.stripe_events
  set attempts = attempts + 1, updated_at = now()
  where stripe_event_id = p_event_id
  returning attempts into new_attempts;
  return new_attempts;
end;
$$;
revoke all on function public.increment_stripe_event_attempts(text)
  from public, anon, authenticated;
grant execute on function public.increment_stripe_event_attempts(text) to service_role;
