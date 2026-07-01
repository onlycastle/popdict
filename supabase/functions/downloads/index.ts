// PopDict download tracker (Supabase Edge Function, Deno runtime).
//
// Counts downloads from two sources into Postgres:
//   - website: /download/latest posts a `record` per redirect (server-to-server).
//   - github:  a daily cron triggers `snapshot`, storing per-asset counts.
// Reads (`stats`, `timeseries`) are gated by an admin token. All DB access uses
// the service-role key, so the RLS-with-no-policies tables stay sealed.
//
// Deploy:  supabase functions deploy downloads
// Secrets: supabase secrets set GITHUB_REPO=onlycastle/popdict \
//            DOWNLOADS_RECORD_TOKEN=... DOWNLOADS_STATS_TOKEN=...

// @ts-ignore - resolved by the Deno runtime, not the app's tsc
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildTimeseries, referrerHost, releasesToSnapshotRows, sumSnapshot } from './lib.ts'

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
  env: { get: (key: string) => string | undefined }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function admin() {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('supabase env missing')
  return createClient(url, key)
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

async function handleRecord(req: Request): Promise<Response> {
  if (req.headers.get('x-record-token') !== Deno.env.get('DOWNLOADS_RECORD_TOKEN')) {
    return json({ error: 'unauthorized' }, 401)
  }
  const body = await req.json().catch(() => ({}))
  await admin().from('download_events').insert({
    version: body.version ?? null,
    asset: body.asset ?? null,
    referrer_host: referrerHost(body.referrer ?? null),
    country: body.country ?? null,
  })
  return new Response(null, { status: 204 })
}

async function handleSnapshot(req: Request): Promise<Response> {
  if (req.headers.get('x-admin-token') !== Deno.env.get('DOWNLOADS_STATS_TOKEN')) {
    return json({ error: 'unauthorized' }, 401)
  }
  const repo = Deno.env.get('GITHUB_REPO')
  if (!repo) return json({ error: 'GITHUB_REPO not set' }, 503)
  const res = await fetch(`https://api.github.com/repos/${repo}/releases`, {
    headers: { Accept: 'application/vnd.github+json' },
  })
  if (!res.ok) return json({ error: 'github fetch failed' }, 502)
  const rows = releasesToSnapshotRows(await res.json())
  const captured_on = today()
  const { error } = await admin()
    .from('github_snapshots')
    .upsert(rows.map((r) => ({ ...r, captured_on })), { onConflict: 'captured_on,tag,asset' })
  if (error) return json({ error: error.message }, 500)
  return json({ ok: true, rows: rows.length })
}

function authorizedRead(req: Request): boolean {
  return req.headers.get('authorization') === `Bearer ${Deno.env.get('DOWNLOADS_STATS_TOKEN')}`
}

async function handleStats(): Promise<Response> {
  const db = admin()
  const { data: latest } = await db
    .from('github_snapshots').select('captured_on')
    .order('captured_on', { ascending: false }).limit(1)
  const asOf = latest?.[0]?.captured_on ?? null
  let github = { total: 0, byAsset: {} as Record<string, number>, asOf }
  if (asOf) {
    const { data: snap } = await db
      .from('github_snapshots').select('asset,download_count').eq('captured_on', asOf)
    github = { ...sumSnapshot(snap ?? []), asOf }
  }
  const { count } = await db
    .from('download_events').select('*', { count: 'exact', head: true })
  const website = count ?? 0
  return json({ combined: github.total + website, github, website: { total: website } })
}

async function handleTimeseries(): Promise<Response> {
  const db = admin()
  const { data: ghRows } = await db.from('github_snapshots').select('captured_on,download_count')
  const ghMap = new Map<string, number>()
  for (const r of ghRows ?? []) ghMap.set(r.captured_on, (ghMap.get(r.captured_on) ?? 0) + r.download_count)
  const githubDaily = [...ghMap.entries()]
    .map(([date, total]) => ({ date, total }))
    .sort((a, b) => (a.date < b.date ? -1 : 1))

  const { data: evRows } = await db.from('download_events').select('occurred_at')
  const webMap = new Map<string, number>()
  for (const r of evRows ?? []) {
    const d = String(r.occurred_at).slice(0, 10)
    webMap.set(d, (webMap.get(d) ?? 0) + 1)
  }
  const websiteDaily = [...webMap.entries()]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => (a.date < b.date ? -1 : 1))

  return json(buildTimeseries(githubDaily, websiteDaily))
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url)
  try {
    if (req.method === 'POST') {
      const body = await req.clone().json().catch(() => ({}))
      if (body.action === 'record') return await handleRecord(req)
      if (body.action === 'snapshot') return await handleSnapshot(req)
      return json({ error: 'unknown action' }, 400)
    }
    if (req.method === 'GET') {
      if (!authorizedRead(req)) return json({ error: 'unauthorized' }, 401)
      if (url.searchParams.has('timeseries')) return await handleTimeseries()
      if (url.searchParams.has('stats')) return await handleStats()
      return json({ error: 'specify ?stats or ?timeseries' }, 400)
    }
    return json({ error: 'method not allowed' }, 405)
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
