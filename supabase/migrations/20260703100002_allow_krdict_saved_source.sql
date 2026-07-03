-- Hangul lookups save with source 'krdict' (added 2026-07-03); the original
-- CHECK predates it and rejects the new value with a raw 23514 error.

alter table public.saved_words
  drop constraint if exists saved_words_source_check;

alter table public.saved_words
  add constraint saved_words_source_check
  check (source in ('free-dictionary', 'phrases-api', 'both', 'krdict'));
