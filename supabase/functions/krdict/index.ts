// PopDict Korean→English proxy (Supabase Edge Function, Deno runtime).
//
// Why this exists: the krdict Open API key must NOT ship in the desktop app
// (anything in the renderer bundle is extractable from the .asar). This
// function keeps the key server-side, converts krdict's XML to the app's
// entry shape, and caches responses.
//
// Deploy:  supabase functions deploy krdict
// Secrets: supabase secrets set KRDICT_API_KEY=...
//
// The in-memory cache below is per-instance and best-effort. Cache misses are
// protected by a durable per-IP counter in Postgres (see the krdict_usage
// migration), called with the service role key so public clients cannot
// bypass it — same pattern as the idioms function.
//
// Contract: only a well-formed <channel> response (including a genuinely
// empty result set) is cached as { results }. Upstream failures — non-2xx
// status, an <error> root element, or a network exception — always return
// uncached 503 { results: [], error }, so a transient krdict outage can
// never be mistaken for "word not found" and never poisons the cache.

// @ts-ignore - resolved by the Deno runtime, not the app's tsc
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// @ts-ignore - Deno requires the extension; fast-xml-parser resolves via deno.json
import { parseKrdictXml } from './mapper.ts'

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
  env: { get: (key: string) => string | undefined }
}

const KRDICT_BASE = 'https://krdict.korean.go.kr/api/search'
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 // 24h — dictionary entries are static
const MAX_WORD_LEN = 40
const PER_IP_DAILY_LIMIT = 300 // krdict allows 50k/day total; generous per-user cap

function clientIp(req: Request): string {
  return (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown'
}

type RateLimitState = 'ok' | 'limited' | 'unavailable'

// Fail closed when the limiter is unavailable: Korean lookups degrade to an
// error message in the app, but the shared key can't be drained through a
// misconfigured function.
async function checkRateLimit(ip: string): Promise<RateLimitState> {
  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) return 'unavailable'
  try {
    const admin = createClient(url, serviceKey)
    const { data, error } = await admin.rpc('increment_krdict_usage', { p_ip: ip })
    if (error) return 'unavailable'
    if (typeof data !== 'number') return 'unavailable'
    return data > PER_IP_DAILY_LIMIT ? 'limited' : 'ok'
  } catch {
    return 'unavailable'
  }
}

const cache = new Map<string, { at: number; results: unknown }>()

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ results: [], error: 'Method not allowed' }, 405)

  const apiKey = Deno.env.get('KRDICT_API_KEY')
  if (!apiKey) return json({ results: [], error: 'Korean dictionary not configured' }, 503)

  let word = ''
  try {
    const body = await req.json()
    word = String(body?.word ?? '').trim()
  } catch {
    return json({ results: [], error: 'Invalid body' }, 400)
  }
  if (!word || word.length > MAX_WORD_LEN) return json({ results: [] })

  const key = word.toLowerCase()
  const cached = cache.get(key)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return json({ results: cached.results }) // cache hits don't count against the limit
  }

  // Rate-limit only actual upstream calls (after a cache miss).
  const rateLimit = await checkRateLimit(clientIp(req))
  if (rateLimit === 'limited') return json({ results: [], error: 'rate_limited' }, 429)
  if (rateLimit === 'unavailable') return json({ results: [], error: 'rate_limiter_unavailable' }, 503)

  // Exact headword search with English translations included.
  const url = new URL(KRDICT_BASE)
  url.searchParams.set('key', apiKey)
  url.searchParams.set('q', word)
  url.searchParams.set('translated', 'y')
  url.searchParams.set('trans_lang', '1') // 1 = English
  url.searchParams.set('advanced', 'y')
  url.searchParams.set('method', 'exact')
  url.searchParams.set('target', '1') // 1 = headword
  url.searchParams.set('num', '20')

  try {
    const upstream = await fetch(url.toString())
    const xml = await upstream.text()
    // krdict signals errors two ways: a non-2xx status, or an HTTP 200 body
    // whose root is <error> (e.g. rate-limit/auth failures upstream). Both
    // parse to an empty result set, which would otherwise be cached for 24h
    // as a false "not found" — surface them as an uncached 503 instead.
    if (!upstream.ok || xml.includes('<error')) {
      return json({ results: [], error: 'upstream_error' }, 503)
    }
    const results = parseKrdictXml(xml)
    cache.set(key, { at: Date.now(), results })
    return json({ results })
  } catch {
    return json({ results: [], error: 'upstream_unreachable' }, 503)
  }
})
