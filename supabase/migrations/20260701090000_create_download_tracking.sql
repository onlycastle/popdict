-- Download tracking: raw website download events + daily GitHub count snapshots.
-- Both tables are written ONLY by the `downloads` Edge Function's service-role
-- client. RLS is enabled with NO policies, so anon/authenticated clients can
-- neither read nor write them (same pattern as public.idiom_usage).

-- One row per website-initiated download click. No IP, no User-Agent, no cookie.
create table if not exists public.download_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  version text,        -- release tag resolved at click time, e.g. 'v1.1.1'
  asset text,          -- dmg filename the visitor was redirected to
  referrer_host text,  -- host only (e.g. 'news.ycombinator.com'); no path, no query
  country text         -- coarse geo from x-vercel-ip-country; no IP stored
);
alter table public.download_events enable row level security;

-- Daily snapshot of GitHub's cumulative per-asset download counts.
create table if not exists public.github_snapshots (
  id uuid primary key default gen_random_uuid(),
  captured_at timestamptz not null default now(),
  captured_on date not null default current_date,
  tag text not null,
  asset text not null,
  download_count integer not null,
  unique (captured_on, tag, asset)  -- idempotent: a same-day re-run upserts
);
alter table public.github_snapshots enable row level security;

create index if not exists download_events_occurred_at_idx
  on public.download_events (occurred_at);
create index if not exists github_snapshots_captured_on_idx
  on public.github_snapshots (captured_on);
