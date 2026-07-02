import {
  fetchDashboardData,
  isAuthorizedDashboard,
  renderDashboardPage,
  renderErrorPage,
} from './statsPage'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const HTML_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store',
}

export async function GET(request: Request): Promise<Response> {
  if (
    !isAuthorizedDashboard(
      request.headers,
      process.env.DOWNLOADS_DASHBOARD_USER,
      process.env.DOWNLOADS_DASHBOARD_PASSWORD,
    )
  ) {
    return new Response('Authentication required', {
      status: 401,
      headers: {
        'www-authenticate': 'Basic realm="PopDict Download Stats"',
        'cache-control': 'no-store',
      },
    })
  }

  try {
    const data = await fetchDashboardData()
    return new Response(renderDashboardPage(data), { headers: HTML_HEADERS })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return new Response(renderErrorPage(message, 503), {
      status: 503,
      headers: HTML_HEADERS,
    })
  }
}
