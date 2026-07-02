import { timingSafeEqual } from 'node:crypto'

export type DownloadStats = {
  combined: number
  github: {
    total: number
    byAsset: Record<string, number>
    asOf: string | null
  }
  website: {
    total: number
  }
}

export type DownloadDayPoint = {
  date: string
  github: number
  website: number
  combined: number
}

export type DownloadDashboardData = {
  stats: DownloadStats
  timeseries: DownloadDayPoint[]
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
  const assets = Object.entries(stats.github.byAsset)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const maxCombined = Math.max(1, ...timeseries.map((point) => point.combined))

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
    @media (max-width: 720px) {
      header { align-items: flex-start; flex-direction: column; }
      .actions { justify-content: flex-start; }
      .grid { grid-template-columns: 1fr; }
      th.optional, td.optional { display: none; }
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
      ${metric('Combined', stats.combined)}
      ${metric('GitHub', stats.github.total)}
      ${metric('Website', stats.website.total)}
    </section>

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
            <th class="num optional">GitHub</th>
            <th class="num optional">Website</th>
            <th class="num">Combined</th>
            <th>Trend</th>
          </tr>
        </thead>
        <tbody>
          ${timeseries.map((point) => dayRow(point, maxCombined)).join('')}
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

function dayRow(point: DownloadDayPoint, maxCombined: number): string {
  const width = Math.max(2, Math.round((point.combined / maxCombined) * 100))
  return `<tr>
    <td>${escapeHtml(point.date)}</td>
    <td class="num optional">${formatNumber(point.github)}</td>
    <td class="num optional">${formatNumber(point.website)}</td>
    <td class="num">${formatNumber(point.combined)}</td>
    <td><div class="bar-track" aria-label="${formatNumber(point.combined)} combined downloads"><div class="bar" style="width:${width}%"></div></div></td>
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
