/**
 * Decide whether an in-window navigation may proceed. Only two destinations are
 * legitimate: the Vite dev server (development) and the packaged renderer's
 * index.html (production). Everything else — remote origins and arbitrary local
 * files — is blocked; the caller hands https links to the system browser. Pure
 * so it can be unit-tested without Electron.
 */
export function shouldAllowNavigation(
  targetUrl: string,
  opts: { devServerUrl?: string; packagedIndexFileUrl: string }
): boolean {
  if (opts.devServerUrl && targetUrl.startsWith(opts.devServerUrl)) return true
  try {
    const target = new URL(targetUrl)
    if (target.protocol !== 'file:') return false
    return target.pathname === new URL(opts.packagedIndexFileUrl).pathname
  } catch {
    return false
  }
}
