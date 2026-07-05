---
title: Dictionary data & lookup
last-verified: 2026-07-05
---

# Dictionary data

Lookup flows from `src/views/SearchView.tsx` through
[DictionaryService.ts](../../src/services/dictionary/DictionaryService.ts):
single words hit the free dictionary alone; multi-word queries also try the
idiom source in parallel and merge whatever succeeds (interface:
[DictionarySource.ts](../../src/services/dictionary/DictionarySource.ts)).

## Sources

| Source | Handles | Backed by |
|---|---|---|
| [FreeDictionarySource.ts](../../src/services/dictionary/FreeDictionarySource.ts) | English definitions | free dictionary API |
| [IdiomSource.ts](../../src/services/dictionary/IdiomSource.ts) | Idioms | `idioms` edge function |

Korean support (krdict lookups, en→ko glosses) was removed 2026-07-03 —
PopDict is an English-medium product. The DB teardown is
[20260703230000_remove_korean_support.sql](../../supabase/migrations/20260703230000_remove_korean_support.sql);
the earlier Korean-era migrations stay in place because applied migrations
are immutable.

## Supabase

- Edge functions: [idioms](../../supabase/functions/idioms/index.ts),
  [downloads](../../supabase/functions/downloads/index.ts). All read their
  secrets (service-role key, upstream API keys, endpoint tokens) via
  `Deno.env.get` — the `supabase-boundary` gate enforces the boundary
  (learning L-006). Functions using custom token auth deploy with
  `--no-verify-jwt`.
- Migrations: [supabase/migrations/](../../supabase/migrations/) — saved
  words, idiom usage, download tracking, and the Korean-era create/teardown
  pairs noted above.

## Saved words

[SavedWordsRepository.ts](../../src/services/SavedWordsRepository.ts) against
the `saved_words` table (anon key via
[supabaseClient.ts](../../src/services/supabaseClient.ts)); UI in
`src/views/SavedWordsView.tsx`.

## Study digest

Weekly quiz emails turn saved words into spaced-repetition exercises. One
edge function owns the whole loop:
[quiz/index.ts](../../supabase/functions/quiz/index.ts).

| Action | Trigger | Does |
|---|---|---|
| `send` | Vercel Cron via [site/app/api/cron/quiz/quiz.ts](../../site/app/api/cron/quiz/quiz.ts) (`x-quiz-token`) | Builds each due user's digest from saved words + Leitner state, emails it through Resend. |
| `answer` | Email link, proxied by [site/app/quiz/answer/route.ts](../../site/app/quiz/answer/route.ts) | Records the choice, advances the Leitner box, updates streak. |
| `review` | Fetched by [site/app/quiz/result/page.tsx](../../site/app/quiz/result/page.tsx) | Returns the study material + outcome to render the full study card. |
| `unsubscribe` | Proxied by [site/app/quiz/unsubscribe/route.ts](../../site/app/quiz/unsubscribe/route.ts) → [unsubscribed page](../../site/app/quiz/unsubscribed/page.tsx) | Flips `quiz_preferences.enabled` off. |

Study material (definition, examples, similar expressions, quiz distractors)
is generated once per word by
[materials.ts](../../supabase/functions/quiz/materials.ts) via the Anthropic
API — secret read through `Deno.env.get('ANTHROPIC_API_KEY')`, same boundary
as the other functions — and cached forever in
[word_study_materials](../../supabase/migrations/20260705120000_create_word_study_materials.sql),
never regenerated once cached.

Spaced repetition (Leitner boxes 1-5) lives in `word_reviews`, created in
[20260703130000_create_quiz_schema.sql](../../supabase/migrations/20260703130000_create_quiz_schema.sql)
alongside `quiz_preferences`/`quizzes`/`quiz_questions`; the box math is in
[lib.ts](../../supabase/functions/quiz/lib.ts).

In the app,
[QuizPreferencesRepository.ts](../../src/services/QuizPreferencesRepository.ts)
reads/writes `quiz_preferences`;
[useSaveWord.ts](../../src/hooks/useSaveWord.ts) prompts opt-in once, on a
user's 5th saved word.
