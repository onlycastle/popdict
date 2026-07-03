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

  useEffect(() => {
    window.electronAPI.getSettings().then(setSettings)
  }, [])

  const hotkey = settings ? prettyHotkey(settings.hotkey) : '⌘ ⇧ Space'

  return (
    <div className="window flex h-screen flex-col p-7 pt-0">
      <div className="titlebar-drag" />
      <p className="dict-label mb-2">macOS · menu-bar dictionary</p>
      <h1 className="view-title text-3xl">Welcome to PopDict</h1>
      <p className="mt-1.5 text-sm text-white/60">A dictionary one keystroke away.</p>

      <div className="mt-7 space-y-6">
        <div>
          <h2 className="view-title text-base">
            <span className="dict-sense-num mr-2">1</span>Open it anywhere
          </h2>
          <p className="mt-1.5 text-sm text-white/70">
            Press <kbd className="dict-key">{hotkey}</kbd> to pop up the search box from
            any app. Press Esc to dismiss it.
          </p>
        </div>

        <div>
          <h2 className="view-title text-base">
            <span className="dict-sense-num mr-2">2</span>Save words to review
          </h2>
          <p className="mt-1.5 text-sm text-white/70">
            Sign in with Google (optional — only needed to save) and tap Save on any
            result. Review them anytime from the tray → Saved Words.
          </p>
        </div>
      </div>

      <div className="mt-auto flex justify-end pt-6">
        <button
          onClick={() => window.electronAPI.finishOnboarding()}
          className="btn-ghost text-sm"
        >
          Get started
        </button>
      </div>
    </div>
  )
}
