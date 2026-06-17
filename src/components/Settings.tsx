import { useEffect, useState } from 'react'
import type { AppSettings } from '../types/electron'

export default function Settings() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [status, setStatus] = useState('')

  useEffect(() => {
    window.electronAPI.getSettings().then(setSettings)
  }, [])

  if (!settings) return <div className="min-h-screen bg-neutral-900 p-6 text-white/80">Loading…</div>

  const update = (patch: Partial<AppSettings>) =>
    window.electronAPI.setSettings(patch).then(setSettings)

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
    <div className="min-h-screen bg-neutral-900 p-6 space-y-5 text-white">
      <h1 className="text-lg font-semibold">PopDict Settings</h1>

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

      <label className="block space-y-1">
        <span className="text-sm text-white/80">STANDS4 UID</span>
        <input
          defaultValue={settings.stands4Uid}
          onBlur={(e) => update({ stands4Uid: e.target.value })}
          className="search-input"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm text-white/80">STANDS4 Token</span>
        <input
          defaultValue={settings.stands4Token}
          onBlur={(e) => update({ stands4Token: e.target.value })}
          className="search-input"
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
          Send feedback
        </button>
      </div>

      {status && <p className="text-xs text-white/60">{status}</p>}
    </div>
  )
}
