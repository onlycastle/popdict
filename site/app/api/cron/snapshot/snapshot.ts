// Verify the request came from Vercel Cron (which sends Authorization: Bearer
// $CRON_SECRET). Fail closed when the secret is unset.
export function isAuthorizedCron(headers: Headers): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return headers.get('authorization') === `Bearer ${secret}`
}

// Trigger the downloads function's daily GitHub snapshot with the admin token.
export async function triggerSnapshot(): Promise<Response> {
  const url = process.env.DOWNLOADS_FN_URL
  const token = process.env.DOWNLOADS_STATS_TOKEN
  if (!url || !token) throw new Error('snapshot not configured')
  return fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-admin-token': token },
    body: JSON.stringify({ action: 'snapshot' }),
  })
}
