import { describe, expect, it } from 'vitest'
import {
  describeAuthUrl,
  describeExternalAuthUrl,
  isAllowedExternalAuthUrl,
  isAuthCallbackUrl,
  isQuizDeepLink,
  planAuthAction,
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

  it('rejects popdict://auth paths other than /callback', () => {
    expect(isAuthCallbackUrl('popdict://auth/evil')).toBe(false)
    expect(isAuthCallbackUrl('popdict://auth')).toBe(false)
  })

  it('accepts the exact callback path with a query or hash', () => {
    expect(isAuthCallbackUrl('popdict://auth/callback?code=abc')).toBe(true)
    expect(isAuthCallbackUrl('popdict://auth/callback#access_token=x')).toBe(true)
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

describe('isAllowedExternalAuthUrl', () => {
  it('allows the Supabase auth host over https', () => {
    expect(
      isAllowedExternalAuthUrl('https://abc.supabase.co/auth/v1/authorize?provider=google')
    ).toBe(true)
  })

  it('rejects non-https and non-Supabase hosts', () => {
    expect(isAllowedExternalAuthUrl('http://abc.supabase.co/auth/v1/authorize')).toBe(false)
    expect(isAllowedExternalAuthUrl('https://evil.example.com/phish')).toBe(false)
    expect(isAllowedExternalAuthUrl('https://abc.supabase.co.evil.com/phish')).toBe(false)
    expect(isAllowedExternalAuthUrl('not a url')).toBe(false)
  })
})

describe('isQuizDeepLink', () => {
  it('matches the quiz deep link and nothing else', () => {
    expect(isQuizDeepLink('popdict://quiz')).toBe(true)
    expect(isQuizDeepLink('popdict://quiz/')).toBe(true)
    expect(isQuizDeepLink('popdict://auth/callback?x=1')).toBe(false)
    expect(isQuizDeepLink('https://popdict.space/quiz')).toBe(false)
  })
})

describe('planAuthAction', () => {
  it('plans a code exchange when a PKCE code is present', () => {
    const params = readAuthCallbackParams('popdict://auth/callback?code=xyz')
    expect(planAuthAction(params)).toEqual({ type: 'exchange-code', code: 'xyz' })
  })

  it('returns the error when the callback carries one', () => {
    const params = readAuthCallbackParams('popdict://auth/callback?error=access_denied')
    expect(planAuthAction(params)).toEqual({ type: 'error', message: 'access_denied' })
  })

  it('ignores raw access/refresh tokens so a forged deep link cannot establish a session', () => {
    const params = readAuthCallbackParams(
      'popdict://auth/callback#access_token=ATTACKER&refresh_token=ATTACKER'
    )
    expect(planAuthAction(params)).toEqual({ type: 'none' })
  })

  it('returns none for a callback with no actionable material', () => {
    const params = readAuthCallbackParams('popdict://auth/callback')
    expect(planAuthAction(params)).toEqual({ type: 'none' })
  })
})
