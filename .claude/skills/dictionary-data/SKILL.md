---
name: dictionary-data
description: Use when changing dictionary lookup behavior, dictionary sources, Supabase edge functions or migrations, or saved-words storage.
---

# Dictionary Data Specialist

Domain map: [docs/llm-wiki/dictionary-data.md](../../../docs/llm-wiki/dictionary-data.md)
— read it first.

## Working rules

- Lookup routing lives in
  [DictionaryService.ts](../../../src/services/dictionary/DictionaryService.ts);
  new sources implement
  [DictionarySource.ts](../../../src/services/dictionary/DictionarySource.ts)
  and get unit tests beside the existing ones.
- Edge functions read every secret via `Deno.env.get` — the
  `supabase-boundary` gate fails otherwise (learning L-006). Functions with
  custom token auth deploy with `--no-verify-jwt`.
- Schema changes go through `supabase/migrations/` files, never ad-hoc SQL.
  Applied migrations are immutable — undo with a new forward migration, never
  by deleting the file (the remote migration history would desync).

## Verification

`npm test` (dictionary suites), `npm run harness:validate`. For edge
function changes, exercise the deployed function against a known word or
phrase before closing.
