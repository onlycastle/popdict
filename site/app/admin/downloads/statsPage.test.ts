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
      .mockResolvedValueOnce(Response.json({ combined: 1, github: { total: 1, byAsset: {}, asOf: '2026-07-02' }, website: { total: 0 } }))
      .mockResolvedValueOnce(Response.json([{ date: '2026-07-02', github: 1, website: 0, combined: 1 }]))
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchDashboardData()).resolves.toEqual({
      stats: { combined: 1, github: { total: 1, byAsset: {}, asOf: '2026-07-02' }, website: { total: 0 } },
      timeseries: [{ date: '2026-07-02', github: 1, website: 0, combined: 1 }],
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
        combined: 2,
        github: { total: 1, byAsset: { '<script>alert(1)</script>.dmg': 1 }, asOf: '2026-07-02' },
        website: { total: 1 },
      },
      timeseries: [{ date: '2026-07-02', github: 1, website: 1, combined: 2 }],
    }

    const html = renderDashboardPage(data, new Date('2026-07-02T00:00:00Z'))
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;.dmg')
    expect(html).not.toContain('<script>alert(1)</script>.dmg')
  })

  it('renders an inline download curve and last-7-days deltas', () => {
    const data: DownloadDashboardData = {
      stats: {
        combined: 34,
        github: { total: 30, byAsset: { 'PopDict.dmg': 30 }, asOf: '2026-07-03' },
        website: { total: 4 },
      },
      timeseries: [
        { date: '2026-07-03', github: 30, website: 4, combined: 34 },
        { date: '2026-06-24', github: 5, website: 0, combined: 5 },
        { date: '2026-07-01', github: 25, website: 2, combined: 27 },
      ],
    }

    const html = renderDashboardPage(data, new Date('2026-07-03T00:00:00Z'))

    expect(html).toContain('Download Curve')
    expect(html).toContain('aria-label="Daily cumulative download curve"')
    expect(html).toContain('Last 7 days through 2026-07-03')
    expect(html).toContain('<div class="delta-value">+29</div>')
    expect(html).toContain('2026-06-24')
    expect(html).toContain('2026-07-03')
  })

  it('renders a chart empty state without daily snapshots', () => {
    const data: DownloadDashboardData = {
      stats: {
        combined: 0,
        github: { total: 0, byAsset: {}, asOf: null },
        website: { total: 0 },
      },
      timeseries: [],
    }

    const html = renderDashboardPage(data, new Date('2026-07-03T00:00:00Z'))

    expect(html).toContain('No daily download data yet.')
    expect(html).not.toContain('aria-label="Daily cumulative download curve"')
  })
})

describe('dailySeries', () => {
  it('diffs consecutive cumulative points and drops the baseline day', () => {
    expect(dailySeries([
      { date: '2026-07-03', github: 47, website: 8, combined: 55 },
      { date: '2026-07-02', github: 40, website: 5, combined: 45 },
      { date: '2026-07-04', github: 50, website: 10, combined: 60 },
    ])).toEqual([
      { date: '2026-07-03', github: 7, website: 3, combined: 10 },
      { date: '2026-07-04', github: 3, website: 2, combined: 5 },
    ])
  })

  it('returns empty for fewer than two points', () => {
    expect(dailySeries([{ date: '2026-07-02', github: 40, website: 5, combined: 45 }])).toEqual([])
    expect(dailySeries([])).toEqual([])
  })

  it('derives combined from clamped parts when a counter is corrected downward', () => {
    expect(dailySeries([
      { date: '2026-07-02', github: 40, website: 5, combined: 45 },
      { date: '2026-07-03', github: 38, website: 8, combined: 46 },
    ])).toEqual([
      { date: '2026-07-03', github: 0, website: 3, combined: 3 },
    ])
  })
})

describe('renderDashboardPage chart toggle', () => {
  const data: DownloadDashboardData = {
    stats: {
      combined: 60,
      github: { total: 50, byAsset: { 'PopDict.dmg': 50 }, asOf: '2026-07-04' },
      website: { total: 10 },
    },
    timeseries: [
      { date: '2026-07-02', github: 40, website: 5, combined: 45 },
      { date: '2026-07-03', github: 47, website: 8, combined: 55 },
      { date: '2026-07-04', github: 50, website: 10, combined: 60 },
    ],
  }

  it('renders both chart views behind a css radio toggle', () => {
    const html = renderDashboardPage(data, new Date('2026-07-04T00:00:00Z'))
    expect(html).toContain('id="view-cumulative"')
    expect(html).toContain('id="view-daily"')
    expect(html).toContain('aria-label="Daily cumulative download curve"')
    expect(html).toContain('aria-label="Daily new downloads"')
    expect(html).toContain('Daily new downloads from 2026-07-03')
    expect(html).not.toContain('<script')
  })

  it('shows the daily empty state with fewer than two days', () => {
    const single: DownloadDashboardData = {
      ...data,
      timeseries: [{ date: '2026-07-02', github: 40, website: 5, combined: 45 }],
    }
    const html = renderDashboardPage(single, new Date('2026-07-04T00:00:00Z'))
    expect(html).toContain('Daily view needs at least two days of data.')
    expect(html).not.toContain('aria-label="Daily new downloads"')
  })
})

describe('renderDashboardPage countries', () => {
  const base: DownloadDashboardData = {
    stats: {
      combined: 60,
      github: { total: 42, byAsset: { 'PopDict.dmg': 42 }, asOf: '2026-07-04' },
      website: { total: 18, byCountry: { KR: 11, US: 6, unknown: 1 } },
    },
    timeseries: [
      { date: '2026-07-03', github: 40, website: 15, combined: 55 },
      { date: '2026-07-04', github: 42, website: 18, combined: 60 },
    ],
  }

  it('renders a shaded map with tooltips and a ranked list', () => {
    const html = renderDashboardPage(base, new Date('2026-07-04T00:00:00Z'))
    expect(html).toContain('aria-label="Website downloads by country"')
    expect(html).toContain('Website downloads, all time — GitHub does not report geography.')
    expect(html).toContain('<title>South Korea: 11</title>')
    expect(html).toContain('fill="#d9862f"')
    expect(html).toContain('🇰🇷')
    expect(html).toContain('<div class="country-name">Unknown</div>')
  })

  it('escapes hostile country codes from the api', () => {
    const hostile: DownloadDashboardData = {
      ...base,
      stats: { ...base.stats, website: { total: 1, byCountry: { '<img src=x>': 1 } } },
    }
    const html = renderDashboardPage(hostile, new Date('2026-07-04T00:00:00Z'))
    expect(html).toContain('&lt;img src=x&gt;')
    expect(html).not.toContain('<img src=x>')
  })

  it('renders the countries empty state when byCountry is absent or empty', () => {
    const absent: DownloadDashboardData = {
      ...base,
      stats: { ...base.stats, website: { total: 18 } },
    }
    const html = renderDashboardPage(absent, new Date('2026-07-04T00:00:00Z'))
    expect(html).toContain('No country data yet.')
    expect(html).not.toContain('aria-label="Website downloads by country"')
  })
})
