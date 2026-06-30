import { useEffect, useState } from 'react'
import { useSupabaseAuth } from '../hooks/useSupabaseAuth'
import type { AppSettings } from '../types/electron'

export default function SettingsView() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [status, setStatus] = useState('')
  const auth = useSupabaseAuth()

  useEffect(() => {
    window.electronAPI.getSettings().then(setSettings)
  }, [])

  if (!settings) return <div className="window min-h-screen p-6 text-white/80">Loading…</div>

  const update = (patch: Partial<AppSettings>) =>
    window.electronAPI.setSettings(patch).then(setSettings)
  const accountName =
    auth.user?.user_metadata?.full_name ??
    auth.user?.user_metadata?.name ??
    auth.user?.email ??
    'Signed in'

  const recordHotkey = (e: React.KeyboardEvent) => {
    e.preventDefault()
    if (['Meta', 'Control', 'Shift', 'Alt'].includes(e.key)) return
    if (!e.metaKey && !e.ctrlKey && !e.altKey) {
      setStatus('Hotkey must include ⌘, Ctrl, or Alt')
      return
    }
    const parts: string[] = []
    if (e.metaKey || e.ctrlKey) parts.push('CommandOrControl')
    if (e.shiftKey) parts.push('Shift')
    if (e.altKey) parts.push('Alt')
    const key = e.key.length === 1 ? e.key.toUpperCase() : e.key
    parts.push(key === ' ' ? 'Space' : key)
    const accelerator = parts.join('+')
    window.electronAPI.changeHotkey(accelerator).then((ok) => {
      if (ok) {
        setSettings({ ...settings, hotkey: accelerator })
        setStatus('Hotkey updated')
      } else {
        setStatus('That shortcut is unavailable — try another')
      }
    })
  }

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

      <label className="block space-y-1">
        <span className="text-sm text-white/80">Global hotkey</span>
        <input
          readOnly
          value={settings.hotkey}
          onKeyDown={recordHotkey}
          className="search-input"
          placeholder="Click and press a shortcut"
        />
      </label>

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
    </div>
  )
}
