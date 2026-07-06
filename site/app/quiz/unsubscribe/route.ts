import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: Request) {
  const url = new URL(request.url)
  const token = url.searchParams.get('u') ?? ''
  const base = process.env.QUIZ_FN_URL
  if (UUID_RE.test(token) && base) {
    try {
      await fetch(`${base}?action=unsubscribe&u=${token}`)
    } catch {
      // fall through to the confirmation page either way; the user can retry
    }
  }
  return NextResponse.redirect(new URL('/quiz/unsubscribed', request.url), 303)
}
