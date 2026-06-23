import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import {
  isSupabaseConfigured,
  supabase,
  SUPABASE_AUTH_REDIRECT_URL,
} from '../services/supabaseClient'

type AuthCallbackParams = {
  code: string | null
  accessToken: string | null
  refreshToken: string | null
  error: string | null
}

type AuthDebugDetails = Record<string, unknown>

function formatAuthDebugDetails(details?: AuthDebugDetails): string {
  if (!details) return ''
  try {
    return JSON.stringify(details)
  } catch {
    return '[unserializable details]'
  }
}

function authDebug(event: string, details?: AuthDebugDetails): void {
  console.info(`[Auth] ${event} ${formatAuthDebugDetails(details)}`.trim())
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Authentication failed'
}

function describeCallbackUrl(callbackUrl: string): AuthDebugDetails {
  try {
    const url = new URL(callbackUrl)
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''))
    return {
      protocol: url.protocol,
      host: url.host,
      pathname: url.pathname,
      searchKeys: Array.from(url.searchParams.keys()),
      hashKeys: Array.from(hashParams.keys()),
      hasCode: url.searchParams.has('code'),
      hasAccessToken: url.searchParams.has('access_token') || hashParams.has('access_token'),
      hasRefreshToken: url.searchParams.has('refresh_token') || hashParams.has('refresh_token'),
      error: url.searchParams.get('error') ?? hashParams.get('error') ?? null,
      errorDescription:
        url.searchParams.get('error_description') ?? hashParams.get('error_description') ?? null,
    }
  } catch {
    return { invalidUrl: true }
  }
}

function describeExternalAuthUrl(authUrl: string): AuthDebugDetails {
  try {
    const url = new URL(authUrl)
    const redirectTo = url.searchParams.get('redirect_to')
    return {
      protocol: url.protocol,
      host: url.host,
      pathname: url.pathname,
      searchKeys: Array.from(url.searchParams.keys()),
      redirectTo: redirectTo ? describeCallbackUrl(redirectTo) : null,
    }
  } catch {
    return { invalidUrl: true }
  }
}

function readAuthCallbackParams(callbackUrl: string): AuthCallbackParams {
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

export function useSupabaseAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!supabase) {
      authDebug('supabase not configured')
      setLoading(false)
      return
    }

    let active = true

    authDebug('load existing session')
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return
      authDebug('existing session loaded', {
        hasSession: Boolean(data.session),
        hasUser: Boolean(data.session?.user),
        error: sessionError?.message ?? null,
      })
      setUser(data.session?.user ?? null)
      setError(sessionError ? sessionError.message : '')
      setLoading(false)
    })

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      authDebug('auth state changed', {
        event,
        hasSession: Boolean(session),
        hasUser: Boolean(session?.user),
      })
      setUser(session?.user ?? null)
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  const handleAuthCallback = useCallback(async (callbackUrl: string) => {
    if (!supabase) return

    authDebug('handle callback start', describeCallbackUrl(callbackUrl))
    setLoading(true)
    setError('')
    setMessage('Completing Google sign in...')

    try {
      const params = readAuthCallbackParams(callbackUrl)
      authDebug('callback params parsed', {
        hasCode: Boolean(params.code),
        hasAccessToken: Boolean(params.accessToken),
        hasRefreshToken: Boolean(params.refreshToken),
        error: params.error,
      })
      if (params.error) throw new Error(params.error)

      if (params.code) {
        authDebug('exchange code for session start')
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(params.code)
        if (exchangeError) throw exchangeError
        authDebug('exchange code for session success')
      } else if (params.accessToken && params.refreshToken) {
        authDebug('set session from callback tokens start')
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: params.accessToken,
          refresh_token: params.refreshToken,
        })
        if (sessionError) throw sessionError
        authDebug('set session from callback tokens success')
      } else {
        throw new Error('The auth callback did not include a session code.')
      }

      const { data, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError
      authDebug('get user after callback success', {
        hasUser: Boolean(data.user),
        userIdPrefix: data.user?.id ? data.user.id.slice(0, 8) : null,
        emailDomain: data.user?.email?.split('@')[1] ?? null,
      })
      setUser(data.user)
      setMessage('Signed in')
    } catch (callbackError) {
      authDebug('handle callback error', {
        message: getErrorMessage(callbackError),
        name: callbackError instanceof Error ? callbackError.name : typeof callbackError,
      })
      setError(getErrorMessage(callbackError))
      setMessage('')
    } finally {
      authDebug('handle callback complete')
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!window.electronAPI?.consumeAuthCallback || !supabase) return

    let active = true

    window.electronAPI.consumeAuthCallback().then((callbackUrl) => {
      authDebug('initial callback consume result', {
        active,
        hasCallback: Boolean(callbackUrl),
        ...(callbackUrl ? describeCallbackUrl(callbackUrl) : {}),
      })
      if (active && callbackUrl) void handleAuthCallback(callbackUrl)
    })

    return () => {
      active = false
    }
  }, [handleAuthCallback])

  useEffect(() => {
    if (!window.electronAPI?.onAuthCallback || !supabase) return
    return window.electronAPI.onAuthCallback((callbackUrl) => {
      authDebug('callback event received from main', describeCallbackUrl(callbackUrl))
      void window.electronAPI.consumeAuthCallback().then((pendingUrl) => {
        authDebug('callback event consume result', {
          hasPendingUrl: Boolean(pendingUrl),
          usedPendingUrl: Boolean(pendingUrl),
          ...(pendingUrl ? describeCallbackUrl(pendingUrl) : describeCallbackUrl(callbackUrl)),
        })
        void handleAuthCallback(pendingUrl ?? callbackUrl)
      })
    })
  }, [handleAuthCallback])

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) {
      authDebug('sign in requested without supabase config')
      setError('Supabase is not configured')
      return
    }

    authDebug('google sign in start', { redirectTo: SUPABASE_AUTH_REDIRECT_URL })
    setLoading(true)
    setError('')
    setMessage('Opening Google...')

    try {
      const { data, error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: SUPABASE_AUTH_REDIRECT_URL,
          skipBrowserRedirect: true,
        },
      })

      if (signInError) throw signInError
      if (!data.url) throw new Error('Supabase did not return a Google sign-in URL.')

      authDebug('google sign in url generated', describeExternalAuthUrl(data.url))
      await window.electronAPI.openExternalUrl(data.url)
      authDebug('google sign in url handed to browser')
      setMessage('Finish signing in from your browser')
    } catch (signInError) {
      authDebug('google sign in error', {
        message: getErrorMessage(signInError),
        name: signInError instanceof Error ? signInError.name : typeof signInError,
      })
      setError(getErrorMessage(signInError))
      setMessage('')
    } finally {
      authDebug('google sign in request complete')
      setLoading(false)
    }
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) return

    setLoading(true)
    setError('')
    setMessage('')

    try {
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) throw signOutError
      setUser(null)
      setMessage('Signed out')
      authDebug('signed out')
    } catch (signOutError) {
      authDebug('sign out error', {
        message: getErrorMessage(signOutError),
        name: signOutError instanceof Error ? signOutError.name : typeof signOutError,
      })
      setError(getErrorMessage(signOutError))
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    configured: isSupabaseConfigured,
    error,
    loading,
    message,
    signInWithGoogle,
    signOut,
    user,
  }
}
