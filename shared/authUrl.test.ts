import { describe, expect, it } from 'vitest'
import {
  describeAuthUrl,
  describeExternalAuthUrl,
  isAuthCallbackUrl,
  readAuthCallbackParams,
} from './authUrl'

describe('isAuthCallbackUrl', () => {
  it('accepts our popdict://auth deep link', () => {
    expect(isAuthCallbackUrl('popdict://auth/callback?code=abc')).toBe(true)
  })

  it('rejects other schemes, hosts, and malformed input', () => {
    expect(isAuthCallbackUrl('https://auth/callback')).toBe(false)
    expect(isAuthCallbackUrl('popdict://other/callback')).toBe(false)
    expect(isAuthCallbackUrl('not a url')).toBe(false)
  })
})

describe('readAuthCallbackParams', () => {
  it('reads a PKCE code from the query string', () => {
    const p = readAuthCallbackParams('popdict://auth/callback?code=xyz')
    expect(p.code).toBe('xyz')
    expect(p.accessToken).toBeNull()
    expect(p.error).toBeNull()
  })

  it('reads access/refresh tokens from the hash fragment', () => {
    const p = readAuthCallbackParams(
      'popdict://auth/callback#access_token=at&refresh_token=rt'
    )
    expect(p.accessToken).toBe('at')
    expect(p.refreshToken).toBe('rt')
  })

  it('prefers error_description and finds errors in query or hash', () => {
    expect(readAuthCallbackParams('popdict://auth/cb?error=denied').error).toBe('denied')
    expect(
      readAuthCallbackParams('popdict://auth/cb#error_description=nope&error=denied').error
    ).toBe('nope')
  })
})

describe('describeAuthUrl', () => {
  it('summarizes presence of secrets without leaking their values', () => {
    const d = describeAuthUrl('popdict://auth/callback?code=secret&error=boom')
    expect(d.hasCode).toBe(true)
    expect(d.error).toBe('boom')
    expect(JSON.stringify(d)).not.toContain('secret')
  })

  it('flags malformed URLs instead of throwing', () => {
    expect(describeAuthUrl('::::')).toEqual({ invalidUrl: true })
  })
})

describe('describeExternalAuthUrl', () => {
  it('recurses into redirect_to', () => {
    const d = describeExternalAuthUrl(
      'https://x.supabase.co/auth/v1/authorize?redirect_to=' +
        encodeURIComponent('popdict://auth/callback?code=abc')
    )
    expect((d.redirectTo as Record<string, unknown>).hasCode).toBe(true)
  })

  it('handles a missing redirect_to', () => {
    const d = describeExternalAuthUrl('https://x.supabase.co/auth/v1/authorize')
    expect(d.redirectTo).toBeNull()
  })
})
