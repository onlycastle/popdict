---
title: Dictionary data & lookup
last-verified: 2026-07-03
---

# Dictionary data

Lookup flows from `src/views/SearchView.tsx` through
[DictionaryService.ts](../../src/services/dictionary/DictionaryService.ts),
which routes by script and merges sources (interface:
[DictionarySource.ts](../../src/services/dictionary/DictionarySource.ts)).

## Sources

| Source | Handles | Backed by |
|---|---|---|
| [FreeDictionarySource.ts](../../src/services/dictionary/FreeDictionarySource.ts) | English definitions | free dictionary API |
| [KrdictSource.ts](../../src/services/dictionary/KrdictSource.ts) | Hangul lookups | `krdict` edge function (mapper: [krdictMapper.test.ts](../../src/services/dictionary/krdictMapper.test.ts) documents the shape) |
| [EnKoTranslationSource.ts](../../src/services/dictionary/EnKoTranslationSource.ts) | English→Korean glosses | `en_ko_translations` table |
| [IdiomSource.ts](../../src/services/dictionary/IdiomSource.ts) | Idioms | `idioms` edge function |

Script detection / EN↔KO helpers: [shared/enko.ts](../../shared/enko.ts).
Known v1 gap: conjugated/inflected Korean forms don't match krdict headwords.

## Supabase

- Edge functions: [krdict](../../supabase/functions/krdict/index.ts),
  [idioms](../../supabase/functions/idioms/index.ts),
  [downloads](../../supabase/functions/downloads/index.ts). All read their
  secrets (service-role key, upstream API keys, endpoint tokens) via
  `Deno.env.get` — the `supabase-boundary` gate enforces the boundary
  (learning L-006). Functions using custom token auth deploy with
  `--no-verify-jwt`.
- Migrations: [supabase/migrations/](../../supabase/migrations/) — saved
  words, idiom usage, download tracking, krdict usage, `en_ko_translations`.
- ETL: [scripts/build-en-ko-dataset.ts](../../scripts/build-en-ko-dataset.ts)
  builds the EN→KO dataset CSV for loading into `en_ko_translations`.

## Saved words

[SavedWordsRepository.ts](../../src/services/SavedWordsRepository.ts) against
the `saved_words` table (anon key via
[supabaseClient.ts](../../src/services/supabaseClient.ts)); UI in
`src/views/SavedWordsView.tsx`.
