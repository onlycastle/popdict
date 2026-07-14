-- PopDict 1.7.0 replaces live phrase lookup with an authenticated, read-only
-- English-to-target-language dataset derived from English Wiktionary via
-- Kaikki. The generated seed is applied by the following migration.

-- Applied migrations are immutable, so the short-lived billing/gloss schema
-- remains in history and is removed explicitly here before the public release.
drop function if exists public.claim_gloss_generation(text, text, text, text, integer);
drop function if exists public.increment_gloss_global_usage();
drop function if exists public.increment_gloss_user_usage(uuid);
drop function if exists public.increment_stripe_event_attempts(text);
drop function if exists public.increment_idiom_usage(text);

drop table if exists public.word_glosses;
drop table if exists public.gloss_user_usage;
drop table if exists public.gloss_global_usage;
drop table if exists public.stripe_events;
drop table if exists public.stripe_subscriptions;
drop table if exists public.stripe_customers;
drop table if exists public.idiom_usage;

create table public.word_translations (
  normalized_word text not null check (
    length(trim(normalized_word)) > 0 and normalized_word = lower(normalized_word)
  ),
  language_code text not null check (
    language_code in ('ko', 'ja', 'zh-Hans', 'es', 'pt-BR')
  ),
  rank smallint not null check (rank between 1 and 3),
  translation text not null check (
    length(trim(translation)) > 0 and length(translation) <= 120
  ),
  sense_label text check (sense_label is null or length(sense_label) <= 100),
  primary key (normalized_word, language_code, rank),
  unique (normalized_word, language_code, translation)
);

alter table public.word_translations enable row level security;

revoke all privileges on table public.word_translations from public, anon, authenticated;
grant select on table public.word_translations to authenticated;
grant select, insert, update, delete on table public.word_translations to service_role;

create policy "Signed-in users can read word translations"
on public.word_translations
for select
to authenticated
using (
  (select auth.uid()) is not null
  and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
);
