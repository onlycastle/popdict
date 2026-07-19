// Pure, dependency-free helpers for the `downloads` Edge Function.
// No imports, so `deno test lib_test.ts` runs hermetically.

export type ReleaseAsset = { name: string; download_count: number }
export type Release = { tag_name: string; assets: ReleaseAsset[] }
export type SnapshotRow = { tag: string; asset: string; download_count: number }
export type DayPoint = { date: string; dmg: number; redirects: number }
export type DownloadNotificationRecord = {
  version: string | null
  asset: string | null
  referrer_host: string | null
  country: string | null
  source: string | null
  cta: string | null
}
export type SlackWebhookPayload = {
  text: string
  blocks: {
    type: string
    text?: { type: string; text: string }
    fields?: { type: string; text: string }[]
  }[]
}

// Offset pagination needs a total order. `id` disambiguates equal event
// timestamps; the snapshot table's unique key disambiguates equal assets.
export const DOWNLOAD_EVENT_PAGE_ORDER = ['occurred_at', 'id'] as const
export const SNAPSHOT_PAGE_ORDER = ['captured_on', 'asset', 'tag'] as const

// Reduce a Referer header to its host, dropping path/query. null when absent/unparseable.
export function referrerHost(referer: string | null): string | null {
  if (!referer) return null
  try {
    return new URL(referer).host || null
  } catch {
    return null
  }
}

function slackEscape(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

function slackValue(value: string | null, fallback = 'unknown'): string {
  return value ? slackEscape(value) : fallback
}

// Format a compact incoming-webhook payload for a website redirect intent. The
// destination GitHub DMG delivery is counted separately by GitHub.
export function buildSlackDownloadPayload(record: DownloadNotificationRecord): SlackWebhookPayload {
  const version = slackValue(record.version)
  const asset = slackValue(record.asset)
  const referrer = slackValue(record.referrer_host, 'direct/unknown')
  const country = slackValue(record.country)
  const source = slackValue(record.source, 'website')
  const cta = slackValue(record.cta, 'unknown')

  return {
    text: `New PopDict download redirect: ${asset}`,
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: '*New PopDict download redirect*' } },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Version*\n${version}` },
          { type: 'mrkdwn', text: `*Asset*\n${asset}` },
          { type: 'mrkdwn', text: `*Referrer*\n${referrer}` },
          { type: 'mrkdwn', text: `*Country*\n${country}` },
          { type: 'mrkdwn', text: `*Source*\n${source}` },
          { type: 'mrkdwn', text: `*CTA*\n${cta}` },
        ],
      },
    ],
  }
}

// Flatten GitHub's releases payload into per-asset snapshot rows.
export function releasesToSnapshotRows(releases: Release[]): SnapshotRow[] {
  const rows: SnapshotRow[] = []
  for (const r of releases) {
    for (const a of r.assets ?? []) {
      rows.push({ tag: r.tag_name, asset: a.name, download_count: a.download_count })
    }
  }
  return rows
}

// Classify a snapshot by delivery type. DMG is the canonical human install
// metric; ZIP is primarily the auto-updater and must never be added to DMG.
export function sumSnapshot(
  rows: { asset: string; download_count: number }[],
): { dmg: number; zip: number; other: number; byAsset: Record<string, number> } {
  const byAsset: Record<string, number> = {}
  let dmg = 0
  let zip = 0
  let other = 0
  for (const row of rows) {
    byAsset[row.asset] = (byAsset[row.asset] ?? 0) + row.download_count
    const asset = row.asset.toLowerCase()
    if (asset.endsWith('.dmg')) dmg += row.download_count
    else if (asset.endsWith('.zip')) zip += row.download_count
    else other += row.download_count
  }
  return { dmg, zip, other, byAsset }
}

// Cumulative daily series across the union of all dates in either source.
// GitHub's DMG count carries forward on days without a snapshot. Redirects are
// accumulated independently because the two values are funnel stages, not
// additive download sources.
export function buildTimeseries(
  githubDaily: { date: string; dmg: number }[],
  redirectDaily: { date: string; count: number }[],
): DayPoint[] {
  const dates = Array.from(
    new Set([...githubDaily.map((d) => d.date), ...redirectDaily.map((d) => d.date)]),
  ).sort()
  const ghByDate = new Map(githubDaily.map((d) => [d.date, d.dmg]))
  const redirectsByDate = new Map(redirectDaily.map((d) => [d.date, d.count]))

  const series: DayPoint[] = []
  let ghCarry = 0
  let redirectCumulative = 0
  for (const date of dates) {
    const gh = ghByDate.get(date)
    if (gh !== undefined) ghCarry = gh
    redirectCumulative += redirectsByDate.get(date) ?? 0
    series.push({ date, dmg: ghCarry, redirects: redirectCumulative })
  }
  return series
}

// Count download events per country code; null/blank bucket under 'unknown'.
export function countByCountry(rows: { country: string | null }[]): Record<string, number> {
  const byCountry = new Map<string, number>()
  for (const row of rows) {
    const code = row.country?.trim().toUpperCase()
    const key = code ? code : 'unknown'
    byCountry.set(key, (byCountry.get(key) ?? 0) + 1)
  }
  return Object.fromEntries(byCountry)
}

// Count a bounded, already-sanitized attribution dimension. Old or missing
// rows remain visible under "unknown" instead of silently disappearing.
export function countByDimension(
  rows: Record<string, string | null>[],
  dimension: string,
): Record<string, number> {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const value = row[dimension]?.trim().toLowerCase() || 'unknown'
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return Object.fromEntries(counts)
}
