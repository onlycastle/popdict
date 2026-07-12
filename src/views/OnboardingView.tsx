import { useEffect, useState } from 'react'
import { useSupabaseAuth } from '../hooks/useSupabaseAuth'
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
  const auth = useSupabaseAuth()

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
            <span className="dict-sense-num mr-2">2</span>Make words stick
          </h2>
          <p className="mt-1.5 text-sm text-white/70">
            Sign in with Google to save words, review them in-app, and get a weekly
            study digest.
          </p>
          {auth.user ? (
            <p className="mt-3 text-sm text-white/80">Signed in as {auth.user.email} ✓</p>
          ) : (
            <>
              <button
                type="button"
                className="btn-primary mt-3"
                onClick={auth.signInWithGoogle}
                disabled={auth.loading || !auth.configured}
              >
                {auth.loading ? 'Opening Google…' : 'Sign in with Google'}
              </button>
              <p className="mt-2 text-xs text-white/45">
                {auth.error || auth.message || 'Lookups never need an account.'}
              </p>
            </>
          )}
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
