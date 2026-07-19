-- Enforce the same bounded, normalized shapes when authenticated clients call
-- the Data API directly instead of going through the desktop repository.

create or replace function public.saved_word_related_words_valid(value text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select value is null or (
    pg_catalog.cardinality(value) <= 20
    and not exists (
      select 1
      from pg_catalog.unnest(value) as item
      where item is null or pg_catalog.char_length(item) not between 1 and 300
    )
  );
$$;

revoke all on function public.saved_word_related_words_valid(text[]) from public, anon;
grant execute on function public.saved_word_related_words_valid(text[])
  to authenticated, service_role;

alter table public.saved_words
  add constraint saved_words_related_words_check check (
    public.saved_word_related_words_valid(synonyms)
    and public.saved_word_related_words_valid(antonyms)
  );

-- The table is introduced earlier in this same release train, so no public
-- client can have written non-normalized rows before this migration runs.
alter table public.saved_word_tags
  drop constraint if exists saved_word_tags_tag_check,
  add constraint saved_word_tags_tag_check check (
    tag = trim(regexp_replace(tag, '\s+', ' ', 'g'))
    and char_length(tag) between 1 and 40
    and tag !~ '[[:cntrl:]]'
  );
