import { useEffect, useState } from 'react'
import { useSupabaseAuth } from '../hooks/useSupabaseAuth'
import type { AppSettings } from '../types/electron'
import HotkeyField from '../components/HotkeyField'

export default function SettingsView() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [status, setStatus] = useState('')
  const [version, setVersion] = useState('')
  const auth = useSupabaseAuth()

  useEffect(() => {
    window.electronAPI.getSettings().then(setSettings)
    window.electronAPI.getAppVersion().then(setVersion)
  }, [])

  if (!settings) return <div className="window min-h-screen p-6 text-white/80">Loading…</div>

  const update = (patch: Partial<AppSettings>) =>
    window.electronAPI.setSettings(patch).then(setSettings)
  const accountName =
    auth.user?.user_metadata?.full_name ??
    auth.user?.user_metadata?.name ??
    auth.user?.email ??
    'Signed in'

  return (
    <div className="window h-screen overflow-y-auto p-6 space-y-5">
      <h1 className="view-title text-lg">Settings</h1>

      <section className="space-y-3 border-b border-white/10 pb-5">
        <div>
          <h2 className="dict-label mb-1.5">Account</h2>
          <p className="text-sm text-white/70">
            {auth.user ? accountName : 'Sign in or create an account with Google'}
          </p>
        </div>

        {!auth.configured ? (
          <p className="notice">
            Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to enable auth.
          </p>
        ) : auth.user ? (
          <button
            onClick={auth.signOut}
            disabled={auth.loading}
            className="btn-ghost text-sm"
          >
            Sign out
          </button>
        ) : (
          <button
            onClick={auth.signInWithGoogle}
            disabled={auth.loading}
            className="btn-primary text-sm"
          >
            Continue with Google
          </button>
        )}

        {(auth.message || auth.error) && (
          <p className={`text-xs ${auth.error ? 'text-red-300' : 'text-white/60'}`}>
            {auth.error || auth.message}
          </p>
        )}
      </section>

      <HotkeyField
        value={settings.hotkey}
        onChange={(hotkey) => setSettings((s) => (s ? { ...s, hotkey } : s))}
      />

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={settings.launchAtLogin}
          onChange={(e) => update({ launchAtLogin: e.target.checked })}
        />
        <span className="text-sm text-white/80">Launch at login</span>
      </label>

      <div className="flex items-center justify-between pt-2">
        <button
          onClick={() => window.electronAPI.clearHistory().then(() => setStatus('History cleared'))}
          className="text-sm text-white/70 underline"
        >
          Clear search history
        </button>
        <button
          onClick={() => window.electronAPI.sendFeedback()}
          className="text-sm text-white/70 underline"
        >
          Open GitHub Issue
        </button>
      </div>

      {status && <p className="text-xs text-white/60">{status}</p>}
      {version && <p className="pt-2 text-xs text-white/40">PopDict v{version}</p>}
    </div>
  )
}
