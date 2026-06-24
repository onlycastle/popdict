import { useEffect, useState } from 'react'
import type { AppSettings } from '../types/electron'

function prettyHotkey(accelerator: string): string {
  return accelerator
    .replace('CommandOrControl', '⌘')
    .replace('Command', '⌘')
    .replace('Control', '⌃')
    .replace('Shift', '⇧')
    .replace('Alt', '⌥')
    .split('+')
    .join(' ')
}

export default function OnboardingView() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  // Drive the button off the ACTUAL Accessibility permission, not the
  // lookupSelection toggle — otherwise first-run users (toggle defaults on) are
  // never prompted and capture silently fails.
  const [accessibilityGranted, setAccessibilityGranted] = useState(false)
  const [requested, setRequested] = useState(false)

  useEffect(() => {
    window.electronAPI.getSettings().then(setSettings)
    window.electronAPI.isAccessibilityTrusted().then(setAccessibilityGranted)
  }, [])

  const enableSelection = async () => {
    await window.electronAPI.setSettings({ lookupSelection: true })
    const granted = await window.electronAPI.requestAccessibility()
    setAccessibilityGranted(granted)
    setRequested(true)
  }

  const hotkey = settings ? prettyHotkey(settings.hotkey) : '⌘ ⇧ Space'

  return (
    <div className="flex h-screen flex-col bg-neutral-900 p-7 text-white">
      <h1 className="text-xl font-semibold">Welcome to PopDict</h1>
      <p className="mt-1 text-sm text-white/60">A dictionary one keystroke away.</p>

      <div className="mt-6 space-y-5">
        <div>
          <h2 className="text-sm font-medium">1 · Open it anywhere</h2>
          <p className="mt-1 text-sm text-white/70">
            Press{' '}
            <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-xs">{hotkey}</kbd>{' '}
            to pop up the search box from any app. Press Esc to dismiss it.
          </p>
        </div>

        <div>
          <h2 className="text-sm font-medium">2 · Look up what you’re reading</h2>
          <p className="mt-1 text-sm text-white/70">
            Select a word in any app, then press the hotkey to search it instantly.
            This needs macOS Accessibility permission.
          </p>
          <button
            onClick={enableSelection}
            disabled={accessibilityGranted}
            className="mt-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {accessibilityGranted ? 'Selection lookup enabled' : 'Enable selection lookup'}
          </button>
          {requested && !accessibilityGranted && (
            <p className="mt-2 text-xs text-white/50">
              Grant PopDict access in System Settings → Privacy &amp; Security →
              Accessibility, then relaunch PopDict.
            </p>
          )}
        </div>

        <div>
          <h2 className="text-sm font-medium">3 · Save words to review</h2>
          <p className="mt-1 text-sm text-white/70">
            Sign in with Google (optional — only needed to save) and tap Save on any
            result. Review them anytime from the tray → Saved Words.
          </p>
        </div>
      </div>

      <div className="mt-auto flex justify-end pt-6">
        <button
          onClick={() => window.electronAPI.finishOnboarding()}
          className="rounded-md border border-white/20 px-4 py-2 text-sm text-white/90 transition hover:bg-white/10"
        >
          Get started
        </button>
      </div>
    </div>
  )
}
