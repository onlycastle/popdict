import { NextResponse } from 'next/server'
import { forwardAnswer, parseAnswerParams, resultPath } from './answer'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const parsed = parseAnswerParams(url.searchParams)
  if (!parsed) {
    return NextResponse.redirect(new URL(resultPath({ error: 'invalid' }), request.url), 303)
  }
  try {
    const outcome = await forwardAnswer(parsed.q, parsed.c)
    return NextResponse.redirect(new URL(resultPath(outcome), request.url), 303)
  } catch {
    return NextResponse.redirect(new URL(resultPath({ error: 'unavailable' }), request.url), 303)
  }
}
