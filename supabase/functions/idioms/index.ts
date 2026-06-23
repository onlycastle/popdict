// PopDict idiom proxy (Supabase Edge Function, Deno runtime).
//
// Why this exists: the STANDS4 phrases API token must NOT ship in the desktop
// app (anything in the renderer bundle is extractable from the .asar). This
// function keeps the token server-side and caches responses so a single shared
// free-tier quota (100 requests/day) isn't drained by one user.
//
// Deploy:  supabase functions deploy idioms
// Secrets: supabase secrets set STANDS4_UID=... STANDS4_TOKEN=...
//
// The in-memory cache below is per-instance and best-effort. Cache misses are
// protected by a durable per-IP counter in Postgres, called with the service
// role key so public clients cannot bypass it.

// @ts-ignore - resolved by the Deno runtime, not the app's tsc
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
  env: { get: (key: string) => string | undefined }
}

const STANDS4_BASE = 'https://www.stands4.com/services/v2/phrases.php'
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 // 24h
const MAX_PHRASE_LEN = 80
const PER_IP_DAILY_LIMIT = 40 // cap upstream calls per IP/day (STANDS4 free tier is 100/day total)

function clientIp(req: Request): string {
  return (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown'
}

type RateLimitState = 'ok' | 'limited' | 'unavailable'

// Per-IP daily rate limit via an atomic RPC (service role). Fail closed when
// the limiter is unavailable; idioms are optional, but the shared STANDS4 quota
// must not be exposed by a misconfigured function.
async function checkRateLimit(ip: string): Promise<RateLimitState> {
  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) return 'unavailable'
  try {
    const admin = createClient(url, serviceKey)
    const { data, error } = await admin.rpc('increment_idiom_usage', { p_ip: ip })
    if (error) return 'unavailable'
    if (typeof data !== 'number') return 'unavailable'
    return data > PER_IP_DAILY_LIMIT ? 'limited' : 'ok'
  } catch {
    return 'unavailable'
  }
}

const cache = new Map<string, { at: number; result: unknown }>()

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
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const uid = Deno.env.get('STANDS4_UID')
  const token = Deno.env.get('STANDS4_TOKEN')
  if (!uid || !token) return json({ error: 'Idioms not configured' }, 503)

  let phrase = ''
  try {
    const body = await req.json()
    phrase = String(body?.phrase ?? '').trim()
  } catch {
    return json({ error: 'Invalid body' }, 400)
  }
  if (!phrase || phrase.length > MAX_PHRASE_LEN) return json({ result: null })

  const key = phrase.toLowerCase()
  const cached = cache.get(key)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return json({ result: cached.result }) // cache hits don't count against the limit
  }

  // Rate-limit only actual upstream calls (after a cache miss).
  const rateLimit = await checkRateLimit(clientIp(req))
  if (rateLimit === 'limited') {
    return json({ result: null, error: 'rate_limited' }, 429)
  }
  if (rateLimit === 'unavailable') {
    return json({ result: null, error: 'rate_limiter_unavailable' }, 503)
  }

  const url = new URL(STANDS4_BASE)
  url.searchParams.set('uid', uid)
  url.searchParams.set('tokenid', token)
  url.searchParams.set('phrase', phrase)
  url.searchParams.set('format', 'json')

  try {
    const upstream = await fetch(url.toString())
    if (!upstream.ok) return json({ result: null })
    const data = await upstream.json()
    const raw = data?.results?.result ?? null
    // STANDS4 returns either a single object or an array; normalize to one.
    const result = Array.isArray(raw) ? (raw[0] ?? null) : raw
    cache.set(key, { at: Date.now(), result })
    return json({ result })
  } catch {
    return json({ result: null })
  }
})
