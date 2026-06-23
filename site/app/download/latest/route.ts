import { NextResponse } from 'next/server'

// "owner/repo" that hosts PopDict releases. Set GITHUB_REPO in the environment.
const GITHUB_REPO = process.env.GITHUB_REPO || ''

type ReleaseAsset = { name: string; browser_download_url: string }

// Resolve and redirect to the newest release's DMG so the marketing CTA always
// points at the current build (the DMG filename is versioned, so a static
// redirect can't do this).
export async function GET() {
  if (!GITHUB_REPO) {
    return NextResponse.json({ error: 'Download is not configured.' }, { status: 503 })
  }

  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json' },
    next: { revalidate: 300 }, // cache 5 minutes
  })

  if (!res.ok) {
    return NextResponse.json({ error: 'No release found.' }, { status: 502 })
  }

  const data = (await res.json()) as { assets?: ReleaseAsset[] }
  const dmg = data.assets?.find((asset) => asset.name.toLowerCase().endsWith('.dmg'))

  if (!dmg) {
    return NextResponse.json({ error: 'No DMG in the latest release.' }, { status: 502 })
  }

  return NextResponse.redirect(dmg.browser_download_url, 302)
}
