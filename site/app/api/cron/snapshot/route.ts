import { NextResponse } from 'next/server'
import { isAuthorizedCron, triggerSnapshot } from './snapshot'

export const dynamic = 'force-dynamic'

// Vercel Cron target (daily). Rejects any request lacking the CRON_SECRET so it
// can't be triggered publicly, then asks the downloads function to snapshot.
export async function GET(request: Request) {
  if (!isAuthorizedCron(request.headers)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  try {
    const res = await triggerSnapshot()
    return NextResponse.json({ ok: res.ok }, { status: res.ok ? 200 : 502 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 503 })
  }
}
