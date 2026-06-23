# Idiom & Phrase Support

PopDict searches idioms/phrases in addition to single words:

- **Single word** (e.g. "apple") → Free Dictionary API only
- **Multi-word** (e.g. "kick the bucket") → Free Dictionary API **and** the STANDS4
  phrases source (queried in parallel); the idiom shows in a blue highlighted box.

## Architecture — why a server-side proxy

The STANDS4 token must **never** ship in the desktop app: anything in the renderer
bundle is extractable from the `.asar`, and the free tier is a shared 100 requests/day
quota. So idiom lookups go through a **Supabase Edge Function** (`supabase/functions/idioms`)
that holds the token server-side and caches responses.

```
renderer  --supabase.functions.invoke('idioms')-->  Edge Function  --token-->  STANDS4
                                                     (cache, no token in client)
```

The client code is `fetchIdiom()` in `src/services/dictionaryApi.ts`. With no Supabase
configured, idiom lookups are simply skipped (single-word search still works).

## One-time setup (maintainer)

1. **Get STANDS4 credentials** — sign up at
   https://www.stands4.com/services/v2/phrases.php (free tier: 100 queries/day). You get
   a `uid` and a `tokenid`.

2. **Apply migrations** (creates `saved_words` and the `idiom_usage` rate-limit table):
   ```bash
   supabase db push
   ```

3. **Deploy the function:**
   ```bash
   supabase functions deploy idioms
   ```

4. **Set the token as a secret** (server-side only — never in `.env` / the app bundle):
   ```bash
   supabase secrets set STANDS4_UID=your_uid STANDS4_TOKEN=your_tokenid
   ```

5. **Point the app at your Supabase project** in `.env` (these are safe to bundle):
   ```env
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```

Test with: "kick the bucket", "break the ice", "once in a blue moon", "piece of cake".

## Abuse protection

The anon key ships in the app, so the function is publicly callable. Two guards protect the
shared STANDS4 quota:

- **24h response cache** (per function instance) — repeated lookups of the same phrase don't
  re-hit STANDS4.
- **Per-IP daily limit** (`PER_IP_DAILY_LIMIT`, default 40) via the `idiom_usage` table and
  the `increment_idiom_usage` RPC (service role). Over-limit callers get HTTP 429. The
  limiter **fails open** if the table/RPC is unavailable, so a DB hiccup won't break idioms.

Tune `PER_IP_DAILY_LIMIT` in `supabase/functions/idioms/index.ts`. For stronger protection
(e.g. botnets), add a global daily budget or a durable limiter such as Upstash.

## Notes

- If you don't want to run STANDS4 at all, leave the function undeployed; idioms simply
  won't appear and single-word lookups are unaffected.

## Resources

- [Free Dictionary API](https://dictionaryapi.dev/)
- [STANDS4 Phrases API](https://www.stands4.com/services/v2/phrases.php)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
