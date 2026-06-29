import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import {
  isSupabaseConfigured,
  supabase,
  SUPABASE_AUTH_REDIRECT_URL,
} from '../services/supabaseClient'
import { createLogger } from '../../shared/logger'
import {
  describeAuthUrl,
  describeExternalAuthUrl,
  planAuthAction,
  readAuthCallbackParams,
} from '../../shared/authUrl'

const log = createLogger('Auth')

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Authentication failed'
}

export function useSupabaseAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!supabase) {
      log.event('supabase not configured')
      setLoading(false)
      return
    }

    let active = true

    log.event('load existing session')
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return
      log.event('existing session loaded', {
        hasSession: Boolean(data.session),
        hasUser: Boolean(data.session?.user),
        error: sessionError?.message ?? null,
      })
      setUser(data.session?.user ?? null)
      setError(sessionError ? sessionError.message : '')
      setLoading(false)
    })

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      log.event('auth state changed', {
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

    log.event('handle callback start', describeAuthUrl(callbackUrl))
    setLoading(true)
    setError('')
    setMessage('Completing Google sign in...')

    try {
      const params = readAuthCallbackParams(callbackUrl)
      log.event('callback params parsed', {
        hasCode: Boolean(params.code),
        hasAccessToken: Boolean(params.accessToken),
        hasRefreshToken: Boolean(params.refreshToken),
        error: params.error,
      })
      if (params.error) throw new Error(params.error)

      const action = planAuthAction(params)
      if (action.type === 'exchange-code') {
        log.event('exchange code for session start')
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(action.code)
        if (exchangeError) throw exchangeError
        log.event('exchange code for session success')
      } else {
        throw new Error('The auth callback did not include a session code.')
      }

      const { data, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError
      log.event('get user after callback success', {
        hasUser: Boolean(data.user),
        userIdPrefix: data.user?.id ? data.user.id.slice(0, 8) : null,
        emailDomain: data.user?.email?.split('@')[1] ?? null,
      })
      setUser(data.user)
      setMessage('Signed in')
    } catch (callbackError) {
      log.event('handle callback error', {
        message: getErrorMessage(callbackError),
        name: callbackError instanceof Error ? callbackError.name : typeof callbackError,
      })
      setError(getErrorMessage(callbackError))
      setMessage('')
    } finally {
      log.event('handle callback complete')
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!window.electronAPI?.consumeAuthCallback || !supabase) return

    let active = true

    window.electronAPI.consumeAuthCallback().then((callbackUrl) => {
      log.event('initial callback consume result', {
        active,
        hasCallback: Boolean(callbackUrl),
        ...(callbackUrl ? describeAuthUrl(callbackUrl) : {}),
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
      log.event('callback event received from main', describeAuthUrl(callbackUrl))
      void window.electronAPI.consumeAuthCallback().then((pendingUrl) => {
        log.event('callback event consume result', {
          hasPendingUrl: Boolean(pendingUrl),
          usedPendingUrl: Boolean(pendingUrl),
          ...(pendingUrl ? describeAuthUrl(pendingUrl) : describeAuthUrl(callbackUrl)),
        })
        void handleAuthCallback(pendingUrl ?? callbackUrl)
      })
    })
  }, [handleAuthCallback])

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) {
      log.event('sign in requested without supabase config')
      setError('Supabase is not configured')
      return
    }

    log.event('google sign in start', { redirectTo: SUPABASE_AUTH_REDIRECT_URL })
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

      log.event('google sign in url generated', describeExternalAuthUrl(data.url))
      await window.electronAPI.openExternalUrl(data.url)
      log.event('google sign in url handed to browser')
      setMessage('Finish signing in from your browser')
    } catch (signInError) {
      log.event('google sign in error', {
        message: getErrorMessage(signInError),
        name: signInError instanceof Error ? signInError.name : typeof signInError,
      })
      setError(getErrorMessage(signInError))
      setMessage('')
    } finally {
      log.event('google sign in request complete')
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
      log.event('signed out')
    } catch (signOutError) {
      log.event('sign out error', {
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
