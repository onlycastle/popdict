import { createClient } from '@supabase/supabase-js'

export const SUPABASE_AUTH_REDIRECT_URL = 'popdict://auth/callback'

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
