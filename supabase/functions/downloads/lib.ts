// Pure, dependency-free helpers for the `downloads` Edge Function.
// No imports, so `deno test lib_test.ts` runs hermetically.

export type ReleaseAsset = { name: string; download_count: number }
export type Release = { tag_name: string; assets: ReleaseAsset[] }
export type SnapshotRow = { tag: string; asset: string; download_count: number }
export type DayPoint = { date: string; github: number; website: number; combined: number }
export type DownloadNotificationRecord = {
  version: string | null
  asset: string | null
  referrer_host: string | null
  country: string | null
}
export type SlackWebhookPayload = {
  text: string
  blocks: {
    type: string
    text?: { type: string; text: string }
    fields?: { type: string; text: string }[]
  }[]
}

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

// Format a compact incoming-webhook payload for a successful website download record.
export function buildSlackDownloadPayload(record: DownloadNotificationRecord): SlackWebhookPayload {
  const version = slackValue(record.version)
  const asset = slackValue(record.asset)
  const referrer = slackValue(record.referrer_host, 'direct/unknown')
  const country = slackValue(record.country)

  return {
    text: `New PopDict download: ${asset}`,
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: '*New PopDict download*' } },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Version*\n${version}` },
          { type: 'mrkdwn', text: `*Asset*\n${asset}` },
          { type: 'mrkdwn', text: `*Referrer*\n${referrer}` },
          { type: 'mrkdwn', text: `*Country*\n${country}` },
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

// Sum a snapshot's per-asset counts into a lifetime total + byAsset map.
export function sumSnapshot(
  rows: { asset: string; download_count: number }[],
): { total: number; byAsset: Record<string, number> } {
  const byAsset: Record<string, number> = {}
  let total = 0
  for (const row of rows) {
    byAsset[row.asset] = (byAsset[row.asset] ?? 0) + row.download_count
    total += row.download_count
  }
  return { total, byAsset }
}

// Cumulative daily series across the union of all dates in either source.
// GitHub carries its last snapshot total forward on days without a snapshot
// (monotonic, robust to a missed cron). Website is a running cumulative count.
export function buildTimeseries(
  githubDaily: { date: string; total: number }[],
  websiteDaily: { date: string; count: number }[],
): DayPoint[] {
  const dates = Array.from(
    new Set([...githubDaily.map((d) => d.date), ...websiteDaily.map((d) => d.date)]),
  ).sort()
  const ghByDate = new Map(githubDaily.map((d) => [d.date, d.total]))
  const webByDate = new Map(websiteDaily.map((d) => [d.date, d.count]))

  const series: DayPoint[] = []
  let ghCarry = 0
  let webCumulative = 0
  for (const date of dates) {
    const gh = ghByDate.get(date)
    if (gh !== undefined) ghCarry = gh
    webCumulative += webByDate.get(date) ?? 0
    series.push({ date, github: ghCarry, website: webCumulative, combined: ghCarry + webCumulative })
  }
  return series
}
