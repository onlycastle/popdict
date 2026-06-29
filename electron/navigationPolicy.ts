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
  try {
    const target = new URL(targetUrl)
    // FIX 2: compare origins, not raw string prefixes, so
    // http://localhost:5173.evil.com/ does not pass as a dev-server URL.
    if (opts.devServerUrl && target.origin === new URL(opts.devServerUrl).origin) return true
    if (target.protocol !== 'file:') return false
    // FIX 1: check both host and pathname so file://attacker-host/<packaged path>
    // (UNC/SMB load vector on Windows) is rejected even when the pathname matches.
    const pkg = new URL(opts.packagedIndexFileUrl)
    return target.host === pkg.host && target.pathname === pkg.pathname
  } catch {
    return false
  }
}
