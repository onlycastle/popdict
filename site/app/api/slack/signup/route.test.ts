import { afterEach, describe, expect, it, vi } from 'vitest'
import { POST } from './route'

function signupRequest(
  payload: Record<string, unknown>,
  headers: Record<string, string> = {},
) {
  return new Request('https://popdict.space/api/slack/signup', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(payload),
  }) as Parameters<typeof POST>[0]
}

describe('POST /api/slack/signup', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.SLACK_SIGNUP_WEBHOOK_URL
  })

  it('posts a safe Slack signup notice for successful handoffs', async () => {
    process.env.SLACK_SIGNUP_WEBHOOK_URL = 'https://hooks.slack.test/signup'
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const res = await POST(signupRequest(
      { hasCode: true },
      {
        'x-forwarded-host': 'popdict.space<bad>',
        'x-vercel-ip-city': 'Seoul & City',
        'x-vercel-ip-country-region': 'KR<west>',
        'x-vercel-ip-country': 'KR',
        'user-agent': 'Firefox/120.0',
      },
    ))

    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledOnce()
    const [, init] = fetchMock.mock.calls[0]
    const body = JSON.parse(init.body as string)
    expect(body.text).toBe('New PopDict signup')
    expect(body.blocks[2].fields).toContainEqual({
      type: 'mrkdwn',
      text: '*Site:*\npopdict.space&lt;bad&gt;',
    })
    expect(body.blocks[2].fields).toContainEqual({
      type: 'mrkdwn',
      text: '*Location:*\nSeoul &amp; City, KR&lt;west&gt;, KR',
    })
  })

  it('does not notify for failed or empty handoffs', async () => {
    process.env.SLACK_SIGNUP_WEBHOOK_URL = 'https://hooks.slack.test/signup'
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    expect((await POST(signupRequest({ error: 'access_denied' }))).status).toBe(204)
    expect((await POST(signupRequest({}))).status).toBe(204)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
