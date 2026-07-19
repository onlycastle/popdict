import { createClient } from '@supabase/supabase-js'

const DEFAULT_AUTH_REDIRECT_URL = 'https://popdict.space/auth/callback'

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

export const PUBLIC_SUPABASE_AUTH_OPTIONS = {
  autoRefreshToken: false,
  detectSessionInUrl: false,
  persistSession: false,
} as const

// Public dictionary data and anonymous endpoints must never inherit a signed-in
// user's persisted session. This client authenticates only as anon/publishable.
export const publicSupabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey, { auth: PUBLIC_SUPABASE_AUTH_OPTIONS })
  : null
