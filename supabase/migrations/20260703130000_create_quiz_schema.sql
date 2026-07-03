-- Quiz email loop (monetization Phase 1, free tier).
-- quiz_preferences is user-managed (app Settings toggle) — per-user RLS.
-- quizzes / quiz_questions / word_reviews are written only by the quiz edge
-- function with the service role; RLS enabled with no policies seals them
-- (same pattern as download_events).

create table public.quiz_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  cadence text not null default 'weekly' check (cadence in ('weekly')),
  streak integer not null default 0,
  unsubscribe_token uuid not null unique default gen_random_uuid(),
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update on public.quiz_preferences to authenticated;
alter table public.quiz_preferences enable row level security;

create policy "Users can read their own quiz preferences"
on public.quiz_preferences for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert their own quiz preferences"
on public.quiz_preferences for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own quiz preferences"
on public.quiz_preferences for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sent_at timestamptz not null default now(),
  answered_at timestamptz
);
alter table public.quizzes enable row level security;
create index quizzes_user_sent_idx on public.quizzes (user_id, sent_at desc);

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  word text not null,
  normalized_word text not null,
  options jsonb not null,
  correct_index integer not null check (correct_index between 0 and 3),
  chosen_index integer check (chosen_index between 0 and 3),
  answered_at timestamptz
);
alter table public.quiz_questions enable row level security;

create table public.word_reviews (
  user_id uuid not null references auth.users(id) on delete cascade,
  normalized_word text not null,
  box integer not null default 1 check (box between 1 and 5),
  next_due_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, normalized_word)
);
alter table public.word_reviews enable row level security;

-- PostgREST can't `order by random()`; the quiz function samples distractors
-- through this RPC. Service role only.
create or replace function public.random_en_ko(n integer)
returns table (word text, ko text[])
language sql stable
as $$
  select word, ko from public.en_ko_translations order by random() limit n;
$$;
revoke execute on function public.random_en_ko(integer) from public, anon, authenticated;
