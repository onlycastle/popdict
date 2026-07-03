// Verify the request came from Vercel Cron (which sends Authorization: Bearer
// $CRON_SECRET). Fail closed when the secret is unset.
export function isAuthorizedCron(headers: Headers): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return headers.get('authorization') === `Bearer ${secret}`
}
