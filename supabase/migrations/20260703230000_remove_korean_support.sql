-- Korean support removed (2026-07-03): PopDict is an English-medium product,
-- so the krdict proxy's per-IP usage counter and the en→ko translation table
-- go away. Drops are idempotent (`if exists`) so this applies cleanly whether
-- or not the create migrations ever reached this database. The krdict Edge
-- Function itself is not migration-managed and is undeployed separately
-- (`supabase functions delete krdict`).

-- Versioned 23:00 deliberately: PR #28 (open) carries a 15:00 en_ko seed
-- migration plus the random_en_ko RPC, so this teardown must sort after them
-- to keep a fresh `db push` valid if that PR ever lands (it needs
-- de-Koreanizing first regardless).

drop function if exists public.random_en_ko(integer);
drop function if exists public.increment_krdict_usage(text);
drop table if exists public.krdict_usage;
drop table if exists public.en_ko_translations;

-- Restore the original saved-word source set. Korean lookups shipped in
-- v1.2.0, so real 'krdict' rows may exist; remap them so the rows stay
-- visible in saved-words lists and the tightened CHECK can be applied.
-- Sequence the live teardown as: delete the krdict function FIRST, then push
-- this migration — after the function is gone, v1.2.0 clients can no longer
-- obtain krdict results to save, so the tighter CHECK breaks no in-flight
-- saves.
update public.saved_words set source = 'free-dictionary' where source = 'krdict';

alter table public.saved_words
  drop constraint if exists saved_words_source_check;

alter table public.saved_words
  add constraint saved_words_source_check
  check (source in ('free-dictionary', 'phrases-api', 'both'));
