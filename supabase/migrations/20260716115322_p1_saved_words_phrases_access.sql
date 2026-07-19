-- PopDict 1.8.0 P1 data and access foundation.
-- This migration is intentionally additive: 1.7 clients continue to read and
-- write the original saved_words columns while 1.8 clients fill snapshots.

-- Translations are public licensed data. Keep the table read-only to clients,
-- but give signed-out and signed-in lookups identical SELECT access.
drop policy if exists "Signed-in users can read word translations"
  on public.word_translations;
revoke all privileges on table public.word_translations from public, anon, authenticated;
grant select on table public.word_translations to anon, authenticated;
create policy "Anyone can read word translations"
on public.word_translations
for select
to anon, authenticated
using (true);

alter table public.saved_words
  add column if not exists part_of_speech text,
  add column if not exists definition text,
  add column if not exists example text,
  add column if not exists synonyms text[],
  add column if not exists antonyms text[],
  add column if not exists translation text,
  add column if not exists translation_language text,
  add column if not exists source_url text,
  add column if not exists license_name text,
  add column if not exists license_url text,
  add column if not exists details_updated_at timestamptz,
  add column if not exists note text;

alter table public.saved_words
  add constraint saved_words_translation_language_check check (
    translation_language is null
    or translation_language in ('ko', 'ja', 'zh-Hans', 'es', 'pt-BR')
  ),
  add constraint saved_words_note_length_check check (
    note is null or char_length(note) <= 4000
  ),
  add constraint saved_words_snapshot_lengths_check check (
    (part_of_speech is null or char_length(part_of_speech) <= 80)
    and (definition is null or char_length(definition) <= 1200)
    and (example is null or char_length(example) <= 1200)
    and (translation is null or char_length(translation) <= 120)
    and (source_url is null or char_length(source_url) <= 500)
    and (license_name is null or char_length(license_name) <= 120)
    and (license_url is null or char_length(license_url) <= 500)
  );

alter table public.saved_words
  drop constraint if exists saved_words_source_check;
alter table public.saved_words
  add constraint saved_words_source_check check (
    source in (
      'free-dictionary', 'kaikki-phrases', 'combined',
      'phrases-api', 'both'
    )
  );

-- A composite key lets child tables prove that both the saved word and the
-- claimed owner match. The original unique(user_id, normalized_word) remains.
alter table public.saved_words
  add constraint saved_words_user_id_id_key unique (user_id, id);

create table public.saved_word_tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  saved_word_id uuid not null,
  tag text not null check (
    char_length(trim(tag)) between 1 and 40
    and tag !~ '[[:cntrl:]]'
  ),
  normalized_tag text generated always as (
    lower(trim(regexp_replace(tag, '\s+', ' ', 'g')))
  ) stored,
  created_at timestamptz not null default now(),
  constraint saved_word_tags_owner_fk
    foreign key (user_id, saved_word_id)
    references public.saved_words(user_id, id)
    on delete cascade,
  constraint saved_word_tags_word_normalized_key
    unique (saved_word_id, normalized_tag)
);

create index saved_word_tags_user_tag_idx
  on public.saved_word_tags (user_id, normalized_tag);

alter table public.saved_word_tags enable row level security;
revoke all privileges on table public.saved_word_tags from public, anon, authenticated;
grant select, insert, update, delete on table public.saved_word_tags to authenticated;

create policy "Users can read their own saved word tags"
on public.saved_word_tags for select to authenticated
using ((select auth.uid()) = user_id);
create policy "Users can insert their own saved word tags"
on public.saved_word_tags for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy "Users can update their own saved word tags"
on public.saved_word_tags for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy "Users can delete their own saved word tags"
on public.saved_word_tags for delete to authenticated
using ((select auth.uid()) = user_id);

-- Serialize tag-count checks per saved word so concurrent inserts cannot push
-- a word above the ten-tag product limit.
create or replace function public.enforce_saved_word_tag_limit()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  existing_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.saved_word_id::text, 0));
  select count(*) into existing_count
  from public.saved_word_tags
  where saved_word_id = new.saved_word_id
    and id <> new.id;
  if existing_count >= 10 then
    raise exception 'A saved word can have at most 10 tags.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke execute on function public.enforce_saved_word_tag_limit()
  from public, anon, authenticated;
create trigger saved_word_tags_limit
before insert or update of saved_word_id on public.saved_word_tags
for each row execute function public.enforce_saved_word_tag_limit();

-- Review state is readable by its owner for Saved Words filters and reminder
-- counts. The service-role quiz function remains the only writer.
delete from public.word_reviews review
where not exists (
  select 1
  from public.saved_words saved
  where saved.user_id = review.user_id
    and saved.normalized_word = review.normalized_word
);
alter table public.word_reviews
  add constraint word_reviews_saved_word_fk
  foreign key (user_id, normalized_word)
  references public.saved_words(user_id, normalized_word)
  on delete cascade;
grant select on table public.word_reviews to authenticated;
create policy "Users can read their own word reviews"
on public.word_reviews for select to authenticated
using ((select auth.uid()) = user_id);

-- Licensed English Wiktionary phrase data, public and strictly read-only.
create table public.phrase_entries (
  id bigint generated always as identity primary key,
  normalized_phrase text not null check (
    normalized_phrase = lower(normalized_phrase)
    and normalized_phrase = trim(normalized_phrase)
    and normalized_phrase like '% %'
    and char_length(normalized_phrase) <= 160
  ),
  phrase text not null check (
    char_length(trim(phrase)) between 3 and 160
  ),
  part_of_speech text not null check (char_length(part_of_speech) <= 80),
  sense_rank smallint not null check (sense_rank between 1 and 3),
  definition text not null check (char_length(trim(definition)) between 1 and 1200),
  example text check (example is null or char_length(example) <= 1200),
  synonyms text[] not null default '{}',
  antonyms text[] not null default '{}',
  usage_labels text[] not null default '{}',
  source_url text not null check (char_length(source_url) <= 500),
  license_name text not null check (char_length(license_name) <= 120),
  license_url text not null check (char_length(license_url) <= 500),
  unique (normalized_phrase, sense_rank)
);

create index phrase_entries_normalized_phrase_idx
  on public.phrase_entries (normalized_phrase, sense_rank);
alter table public.phrase_entries enable row level security;
revoke all privileges on table public.phrase_entries from public, anon, authenticated;
grant select on table public.phrase_entries to anon, authenticated;
create policy "Anyone can read phrase entries"
on public.phrase_entries for select to anon, authenticated
using (true);
