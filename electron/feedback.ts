import { app, shell } from 'electron'

// Baked in at build time so a release can wire feedback without editing source:
//   POPDICT_GITHUB_REPO=owner/repo npm run release:arm64
const GITHUB_REPO = process.env.POPDICT_GITHUB_REPO || ''

/** Open a prefilled GitHub Issues feedback form. No-op (warns) if repo unset. */
export function openFeedback(): void {
  const version = app.getVersion()
  if (!GITHUB_REPO) {
    console.warn('POPDICT_GITHUB_REPO is unset; cannot open GitHub Issues feedback URL.')
    return
  }

  const params = new URLSearchParams({
    title: `PopDict feedback (${version})`,
    body: `## Feedback\n\n\n## Version\n${version}\n`,
  })
  shell.openExternal(`https://github.com/${GITHUB_REPO}/issues/new?${params.toString()}`)
}
