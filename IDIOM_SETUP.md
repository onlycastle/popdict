# Idiom And Phrase Setup

PopDict handles single-word lookups through the Free Dictionary API. Multi-word
queries can also call a Supabase Edge Function that proxies the STANDS4 Phrases API.

The STANDS4 credentials must stay server-side. Do not put them in `.env`,
`.env.local`, Vite variables, or the renderer bundle.

## Flow

```text
Renderer -> Supabase Edge Function (`idioms`) -> STANDS4 Phrases API
              cache + per-IP rate limit          private token
```

If Supabase or the function is not configured, PopDict skips idiom lookup and keeps
single-word dictionary search working.

## Maintainer Setup

1. Get STANDS4 credentials from https://www.stands4.com/services/v2/phrases.php.
2. Apply the database migrations:
   ```bash
   supabase link --project-ref <project-ref>
   supabase db push
   ```
3. Deploy the function:
   ```bash
   supabase functions deploy idioms
   ```
4. Store credentials as Supabase secrets:
   ```bash
   supabase secrets set STANDS4_UID=your_uid STANDS4_TOKEN=your_tokenid
   ```
5. Point the desktop app at the Supabase project:
   ```env
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
   ```

Test phrases: `kick the bucket`, `break the ice`, `once in a blue moon`,
`piece of cake`.

## Abuse Protection

The Supabase publishable key ships with the app, so the function is publicly
callable. The function protects the shared STANDS4 quota with:

- A 24-hour in-memory response cache per function instance.
- A per-IP daily counter in Postgres via `increment_idiom_usage`.

The limiter fails closed when its required Supabase service role configuration or
RPC call is unavailable. Over-limit callers receive HTTP 429; unavailable limiter
state returns HTTP 503.

Tune `PER_IP_DAILY_LIMIT` in `supabase/functions/idioms/index.ts`. For stronger
protection, add a global daily budget or a durable limiter such as Upstash.

## References

- [Free Dictionary API](https://dictionaryapi.dev/)
- [STANDS4 Phrases API](https://www.stands4.com/services/v2/phrases.php)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
