// Private, no-login feedback endpoint for the desktop app.
// Deploy with: supabase functions deploy feedback --no-verify-jwt

// @ts-ignore - resolved by the Deno runtime, not the app's tsc
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.108.2'
import { consumeRequestQuota } from '../_shared/requestQuota.ts'
import { validateFeedbackSubmission } from './lib.ts'

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
  env: { get: (key: string) => string | undefined }
}

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
  'access-control-allow-methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
  })
}

function rateLimited(): Response {
  return new Response(JSON.stringify({ error: 'rate limit exceeded' }), {
    status: 429,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json', 'retry-after': '3600' },
  })
}

function admin() {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('supabase env missing')
  return createClient(url, key)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const contentLength = Number(req.headers.get('content-length') ?? '0')
  if (Number.isFinite(contentLength) && contentLength > 8_192) {
    return json({ error: 'feedback too large' }, 413)
  }

  try {
    const db = admin()
    const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!secret) throw new Error('supabase env missing')
    const allowed = await consumeRequestQuota({
      headers: req.headers,
      limit: 5,
      scope: 'feedback',
      secret,
      consume: async (keyHash, limit) => {
        const { data, error } = await db.rpc('consume_function_request_quota', {
          p_scope: 'feedback',
          p_key_hash: keyHash,
          p_limit: limit,
        })
        return { data: data as boolean | null, error }
      },
    })
    if (!allowed) return rateLimited()

    const rawBody = await req.text()
    if (new TextEncoder().encode(rawBody).byteLength > 8_192) {
      return json({ error: 'feedback too large' }, 413)
    }
    let body: unknown
    try {
      body = JSON.parse(rawBody)
    } catch {
      return json({ error: 'invalid json' }, 400)
    }
    const validation = validateFeedbackSubmission(body)
    if (!validation.ok) return json({ error: validation.message }, 400)

    const { error } = await db.from('feedback_submissions').insert(validation.value)
    if (error?.code === '23505') return json({ ok: true })
    if (error) return json({ error: 'feedback failed' }, 500)
    return json({ ok: true }, 201)
  } catch (error) {
    console.error(error)
    return json({ error: 'internal error' }, 500)
  }
})
