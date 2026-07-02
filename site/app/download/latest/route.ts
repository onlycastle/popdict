import { NextResponse, after } from 'next/server'
import { deriveRecordContext, postDownloadRecord } from './record'

// "owner/repo" that hosts PopDict releases. Set GITHUB_REPO in the environment.
const GITHUB_REPO = process.env.GITHUB_REPO || ''

// Force dynamic so Next never statically caches the redirect — a cached route
// would fire the download record once instead of per request.
export const dynamic = 'force-dynamic'

type ReleaseAsset = { name: string; browser_download_url: string }

// Resolve and redirect to the newest release's DMG so the marketing CTA always
// points at the current build (the DMG filename is versioned, so a static
// redirect can't do this). Records the download as a best-effort side effect.
export async function GET(request: Request) {
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

  const data = (await res.json()) as { tag_name?: string; assets?: ReleaseAsset[] }
  const dmg = data.assets?.find((asset) => asset.name.toLowerCase().endsWith('.dmg'))

  if (!dmg) {
    return NextResponse.json({ error: 'No DMG in the latest release.' }, { status: 502 })
  }

  const payload = deriveRecordContext(request.headers, {
    tag: data.tag_name ?? 'unknown',
    assetName: dmg.name,
  })
  // Runs after the response is sent, so the redirect is never delayed.
  after(() => postDownloadRecord(payload))

  return NextResponse.redirect(dmg.browser_download_url, 302)
}
