import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  dailySeries,
  fetchDashboardData,
  isAuthorizedDashboard,
  renderDashboardPage,
  type DownloadDashboardData,
} from './statsPage'

function basic(user: string, password: string): string {
  return `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`
}

describe('isAuthorizedDashboard', () => {
  it('accepts matching basic auth credentials', () => {
    const headers = new Headers({ authorization: basic('admin', 'secret') })
    expect(isAuthorizedDashboard(headers, 'admin', 'secret')).toBe(true)
  })

  it('rejects missing config and wrong credentials', () => {
    expect(isAuthorizedDashboard(new Headers({ authorization: basic('admin', 'secret') }), undefined, 'secret')).toBe(false)
    expect(isAuthorizedDashboard(new Headers({ authorization: basic('admin', 'wrong') }), 'admin', 'secret')).toBe(false)
    expect(isAuthorizedDashboard(new Headers(), 'admin', 'secret')).toBe(false)
  })
})

describe('fetchDashboardData', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.DOWNLOADS_FN_URL
    delete process.env.DOWNLOADS_STATS_TOKEN
  })

  it('loads stats and timeseries with the bearer stats token', async () => {
    process.env.DOWNLOADS_FN_URL = 'https://fn.example/downloads'
    process.env.DOWNLOADS_STATS_TOKEN = 'admin-token'
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ github: { dmg: 1, zip: 0, other: 0, byAsset: {}, asOf: '2026-07-02' }, redirects: { total: 0 } }))
      .mockResolvedValueOnce(Response.json([{ date: '2026-07-02', dmg: 1, redirects: 0 }]))
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchDashboardData()).resolves.toEqual({
      stats: { github: { dmg: 1, zip: 0, other: 0, byAsset: {}, asOf: '2026-07-02' }, redirects: { total: 0 } },
      timeseries: [{ date: '2026-07-02', dmg: 1, redirects: 0 }],
    })
    expect(fetchMock).toHaveBeenCalledWith('https://fn.example/downloads?stats', expect.objectContaining({
      headers: expect.objectContaining({ authorization: 'Bearer admin-token' }),
      cache: 'no-store',
    }))
    expect(fetchMock).toHaveBeenCalledWith('https://fn.example/downloads?timeseries', expect.objectContaining({
      headers: expect.objectContaining({ authorization: 'Bearer admin-token' }),
      cache: 'no-store',
    }))
  })
})

describe('renderDashboardPage', () => {
  it('escapes asset names before rendering html', () => {
    const data: DownloadDashboardData = {
      stats: {
        github: { dmg: 1, zip: 0, other: 0, byAsset: { '<script>alert(1)</script>.dmg': 1 }, asOf: '2026-07-02' },
        redirects: { total: 1 },
      },
      timeseries: [{ date: '2026-07-02', dmg: 1, redirects: 1 }],
    }

    const html = renderDashboardPage(data, new Date('2026-07-02T00:00:00Z'))
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;.dmg')
    expect(html).not.toContain('<script>alert(1)</script>.dmg')
  })

  it('renders an inline download curve and last-7-days deltas', () => {
    const data: DownloadDashboardData = {
      stats: {
        github: { dmg: 30, zip: 7, other: 0, byAsset: { 'PopDict.dmg': 30 }, asOf: '2026-07-03' },
        redirects: { total: 4 },
      },
      timeseries: [
        { date: '2026-07-03', dmg: 30, redirects: 4 },
        { date: '2026-06-24', dmg: 5, redirects: 0 },
        { date: '2026-07-01', dmg: 25, redirects: 2 },
      ],
    }

    const html = renderDashboardPage(data, new Date('2026-07-03T00:00:00Z'))

    expect(html).toContain('Download Curve')
    expect(html).toContain('aria-label="Daily cumulative download funnel"')
    expect(html).toContain('Last 7 days through 2026-07-03')
    expect(html).toContain('<div class="delta-value">+25</div>')
    expect(html).toContain('<div class="delta-value">+4</div>')
    expect(html).toContain('2026-06-24')
    expect(html).toContain('2026-07-03')
  })

  it('renders a chart empty state without daily snapshots', () => {
    const data: DownloadDashboardData = {
      stats: {
        github: { dmg: 0, zip: 0, other: 0, byAsset: {}, asOf: null },
        redirects: { total: 0 },
      },
      timeseries: [],
    }

    const html = renderDashboardPage(data, new Date('2026-07-03T00:00:00Z'))

    expect(html).toContain('No daily download data yet.')
    expect(html).not.toContain('aria-label="Daily cumulative download funnel"')
  })
})

describe('dailySeries', () => {
  it('keeps first-day redirects while treating the first DMG snapshot as a baseline', () => {
    expect(dailySeries([
      { date: '2026-07-03', dmg: 47, redirects: 8 },
      { date: '2026-07-02', dmg: 40, redirects: 5 },
      { date: '2026-07-04', dmg: 50, redirects: 10 },
    ])).toEqual([
      { date: '2026-07-02', dmg: 0, redirects: 5 },
      { date: '2026-07-03', dmg: 7, redirects: 3 },
      { date: '2026-07-04', dmg: 3, redirects: 2 },
    ])
  })

  it('returns the known redirect delta for a single first point', () => {
    expect(dailySeries([{ date: '2026-07-02', dmg: 40, redirects: 5 }])).toEqual([
      { date: '2026-07-02', dmg: 0, redirects: 5 },
    ])
    expect(dailySeries([])).toEqual([])
  })

  it('clamps each stage independently when a counter is corrected downward', () => {
    expect(dailySeries([
      { date: '2026-07-02', dmg: 40, redirects: 5 },
      { date: '2026-07-03', dmg: 38, redirects: 8 },
    ])).toEqual([
      { date: '2026-07-02', dmg: 0, redirects: 5 },
      { date: '2026-07-03', dmg: 0, redirects: 3 },
    ])
  })
})

describe('renderDashboardPage chart toggle', () => {
  const data: DownloadDashboardData = {
    stats: {
      github: { dmg: 50, zip: 12, other: 0, byAsset: { 'PopDict.dmg': 50 }, asOf: '2026-07-04' },
      redirects: { total: 10 },
    },
    timeseries: [
      { date: '2026-07-02', dmg: 40, redirects: 5 },
      { date: '2026-07-03', dmg: 47, redirects: 8 },
      { date: '2026-07-04', dmg: 50, redirects: 10 },
    ],
  }

  it('renders both chart views behind a css radio toggle', () => {
    const html = renderDashboardPage(data, new Date('2026-07-04T00:00:00Z'))
    expect(html).toContain('id="view-cumulative"')
    expect(html).toContain('id="view-daily"')
    expect(html).toContain('aria-label="Daily cumulative download funnel"')
    expect(html).toContain('aria-label="Daily new downloads"')
    expect(html).toContain('Daily funnel movement from 2026-07-02')
    expect(html).not.toContain('<script')
  })

  it('shows first-day redirects even with a single cumulative point', () => {
    const single: DownloadDashboardData = {
      ...data,
      timeseries: [{ date: '2026-07-02', dmg: 40, redirects: 5 }],
    }
    const html = renderDashboardPage(single, new Date('2026-07-04T00:00:00Z'))
    expect(html).toContain('Daily funnel movement from 2026-07-02')
    expect(html).toContain('aria-label="Daily new downloads"')
  })

  it('keeps the radios before the chart head and views so :checked ~ selectors reach them', () => {
    const html = renderDashboardPage(data, new Date('2026-07-04T00:00:00Z'))
    expect(html).toMatch(
      /id="view-cumulative"[\s\S]*id="view-daily"[\s\S]*class="chart-head"[\s\S]*class="chart-view chart-view-cumulative"[\s\S]*class="chart-view chart-view-daily"/,
    )
  })

  it('centers the date tick under a single daily bar', () => {
    const oneDay: DownloadDashboardData = {
      ...data,
      timeseries: [
        { date: '2026-07-02', dmg: 40, redirects: 5 },
      ],
    }
    const html = renderDashboardPage(oneDay, new Date('2026-07-03T00:00:00Z'))
    const daily = html.slice(html.indexOf('aria-label="Daily new downloads"'))
    expect(daily.slice(0, daily.indexOf('</svg>'))).toContain('text-anchor="middle"')
  })
})

describe('renderDashboardPage countries', () => {
  const base: DownloadDashboardData = {
    stats: {
      github: { dmg: 42, zip: 9, other: 0, byAsset: { 'PopDict.dmg': 42 }, asOf: '2026-07-04' },
      redirects: {
        total: 18,
        byCountry: { KR: 11, US: 6, unknown: 1 },
        bySource: { website: 13, github: 5 },
        byCta: { hero: 10, readme: 5, nav: 3 },
      },
    },
    timeseries: [
      { date: '2026-07-03', dmg: 40, redirects: 15 },
      { date: '2026-07-04', dmg: 42, redirects: 18 },
    ],
  }

  it('renders a shaded map with tooltips and a ranked list', () => {
    const html = renderDashboardPage(base, new Date('2026-07-04T00:00:00Z'))
    expect(html).toContain('aria-label="Website redirects by country"')
    expect(html).toContain('Website redirects, all time — GitHub does not report geography.')
    expect(html).toContain('<title>South Korea: 11</title>')
    expect(html).toContain('fill="#d9862f"')
    expect(html).toContain('🇰🇷')
    expect(html).toContain('<div class="country-name">Unknown</div>')
  })

  it('escapes hostile country codes from the api', () => {
    const hostile: DownloadDashboardData = {
      ...base,
      stats: { ...base.stats, redirects: { total: 1, byCountry: { '<img src=x>': 1 } } },
    }
    const html = renderDashboardPage(hostile, new Date('2026-07-04T00:00:00Z'))
    expect(html).toContain('&lt;img src=x&gt;')
    expect(html).not.toContain('<img src=x>')
  })

  it('renders the countries empty state when byCountry is absent or empty', () => {
    const absent: DownloadDashboardData = {
      ...base,
      stats: { ...base.stats, redirects: { total: 18 } },
    }
    const html = renderDashboardPage(absent, new Date('2026-07-04T00:00:00Z'))
    expect(html).toContain('No country data yet.')
    expect(html).not.toContain('aria-label="Website redirects by country"')

    const empty: DownloadDashboardData = {
      ...base,
      stats: { ...base.stats, redirects: { total: 18, byCountry: {} } },
    }
    const emptyHtml = renderDashboardPage(empty, new Date('2026-07-04T00:00:00Z'))
    expect(emptyHtml).toContain('No country data yet.')
    expect(emptyHtml).not.toContain('aria-label="Website redirects by country"')
  })

  it('renders source and CTA attribution without calling redirects installs', () => {
    const html = renderDashboardPage(base, new Date('2026-07-04T00:00:00Z'))
    expect(html).toContain('Redirect attribution')
    expect(html).toContain('These are download intents, not additional installs.')
    expect(html).toContain('<td>github</td><td class="num">5</td>')
    expect(html).toContain('<td>hero</td><td class="num">10</td>')
  })
})
