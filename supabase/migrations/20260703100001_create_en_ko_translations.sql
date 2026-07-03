-- English→Korean translation pairs derived from the kaikki.org English
-- Wiktionary extract (loaded once by scripts/build-en-ko-dataset.ts). Public
-- read-only reference data: anon may SELECT, nobody may write through the API.

create table if not exists public.en_ko_translations (
  word text primary key,
  ko text[] not null
);

alter table public.en_ko_translations enable row level security;

create policy "en_ko_translations are publicly readable"
  on public.en_ko_translations
  for select
  to anon, authenticated
  using (true);
