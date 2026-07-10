export { isAuthorizedCron } from '../cronAuth'

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
