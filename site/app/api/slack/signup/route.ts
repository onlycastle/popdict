import { NextRequest, NextResponse } from 'next/server'

type SignupNotificationPayload = {
  hasCode?: boolean
  hasAccessToken?: boolean
  error?: string | null
}

function field(title: string, value: string | null | undefined) {
  return value ? { type: 'mrkdwn', text: `*${title}:*\n${value}` } : null
}

function userAgentName(userAgent: string | null) {
  if (!userAgent) return null
  if (userAgent.includes('Chrome/')) return 'Chrome'
  if (userAgent.includes('Safari/') && !userAgent.includes('Chrome/')) return 'Safari'
  if (userAgent.includes('Firefox/')) return 'Firefox'
  return userAgent.slice(0, 80)
}

export async function POST(request: NextRequest) {
  const webhookUrl = process.env.SLACK_SIGNUP_WEBHOOK_URL
  if (!webhookUrl) return new NextResponse(null, { status: 204 })

  let payload: SignupNotificationPayload
  try {
    payload = (await request.json()) as SignupNotificationPayload
  } catch {
    return new NextResponse(null, { status: 204 })
  }

  // Only notify for a successful OAuth handoff. Never forward the auth code,
  // access token, or any other callback secret to Slack.
  if (payload.error || (!payload.hasCode && !payload.hasAccessToken)) {
    return new NextResponse(null, { status: 204 })
  }

  const country = request.headers.get('x-vercel-ip-country')
  const city = request.headers.get('x-vercel-ip-city')
  const region = request.headers.get('x-vercel-ip-country-region')
  const userAgent = userAgentName(request.headers.get('user-agent'))
  const forwardedHost = request.headers.get('x-forwarded-host')
  const host = forwardedHost || request.headers.get('host')

  const location = [city, region, country].filter(Boolean).join(', ')
  const fields = [
    field('Site', host),
    field('Location', location),
    field('Browser', userAgent),
  ].filter(Boolean)

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text: 'New PopDict signup',
        blocks: [
          {
            type: 'header',
            text: { type: 'plain_text', text: 'New PopDict signup' },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: 'A user completed the PopDict Google sign-in handoff.',
            },
          },
          ...(fields.length ? [{ type: 'section', fields }] : []),
        ],
      }),
    })

    if (!response.ok) return new NextResponse(null, { status: 204 })
    return NextResponse.json({ ok: true })
  } catch {
    return new NextResponse(null, { status: 204 })
  }
}
