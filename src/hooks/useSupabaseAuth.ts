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

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Authentication failed'
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
      setLoading(false)
      return
    }

    let active = true

    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return
      setUser(data.session?.user ?? null)
      setError(sessionError ? sessionError.message : '')
      setLoading(false)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  const handleAuthCallback = useCallback(async (callbackUrl: string) => {
    if (!supabase) return

    setLoading(true)
    setError('')
    setMessage('Completing Google sign in...')

    try {
      const params = readAuthCallbackParams(callbackUrl)
      if (params.error) throw new Error(params.error)

      if (params.code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(params.code)
        if (exchangeError) throw exchangeError
      } else if (params.accessToken && params.refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: params.accessToken,
          refresh_token: params.refreshToken,
        })
        if (sessionError) throw sessionError
      } else {
        throw new Error('The auth callback did not include a session code.')
      }

      const { data, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError
      setUser(data.user)
      setMessage('Signed in')
    } catch (callbackError) {
      setError(getErrorMessage(callbackError))
      setMessage('')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!window.electronAPI?.consumeAuthCallback || !supabase) return

    let active = true

    window.electronAPI.consumeAuthCallback().then((callbackUrl) => {
      if (active && callbackUrl) void handleAuthCallback(callbackUrl)
    })

    return () => {
      active = false
    }
  }, [handleAuthCallback])

  useEffect(() => {
    if (!window.electronAPI?.onAuthCallback || !supabase) return
    return window.electronAPI.onAuthCallback((callbackUrl) => {
      void window.electronAPI.consumeAuthCallback().then((pendingUrl) => {
        void handleAuthCallback(pendingUrl ?? callbackUrl)
      })
    })
  }, [handleAuthCallback])

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) {
      setError('Supabase is not configured')
      return
    }

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

      await window.electronAPI.openExternalUrl(data.url)
      setMessage('Finish signing in from your browser')
    } catch (signInError) {
      setError(getErrorMessage(signInError))
      setMessage('')
    } finally {
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
    } catch (signOutError) {
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
