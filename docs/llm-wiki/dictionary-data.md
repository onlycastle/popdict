---
title: Dictionary data & lookup
last-verified: 2026-07-03
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
