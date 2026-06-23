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

  if (!settings) return <div className="min-h-screen bg-neutral-900 p-6 text-white/80">Loading…</div>

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
    <div className="h-screen overflow-y-auto bg-neutral-900 p-6 space-y-5 text-white">
      <h1 className="text-lg font-semibold">PopDict Settings</h1>

      <section className="space-y-3 border-b border-white/10 pb-5">
        <div>
          <h2 className="text-sm font-medium text-white">Account</h2>
          <p className="text-xs text-white/60">
            {auth.user ? accountName : 'Sign in or create an account with Google'}
          </p>
        </div>

        {!auth.configured ? (
          <p className="rounded-md border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-100">
            Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to enable auth.
          </p>
        ) : auth.user ? (
          <button
            onClick={auth.signOut}
            disabled={auth.loading}
            className="rounded-md border border-white/20 px-3 py-2 text-sm text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Sign out
          </button>
        ) : (
          <button
            onClick={auth.signInWithGoogle}
            disabled={auth.loading}
            className="rounded-md bg-white px-3 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
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

      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          className="mt-1"
          checked={settings.lookupSelection}
          onChange={(e) => update({ lookupSelection: e.target.checked })}
        />
        <span className="text-sm text-white/80">
          Look up selected text
          <span className="block text-xs text-white/50">
            When you press the hotkey, search the text selected in the frontmost app.
            Requires Accessibility permission.
          </span>
        </span>
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
