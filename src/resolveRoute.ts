export type Route = 'search' | 'settings' | 'saved' | 'onboarding'

const ROUTES: Record<string, Route> = {
  settings: 'settings',
  saved: 'saved',
  onboarding: 'onboarding',
}

/**
 * Resolve a window-location hash to a view route.
 *
 * Tolerates BOTH hash forms the app produces: the dev server loads
 * `…#/settings` (leading slash) while the packaged `loadFile` option produces
 * `…#settings` (no slash). Matching on the bare name here means routing is
 * correct no matter which loader emitted the hash — the two can't silently
 * drift apart again. Anything unknown — including the empty hash of the main
 * popup — resolves to 'search'.
 */
export function resolveRoute(hash: string): Route {
  const name = hash.replace(/^#\/?/, '')
  return ROUTES[name] ?? 'search'
}
