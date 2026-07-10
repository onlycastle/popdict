import { NextResponse } from 'next/server'
import { isAuthorizedCron } from '../cronAuth'
import { triggerQuizSend } from './quiz'

export const dynamic = 'force-dynamic'

// Vercel Cron target (daily, 23:00 UTC = 08:00 KST). Rejects any request
// lacking the CRON_SECRET, then asks the quiz function to send due emails.
export async function GET(request: Request) {
  if (!isAuthorizedCron(request.headers)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  try {
    const res = await triggerQuizSend()
    return NextResponse.json({ ok: res.ok }, { status: res.ok ? 200 : 502 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 503 })
  }
}
