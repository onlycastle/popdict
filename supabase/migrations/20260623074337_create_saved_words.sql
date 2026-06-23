create table public.saved_words (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  word text not null check (length(trim(word)) > 0),
  normalized_word text not null check (length(trim(normalized_word)) > 0),
  source text not null default 'free-dictionary' check (
    source in ('free-dictionary', 'phrases-api', 'both')
  ),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (user_id, normalized_word)
);

grant select, insert, update, delete on public.saved_words to authenticated;

alter table public.saved_words enable row level security;

create policy "Users can read their own saved words"
on public.saved_words
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert their own saved words"
on public.saved_words
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own saved words"
on public.saved_words
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own saved words"
on public.saved_words
for delete
to authenticated
using ((select auth.uid()) = user_id);
