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

/** True only for our own `popdict://auth/callback` deep link. */
export function isAuthCallbackUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return (
      parsed.protocol === `${AUTH_PROTOCOL}:` &&
      parsed.hostname === 'auth' &&
      parsed.pathname === '/callback'
    )
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

export type AuthAction =
  | { type: 'error'; message: string }
  | { type: 'exchange-code'; code: string }
  | { type: 'none' }

/**
 * Decide how to handle a parsed auth callback. PopDict is configured for the
 * PKCE flow (flowType: 'pkce'), so the ONLY session-establishing path is a
 * `code` redeemed against the locally-held verifier. Raw access/refresh tokens
 * arriving in a deep link are deliberately ignored: a `popdict://` URL can be
 * launched by ANY app or web page, so honoring bearer tokens directly is a
 * session-fixation vector.
 */
export function planAuthAction(params: AuthCallbackParams): AuthAction {
  if (params.error) return { type: 'error', message: params.error }
  if (params.code) return { type: 'exchange-code', code: params.code }
  return { type: 'none' }
}
