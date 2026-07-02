'use client'

import { useEffect, useState } from 'react'

const APP_AUTH_CALLBACK_URL = 'popdict://auth/callback'

type HandoffState = 'opening' | 'ready' | 'missing'

function buildAppCallbackUrl() {
  const payload = `${window.location.search}${window.location.hash}`
  return payload ? `${APP_AUTH_CALLBACK_URL}${payload}` : null
}

function authCallbackSummary() {
  const search = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  return {
    hasCode: search.has('code'),
    hasAccessToken: hash.has('access_token'),
    error: search.get('error') || hash.get('error'),
  }
}

function notifySignupOnce() {
  try {
    const payload = authCallbackSummary()
    if (payload.error || (!payload.hasCode && !payload.hasAccessToken)) return

    const key = `popdict-signup-notified:${window.location.search}:${window.location.hash}`
    if (window.sessionStorage.getItem(key)) return
    window.sessionStorage.setItem(key, '1')

    const body = JSON.stringify(payload)
    const url = '/api/slack/signup'
    const blob = new Blob([body], { type: 'application/json' })

    if (navigator.sendBeacon?.(url, blob)) return

    void fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => undefined)
  } catch {
    // Best-effort only. Never block the auth handoff to the desktop app.
  }
}

export default function AuthCallbackPage() {
  const [callbackUrl, setCallbackUrl] = useState<string | null>(null)
  const [state, setState] = useState<HandoffState>('opening')

  useEffect(() => {
    const nextCallbackUrl = buildAppCallbackUrl()
    setCallbackUrl(nextCallbackUrl)

    if (!nextCallbackUrl) {
      setState('missing')
      return
    }

    notifySignupOnce()

    const settleTimer = window.setTimeout(() => {
      // Chrome can keep the tab spinner active while the external protocol
      // navigation is pending; settle the already-loaded handoff page.
      window.stop()
      setState('ready')
    }, 1200)
    window.location.href = nextCallbackUrl

    return () => window.clearTimeout(settleTimer)
  }, [])

  const title =
    state === 'missing'
      ? 'Sign-in link expired'
      : state === 'ready'
        ? 'PopDict should be open now'
        : 'Opening PopDict'

  const message =
    state === 'missing'
      ? 'Start Google sign-in again from the PopDict app.'
      : state === 'ready'
        ? 'You can close this browser tab and continue in PopDict.'
        : 'Chrome may ask for permission to open the PopDict app.'

  return (
    <main className="auth-callback">
      <div className="auth-callback-panel" role="status" aria-live="polite">
        <p className="auth-callback-kicker">PopDict</p>
        <h1>{title}</h1>
        <p>{message}</p>
        {callbackUrl && (
          <a className="btn" href={callbackUrl}>
            Open PopDict
          </a>
        )}
      </div>
    </main>
  )
}
