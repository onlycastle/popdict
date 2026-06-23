// Pure auth deep-link URL helpers shared by the main and renderer processes.
//
// Consolidates URL introspection that was duplicated across electron/main.ts
// (describeAuthUrl / describeExternalUrl / isAuthCallbackUrl) and
// src/hooks/useSupabaseAuth.ts (describeCallbackUrl / describeExternalAuthUrl /
// readAuthCallbackParams). All functions are pure and depend only on the URL /
// URLSearchParams globals, which exist in both runtimes.

import type { LogDetails } from './logger'

export const AUTH_PROTOCOL = 'popdict'

export type AuthCallbackParams = {
  code: string | null
  accessToken: string | null
  refreshToken: string | null
  error: string | null
}

/** True only for our own `popdict://auth/...` deep links. */
export function isAuthCallbackUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === `${AUTH_PROTOCOL}:` && parsed.hostname === 'auth'
  } catch {
    return false
  }
}

/** Structured, secret-free summary of a callback URL for debug logging. */
export function describeAuthUrl(rawUrl: string): LogDetails {
  try {
    const url = new URL(rawUrl)
    const search = url.searchParams
    const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
    return {
      protocol: url.protocol,
      host: url.host,
      pathname: url.pathname,
      searchKeys: Array.from(search.keys()),
      hashKeys: Array.from(hash.keys()),
      hasCode: search.has('code'),
      hasAccessToken: search.has('access_token') || hash.has('access_token'),
      hasRefreshToken: search.has('refresh_token') || hash.has('refresh_token'),
      error: search.get('error') ?? hash.get('error') ?? null,
      errorDescription: search.get('error_description') ?? hash.get('error_description') ?? null,
    }
  } catch {
    return { invalidUrl: true }
  }
}

/** Summary of an outbound OAuth URL, recursing into its `redirect_to`. */
export function describeExternalAuthUrl(rawUrl: string): LogDetails {
  try {
    const url = new URL(rawUrl)
    const redirectTo = url.searchParams.get('redirect_to')
    return {
      protocol: url.protocol,
      host: url.host,
      pathname: url.pathname,
      searchKeys: Array.from(url.searchParams.keys()),
      redirectTo: redirectTo ? describeAuthUrl(redirectTo) : null,
    }
  } catch {
    return { invalidUrl: true }
  }
}

/**
 * Extract the session-bearing params from a callback URL. Supabase may return
 * either a PKCE `code` (query) or `access_token`/`refresh_token` (hash); errors
 * can land in either location, so check both.
 */
export function readAuthCallbackParams(callbackUrl: string): AuthCallbackParams {
  const url = new URL(callbackUrl)
  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''))
  const error =
    url.searchParams.get('error_description') ??
    hashParams.get('error_description') ??
    url.searchParams.get('error') ??
    hashParams.get('error')

  return {
    code: url.searchParams.get('code'),
    accessToken: hashParams.get('access_token') ?? url.searchParams.get('access_token'),
    refreshToken: hashParams.get('refresh_token') ?? url.searchParams.get('refresh_token'),
    error,
  }
}
