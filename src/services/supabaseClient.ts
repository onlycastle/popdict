import { createClient } from '@supabase/supabase-js'

const DEFAULT_AUTH_REDIRECT_URL = 'https://popdict.app/auth/callback'

export const SUPABASE_AUTH_REDIRECT_URL =
  import.meta.env.VITE_SUPABASE_AUTH_REDIRECT_URL?.trim() || DEFAULT_AUTH_REDIRECT_URL

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey)

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
        persistSession: true,
      },
    })
  : null
