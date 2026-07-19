import { timingSafeEqual } from 'node:crypto'
import { countryDisplayName, countryShade, rankCountries, type CountryRow } from './countries'
import { WORLD_MAP_PATHS, WORLD_MAP_VIEWBOX } from './worldMapPaths'

export type DownloadStats = {
  github: {
    dmg: number
    zip: number
    other: number
    byAsset: Record<string, number>
    asOf: string | null
  }
  redirects: {
    total: number
    byCountry?: Record<string, number>
    bySource?: Record<string, number>
    byCta?: Record<string, number>
  }
}

export type DownloadDayPoint = {
  date: string
  dmg: number
  redirects: number
}

export type DownloadDashboardData = {
  stats: DownloadStats
  timeseries: DownloadDayPoint[]
}

export type DailyPoint = {
  date: string
  dmg: number
  redirects: number
}

// Per-day funnel movement from cumulative points. GitHub's first snapshot is
// a lifetime baseline, so its first DMG delta is zero. Redirect tracking starts
// at zero, making the first cumulative redirect value a real first-day delta.
export function dailySeries(points: DownloadDayPoint[]): DailyPoint[] {
  const ordered = [...points].sort((a, b) => a.date.localeCompare(b.date))
  return ordered.map((point, index) => {
    if (index === 0) {
      return { date: point.date, dmg: 0, redirects: Math.max(0, point.redirects) }
    }
    const prev = ordered[index - 1]
    const dmg = Math.max(0, point.dmg - prev.dmg)
    const redirects = Math.max(0, point.redirects - prev.redirects)
    return { date: point.date, dmg, redirects }
  })
}

export function isAuthorizedDashboard(
  headers: Headers,
  expectedUser: string | undefined,
  expectedPassword: string | undefined,
): boolean {
  if (!expectedUser || !expectedPassword) return false

  const header = headers.get('authorization')
  if (!header?.startsWith('Basic ')) return false

  let decoded = ''
  try {
    decoded = Buffer.from(header.slice('Basic '.length), 'base64').toString('utf8')
  } catch {
    return false
  }

  const separator = decoded.indexOf(':')
  if (separator < 0) return false

  const user = decoded.slice(0, separator)
  const password = decoded.slice(separator + 1)
  return safeEqual(user, expectedUser) && safeEqual(password, expectedPassword)
}

export async function fetchDashboardData(): Promise<DownloadDashboardData> {
  const url = process.env.DOWNLOADS_FN_URL
  const token = process.env.DOWNLOADS_STATS_TOKEN
  if (!url || !token) throw new Error('download stats are not configured')

  const headers = {
    accept: 'application/json',
    authorization: `Bearer ${token}`,
  }
  const [statsRes, timeseriesRes] = await Promise.all([
    fetch(`${url}?stats`, { headers, cache: 'no-store' }),
    fetch(`${url}?timeseries`, { headers, cache: 'no-store' }),
  ])

  if (!statsRes.ok) throw new Error(`stats request failed: ${statsRes.status}`)
  if (!timeseriesRes.ok) throw new Error(`timeseries request failed: ${timeseriesRes.status}`)

  return {
    stats: (await statsRes.json()) as DownloadStats,
    timeseries: (await timeseriesRes.json()) as DownloadDayPoint[],
  }
}

export function renderDashboardPage(data: DownloadDashboardData, generatedAt = new Date()): string {
  const { stats, timeseries } = data
  const orderedTimeseries = [...timeseries].sort((a, b) => a.date.localeCompare(b.date))
  const assets = Object.entries(stats.github.byAsset)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const maxDmg = Math.max(1, ...orderedTimeseries.map((point) => point.dmg))
  const recent = downloadDelta(orderedTimeseries, 7)
  const daily = dailySeries(orderedTimeseries)

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>PopDict Download Stats</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #201f24;
      --muted: #64616d;
      --line: #e5e0d8;
      --paper: #fbfaf7;
      --panel: #ffffff;
      --accent: #d9862f;
      --accent-soft: #ffe5c4;
      --charcoal: #303036;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--paper);
      color: var(--ink);
      font: 15px/1.5 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    main {
      width: min(980px, calc(100vw - 32px));
      margin: 32px auto 48px;
    }
    header {
      display: flex;
      justify-content: space-between;
      gap: 20px;
      align-items: flex-end;
      border-bottom: 1px solid var(--line);
      padding-bottom: 18px;
    }
    h1 {
      margin: 0;
      font-size: 28px;
      line-height: 1.1;
      letter-spacing: 0;
    }
    h2 {
      margin: 30px 0 12px;
      font-size: 17px;
      letter-spacing: 0;
    }
    .muted { color: var(--muted); }
    .small { font-size: 13px; }
    .grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      margin-top: 20px;
    }
    .metric, table {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
    }
    .metric {
      padding: 16px;
    }
    .chart-panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 16px;
      overflow: hidden;
    }
    .chart-head {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 10px;
    }
    .chart-head h2 {
      margin: 0 0 3px;
    }
    .legend {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      justify-content: flex-end;
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: .02em;
      text-transform: uppercase;
    }
    .legend-item {
      display: inline-flex;
      gap: 6px;
      align-items: center;
      white-space: nowrap;
    }
    .legend-swatch {
      width: 18px;
      height: 3px;
      border-radius: 999px;
      background: var(--swatch);
    }
    .chart {
      display: block;
      width: 100%;
      height: auto;
      min-height: 220px;
    }
    .axis-label {
      fill: var(--muted);
      font: 12px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .empty-chart {
      display: grid;
      min-height: 220px;
      place-items: center;
      color: var(--muted);
      border: 1px dashed var(--line);
      border-radius: 8px;
    }
    .delta-strip {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      margin-top: 14px;
      border-top: 1px solid var(--line);
    }
    .delta-item {
      padding: 13px 14px 0 0;
      min-width: 0;
    }
    .delta-value {
      margin-top: 3px;
      color: var(--charcoal);
      font-size: 22px;
      line-height: 1;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
    }
    .label {
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: .04em;
      text-transform: uppercase;
    }
    .value {
      margin-top: 6px;
      font-size: 34px;
      line-height: 1;
      font-weight: 800;
      color: var(--charcoal);
    }
    table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      overflow: hidden;
    }
    th, td {
      padding: 10px 12px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      vertical-align: middle;
    }
    th {
      background: #f4f0ea;
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: .04em;
    }
    tr:last-child td { border-bottom: 0; }
    td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
    .bar-track {
      min-width: 120px;
      height: 8px;
      border-radius: 999px;
      background: #eee8df;
      overflow: hidden;
    }
    .bar {
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, var(--accent), var(--accent-soft));
    }
    .actions {
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    a.button {
      color: var(--ink);
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 8px 10px;
      text-decoration: none;
      font-weight: 700;
      font-size: 13px;
    }
    .chart-toggle {
      position: absolute;
      opacity: 0;
      pointer-events: none;
    }
    .chart-actions-col {
      display: flex;
      flex-direction: column;
      gap: 10px;
      align-items: flex-end;
    }
    .chart-switch {
      display: inline-flex;
      border: 1px solid var(--line);
      border-radius: 8px;
      overflow: hidden;
    }
    .chart-switch label {
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: .02em;
      text-transform: uppercase;
      color: var(--muted);
      cursor: pointer;
    }
    .chart-switch label + label { border-left: 1px solid var(--line); }
    .chart-view-daily, .view-sub-daily { display: none; }
    #view-daily:checked ~ .chart-view-daily { display: block; }
    #view-daily:checked ~ .chart-view-cumulative { display: none; }
    #view-daily:checked ~ .chart-head .view-sub-daily { display: block; }
    #view-daily:checked ~ .chart-head .view-sub-cumulative { display: none; }
    #view-cumulative:checked ~ .chart-head .chart-switch label[for="view-cumulative"],
    #view-daily:checked ~ .chart-head .chart-switch label[for="view-daily"] {
      background: var(--accent-soft);
      color: var(--ink);
    }
    .countries-card {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 250px;
      gap: 18px;
      align-items: center;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 16px;
      margin-top: 12px;
    }
    .world-map { display: block; width: 100%; height: auto; }
    .country-list {
      align-self: stretch;
      border-left: 1px solid var(--line);
      padding-left: 18px;
      max-height: 400px;
      overflow-y: auto;
    }
    .country-row {
      display: flex;
      gap: 10px;
      align-items: center;
      padding: 9px 0;
      border-bottom: 1px solid var(--line);
    }
    .country-row:last-child { border-bottom: 0; }
    .country-flag { font-size: 18px; line-height: 1; }
    .country-main { flex: 1; min-width: 0; }
    .country-name {
      font-size: 13px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .country-row .bar-track { min-width: 0; margin-top: 4px; height: 6px; }
    .country-count { font-weight: 700; font-variant-numeric: tabular-nums; }
    .breakdown-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin-top: 12px;
    }
    .breakdown-grid h3 { margin: 0 0 8px; font-size: 14px; }
    @media (max-width: 720px) {
      header { align-items: flex-start; flex-direction: column; }
      .actions { justify-content: flex-start; }
      .grid { grid-template-columns: 1fr; }
      .chart-head { align-items: flex-start; flex-direction: column; }
      .chart-actions-col { align-items: flex-start; }
      .legend { justify-content: flex-start; }
      .delta-strip { grid-template-columns: 1fr; gap: 10px; }
      th.optional, td.optional { display: none; }
      .countries-card { grid-template-columns: 1fr; }
      .country-list { border-left: 0; padding-left: 0; }
      .breakdown-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>Download Stats</h1>
        <div class="muted small">Generated ${escapeHtml(generatedAt.toISOString())}</div>
      </div>
      <div class="actions">
        <span class="muted small">GitHub snapshot: ${escapeHtml(stats.github.asOf ?? 'none')}</span>
        <a class="button" href="/admin/downloads">Refresh</a>
      </div>
    </header>

    <section class="grid" aria-label="Summary">
      ${metric('DMG deliveries', stats.github.dmg)}
      ${metric('Website redirects', stats.redirects.total)}
      ${metric('Updater ZIP deliveries', stats.github.zip)}
    </section>

    <section>
      <div class="chart-panel">
        <input type="radio" name="chart-view" id="view-cumulative" class="chart-toggle" checked>
        <input type="radio" name="chart-view" id="view-daily" class="chart-toggle">
        <div class="chart-head">
          <div>
            <h2>Download Curve</h2>
            <div class="muted small view-sub view-sub-cumulative">${recent ? `Last 7 days through ${escapeHtml(recent.to)}` : 'No daily snapshots yet'}</div>
            <div class="muted small view-sub view-sub-daily">${daily.length > 0 ? `Daily funnel movement from ${escapeHtml(daily[0].date)} (the first GitHub DMG snapshot is a baseline)` : 'No daily data yet.'}</div>
          </div>
          <div class="chart-actions-col">
            <div class="chart-switch" aria-label="Chart view">
              <label for="view-cumulative">Cumulative</label>
              <label for="view-daily">Daily</label>
            </div>
            <div class="legend" aria-label="Chart legend">
              ${legendItem('GitHub DMG', '#d9862f')}
              ${legendItem('Website redirects', '#303036')}
            </div>
          </div>
        </div>
        <div class="chart-view chart-view-cumulative">${renderDownloadCurve(orderedTimeseries)}</div>
        <div class="chart-view chart-view-daily">${renderDailyBars(daily)}</div>
        ${recent ? renderDeltaStrip(recent) : ''}
      </div>
    </section>

    ${renderAttributionSection(stats.redirects.bySource, stats.redirects.byCta)}

    ${renderCountriesSection(stats.redirects.byCountry)}

    <section>
      <h2>Assets</h2>
      <table>
        <thead><tr><th>Asset</th><th class="num">Downloads</th></tr></thead>
        <tbody>
          ${assets.map(([name, count]) => `<tr><td>${escapeHtml(name)}</td><td class="num">${formatNumber(count)}</td></tr>`).join('')}
        </tbody>
      </table>
    </section>

    <section>
      <h2>Daily Cumulative</h2>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th class="num optional">GitHub DMG</th>
            <th class="num">Website redirects</th>
            <th>DMG trend</th>
          </tr>
        </thead>
        <tbody>
          ${orderedTimeseries.map((point) => dayRow(point, maxDmg)).join('')}
        </tbody>
      </table>
    </section>
  </main>
</body>
</html>`
}

export function renderErrorPage(message: string, status: number): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>PopDict Download Stats</title>
</head>
<body>
  <main style="max-width:720px;margin:40px auto;font:15px system-ui,sans-serif">
    <h1>Download stats unavailable</h1>
    <p>Status ${status}: ${escapeHtml(message)}</p>
  </main>
</body>
</html>`
}

function metric(label: string, value: number): string {
  return `<div class="metric"><div class="label">${escapeHtml(label)}</div><div class="value">${formatNumber(value)}</div></div>`
}

function legendItem(label: string, color: string): string {
  return `<span class="legend-item"><span class="legend-swatch" style="--swatch:${color}"></span>${escapeHtml(label)}</span>`
}

type DownloadDelta = {
  dmg: number
  redirects: number
  to: string
}

function downloadDelta(points: DownloadDayPoint[], days: number): DownloadDelta | null {
  if (points.length === 0) return null

  const latest = points[points.length - 1]
  const latestTime = dayTime(latest.date)
  const cutoff = Number.isFinite(latestTime) ? latestTime - (days - 1) * 24 * 60 * 60 * 1000 : null
  let baseline: DownloadDayPoint | null = null

  if (cutoff !== null) {
    for (const point of points) {
      const pointTime = dayTime(point.date)
      if (Number.isFinite(pointTime) && pointTime < cutoff) baseline = point
    }
  }

  return {
    dmg: Math.max(0, latest.dmg - (baseline?.dmg ?? 0)),
    redirects: Math.max(0, latest.redirects - (baseline?.redirects ?? 0)),
    to: latest.date,
  }
}

function renderDeltaStrip(delta: DownloadDelta): string {
  return `<div class="delta-strip" aria-label="Last 7 days download changes">
    ${deltaItem('GitHub DMG', delta.dmg)}
    ${deltaItem('Website redirects', delta.redirects)}
  </div>`
}

function deltaItem(label: string, value: number): string {
  return `<div class="delta-item"><div class="label">${escapeHtml(label)} / 7 days</div><div class="delta-value">${formatDelta(value)}</div></div>`
}

function renderCountriesSection(byCountry: Record<string, number> | undefined): string {
  const rows = rankCountries(byCountry ?? {})
  const body = rows.length === 0
    ? '<div class="empty-chart">No country data yet.</div>'
    : `<div class="countries-card">
        ${renderWorldMap(rows)}
        <div class="country-list">${rows.map((row) => countryRowHtml(row, maxCountryCount(rows))).join('')}</div>
      </div>`
  return `<section>
      <h2>Countries</h2>
      <div class="muted small">Website redirects, all time — GitHub does not report geography.</div>
      ${body}
    </section>`
}

function renderAttributionSection(
  bySource: Record<string, number> | undefined,
  byCta: Record<string, number> | undefined,
): string {
  return `<section>
    <h2>Redirect attribution</h2>
    <div class="muted small">Where visitors initiated the website redirect. These are download intents, not additional installs.</div>
    <div class="breakdown-grid">
      ${renderBreakdownTable('Source', bySource)}
      ${renderBreakdownTable('CTA', byCta)}
    </div>
  </section>`
}

function renderBreakdownTable(label: string, values: Record<string, number> | undefined): string {
  const rows = Object.entries(values ?? {}).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const body = rows.length === 0
    ? '<tr><td colspan="2" class="muted">No attributed redirects yet.</td></tr>'
    : rows.map(([name, count]) => `<tr><td>${escapeHtml(name)}</td><td class="num">${formatNumber(count)}</td></tr>`).join('')
  return `<div><h3>${escapeHtml(label)}</h3><table><thead><tr><th>${escapeHtml(label)}</th><th class="num">Redirects</th></tr></thead><tbody>${body}</tbody></table></div>`
}

// Max over real countries only: 'unknown' has no geography and must not
// flatten the map's shading scale.
function maxCountryCount(rows: CountryRow[]): number {
  return Math.max(1, ...rows.filter((row) => row.code !== 'unknown').map((row) => row.count))
}

function renderWorldMap(rows: CountryRow[]): string {
  const max = maxCountryCount(rows)
  const byCode = new Map(rows.map((row) => [row.code, row]))
  const paths = Object.entries(WORLD_MAP_PATHS).map(([code, d]) => {
    const row = byCode.get(code)
    const fill = row ? countryShade(row.count, max) : '#eee8df'
    const tooltip = code.startsWith('_')
      ? ''
      : `<title>${escapeHtml(row ? `${row.name}: ${row.count}` : countryDisplayName(code))}</title>`
    return `<path d="${d}" fill="${fill}" stroke="#ffffff" stroke-width="0.5">${tooltip}</path>`
  }).join('')
  return `<svg class="world-map" viewBox="${WORLD_MAP_VIEWBOX}" role="img" aria-label="Website redirects by country">${paths}</svg>`
}

function countryRowHtml(row: CountryRow, max: number): string {
  const width = Math.min(100, Math.max(2, Math.round((row.count / max) * 100)))
  return `<div class="country-row">
    <span class="country-flag">${row.flag}</span>
    <div class="country-main">
      <div class="country-name">${escapeHtml(row.name)}</div>
      <div class="bar-track"><div class="bar" style="width:${width}%"></div></div>
    </div>
    <span class="country-count">${formatNumber(row.count)}</span>
  </div>`
}

function renderDownloadCurve(points: DownloadDayPoint[]): string {
  if (points.length === 0) {
    return '<div class="empty-chart">No daily download data yet.</div>'
  }

  const width = 760
  const height = 260
  const left = 54
  const right = 22
  const top = 20
  const bottom = 42
  const plotWidth = width - left - right
  const plotHeight = height - top - bottom
  const maxValue = Math.max(1, ...points.flatMap((point) => [point.dmg, point.redirects]))
  const yBase = top + plotHeight
  const dmg = chartPoints(points, 'dmg', left, top, plotWidth, plotHeight, maxValue)
  const redirects = chartPoints(points, 'redirects', left, top, plotWidth, plotHeight, maxValue)
  const grid = gridLines(maxValue, left, top, plotWidth, plotHeight)
  const ticks = axisTicks(points, left, yBase, plotWidth)
  const lastDmg = dmg[dmg.length - 1]
  const lastRedirect = redirects[redirects.length - 1]

  return `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Daily cumulative download funnel">
    <rect x="0" y="0" width="${width}" height="${height}" fill="#fff" rx="8" />
    ${grid}
    ${polyline(dmg, '#d9862f', 3.5)}
    ${polyline(redirects, '#303036', 2.5)}
    <circle cx="${lastDmg.x}" cy="${lastDmg.y}" r="4.5" fill="#d9862f" />
    <circle cx="${lastRedirect.x}" cy="${lastRedirect.y}" r="3.5" fill="#303036" />
    ${ticks}
  </svg>`
}

// Paired bars preserve the funnel distinction. A website redirect that ends in
// a GitHub DMG delivery may appear in both stages and must not be stacked.
function renderDailyBars(points: DailyPoint[]): string {
  if (points.length === 0) {
    return '<div class="empty-chart">No daily data yet.</div>'
  }

  const width = 760
  const height = 260
  const left = 54
  const right = 22
  const top = 20
  const bottom = 42
  const plotWidth = width - left - right
  const plotHeight = height - top - bottom
  const maxValue = Math.max(1, ...points.flatMap((point) => [point.dmg, point.redirects]))
  const yBase = top + plotHeight
  const slot = plotWidth / points.length
  const barWidth = round(Math.min(28, slot * 0.3))

  const bars = points.map((point, index) => {
    const center = left + slot * (index + 0.5)
    const dmgX = round(center - barWidth - 1)
    const redirectX = round(center + 1)
    const dmgHeight = round((point.dmg / maxValue) * plotHeight)
    const redirectHeight = round((point.redirects / maxValue) * plotHeight)
    return `<g>
      <rect x="${dmgX}" y="${round(yBase - dmgHeight)}" width="${barWidth}" height="${dmgHeight}" fill="#d9862f" />
      <rect x="${redirectX}" y="${round(yBase - redirectHeight)}" width="${barWidth}" height="${redirectHeight}" fill="#303036" />
      <title>${escapeHtml(point.date)}: GitHub DMG +${formatNumber(point.dmg)}, website redirects +${formatNumber(point.redirects)}</title>
    </g>`
  }).join('')

  return `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Daily new downloads">
    <rect x="0" y="0" width="${width}" height="${height}" fill="#fff" rx="8" />
    ${gridLines(maxValue, left, top, plotWidth, plotHeight)}
    ${bars}
    ${dailyAxisTicks(points, left, yBase, slot)}
  </svg>`
}

// Categorical ticks centered under their bars (the shared axisTicks spreads
// labels across the plot width, which strands a single bar's date at the
// right edge).
function dailyAxisTicks(points: DailyPoint[], left: number, y: number, slot: number): string {
  const indices = points.length === 1
    ? [0]
    : Array.from(new Set([0, Math.floor((points.length - 1) / 2), points.length - 1]))
  return indices.map((index) => {
    const x = round(left + slot * (index + 0.5))
    return `<text class="axis-label" x="${x}" y="${y + 26}" text-anchor="middle">${escapeHtml(points[index].date)}</text>`
  }).join('')
}

type ChartMetric = 'dmg' | 'redirects'

type ChartPoint = {
  x: number
  y: number
}

function chartPoints(
  points: DownloadDayPoint[],
  metric: ChartMetric,
  left: number,
  top: number,
  plotWidth: number,
  plotHeight: number,
  maxValue: number,
): ChartPoint[] {
  return points.map((point, index) => {
    const x = points.length === 1 ? left + plotWidth : left + (index / (points.length - 1)) * plotWidth
    const y = top + plotHeight - (point[metric] / maxValue) * plotHeight
    return { x: round(x), y: round(y) }
  })
}

function gridLines(maxValue: number, left: number, top: number, plotWidth: number, plotHeight: number): string {
  return [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const y = round(top + plotHeight - ratio * plotHeight)
    const label = formatNumber(Math.round(maxValue * ratio))
    return `<g>
      <line x1="${left}" y1="${y}" x2="${left + plotWidth}" y2="${y}" stroke="#eee8df" stroke-width="1" />
      <text class="axis-label" x="${left - 10}" y="${y + 4}" text-anchor="end">${label}</text>
    </g>`
  }).join('')
}

function axisTicks(points: { date: string }[], left: number, y: number, plotWidth: number): string {
  const indices = points.length === 1
    ? [0]
    : Array.from(new Set([0, Math.floor((points.length - 1) / 2), points.length - 1]))

  return indices.map((index) => {
    const x = points.length === 1 ? left + plotWidth : round(left + (index / (points.length - 1)) * plotWidth)
    return `<text class="axis-label" x="${x}" y="${y + 26}" text-anchor="${index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}">${escapeHtml(points[index].date)}</text>`
  }).join('')
}

function polyline(points: ChartPoint[], color: string, width: number): string {
  return `<polyline points="${points.map((point) => `${point.x},${point.y}`).join(' ')}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" />`
}

function dayRow(point: DownloadDayPoint, maxDmg: number): string {
  const width = Math.max(2, Math.round((point.dmg / maxDmg) * 100))
  return `<tr>
    <td>${escapeHtml(point.date)}</td>
    <td class="num optional">${formatNumber(point.dmg)}</td>
    <td class="num">${formatNumber(point.redirects)}</td>
    <td><div class="bar-track" aria-label="${formatNumber(point.dmg)} GitHub DMG deliveries"><div class="bar" style="width:${width}%"></div></div></td>
  </tr>`
}

function safeEqual(value: string, expected: string): boolean {
  const valueBuffer = Buffer.from(value)
  const expectedBuffer = Buffer.from(expected)
  if (valueBuffer.length !== expectedBuffer.length) return false
  return timingSafeEqual(valueBuffer, expectedBuffer)
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}

function formatDelta(value: number): string {
  return `+${formatNumber(value)}`
}

function dayTime(date: string): number {
  return Date.parse(`${date}T00:00:00Z`)
}

function round(value: number): number {
  return Math.round(value * 10) / 10
}
