import { afterEach, describe, expect, it, vi } from 'vitest'
import {
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
})
