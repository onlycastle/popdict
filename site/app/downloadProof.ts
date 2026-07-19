type GitHubReleaseAsset = {
  name?: unknown
  download_count?: unknown
}

type GitHubRelease = {
  assets?: unknown
}

const GITHUB_API_VERSION = '2022-11-28'

// Count only macOS installers. GitHub release ZIP assets and website redirect
// clicks are different signals and must not inflate the public download claim.
export function countDmgDownloads(payload: unknown): number {
  if (!Array.isArray(payload)) return 0

  let total = 0
  for (const release of payload as GitHubRelease[]) {
    if (!Array.isArray(release?.assets)) continue
    for (const asset of release.assets as GitHubReleaseAsset[]) {
      if (typeof asset?.name !== 'string' || !asset.name.toLowerCase().endsWith('.dmg')) continue
      if (
        typeof asset.download_count === 'number'
        && Number.isSafeInteger(asset.download_count)
        && asset.download_count >= 0
      ) {
        total += asset.download_count
      }
    }
  }
  return total
}

export function formatDownloadProof(count: number): string | null {
  if (!Number.isSafeInteger(count) || count <= 0) return null

  // Exact counts are useful while the project is young. Once it crosses 100,
  // use a stable milestone so the page naturally reads "100+ downloads".
  const displayed = count >= 100
    ? `${(Math.floor(count / 100) * 100).toLocaleString('en-US')}+`
    : count.toLocaleString('en-US')
  return `${displayed} macOS downloads`
}

export async function fetchGitHubDmgDownloadCount(repo: string): Promise<number | null> {
  try {
    const response = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=100`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': GITHUB_API_VERSION,
      },
      next: { revalidate: 21_600 },
      signal: AbortSignal.timeout(3_000),
    })
    if (!response.ok) return null

    const count = countDmgDownloads(await response.json())
    return count > 0 ? count : null
  } catch {
    // Social proof is optional: GitHub downtime must never break the product page.
    return null
  }
}
