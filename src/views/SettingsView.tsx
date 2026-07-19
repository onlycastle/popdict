import { useEffect, useState } from 'react'
import { useSupabaseAuth } from '../hooks/useSupabaseAuth'
import type { AppSettings } from '../types/electron'
import FeedbackDialog from '../components/FeedbackDialog'
import HotkeyField from '../components/HotkeyField'
import { quizPreferences } from '../services/QuizPreferencesRepository'
import { TARGET_LANGUAGE_OPTIONS } from '../../shared/language'
import { productAnalytics } from '../services/ProductAnalytics'
import type { ReviewReminderSettings } from '../../shared/reminders'

export default function SettingsView() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [status, setStatus] = useState('')
  const [version, setVersion] = useState('')
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const auth = useSupabaseAuth()

  const [quizEnabled, setQuizEnabled] = useState<boolean | null>(null)
  const [quizError, setQuizError] = useState('')
  const [quizSaving, setQuizSaving] = useState(false)

  useEffect(() => {
    if (!auth.user) {
      setQuizEnabled(null)
      return
    }
    let cancelled = false
    quizPreferences
      .get(auth.user)
      .then((prefs) => {
        if (!cancelled) setQuizEnabled(prefs?.enabled ?? false)
      })
      .catch(() => {
        if (!cancelled) setQuizEnabled(false)
      })
    return () => {
      cancelled = true
    }
  }, [auth.user])

  const toggleQuiz = async (enabled: boolean) => {
    if (!auth.user || quizSaving) return
    setQuizSaving(true)
    setQuizEnabled(enabled) // optimistic
    setQuizError('')
    try {
      await quizPreferences.setEnabled(auth.user, enabled)
    } catch (e) {
      setQuizEnabled(!enabled)
      setQuizError(e instanceof Error ? e.message : 'Could not update quiz emails')
    } finally {
      setQuizSaving(false)
    }
  }

  useEffect(() => {
    window.electronAPI.getSettings().then(setSettings)
    window.electronAPI.getAppVersion().then(setVersion)
    return window.electronAPI.onOpenFeedback(() => setFeedbackOpen(true))
  }, [])

  if (!settings)
    return (
      <div className="window flex h-screen flex-col">
        <div className="titlebar-drag" />
        <p className="px-6 text-white/80">Loading…</p>
      </div>
    )

  const update = (patch: Partial<AppSettings>) =>
    window.electronAPI.setSettings(patch).then(setSettings)
  const updateReminder = (patch: Partial<ReviewReminderSettings>) => {
    const next = { ...settings.reviewReminders, ...patch }
    if (settings.reviewReminders.cadence === 'off' && next.cadence !== 'off') {
      void productAnalytics.track('review_reminder_enabled')
    }
    return update({ reviewReminders: next })
  }
  const accountName =
    auth.user?.user_metadata?.full_name ??
    auth.user?.user_metadata?.name ??
    auth.user?.email ??
    'Signed in'

  return (
    <div className="window flex h-screen flex-col">
      <div className="titlebar-drag" />
      <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-5">
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

        <section className="space-y-2 border-b border-white/10 pb-5">
          <h2 className="dict-label mb-1.5">Translation language</h2>
          <select
            className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/80"
            value={settings.translationLanguage ?? ''}
            onChange={(event) => update({
              translationLanguage: event.target.value
                ? event.target.value as AppSettings['translationLanguage']
                : null,
            })}
          >
            <option value="">English definitions only</option>
            {TARGET_LANGUAGE_OPTIONS.map((language) => (
              <option key={language.code} value={language.code}>{language.label}</option>
            ))}
          </select>
          <p className="text-xs text-white/45">
            Everyone sees up to three Wiktionary equivalents. The app interface stays in English.
          </p>
        </section>

        {auth.user && quizEnabled !== null && (
          <section className="space-y-2 border-b border-white/10 pb-5">
            <h2 className="dict-label mb-1.5">Word quiz</h2>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={quizEnabled}
                disabled={quizSaving}
                onChange={(e) => void toggleQuiz(e.target.checked)}
              />
              <span className="text-sm text-white/80">Weekly quiz email on your saved words</span>
            </label>
            {quizError && <p className="text-xs text-red-300">{quizError}</p>}
          </section>
        )}

        <section className="space-y-3 border-b border-white/10 pb-5">
          <div>
            <h2 className="dict-label mb-1.5">Local review reminders</h2>
            <p className="text-xs text-white/45">
              PopDict must be running for reminders to fire. Launch at Login keeps it available.
            </p>
          </div>
          {!settings.notificationsSupported && (
            <p className="notice">Notifications are not supported on this Mac.</p>
          )}
          <label className="block space-y-1">
            <span className="text-xs text-white/60">Cadence</span>
            <select
              className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/80"
              value={settings.reviewReminders.cadence}
              onChange={(event) => void updateReminder({
                cadence: event.target.value as ReviewReminderSettings['cadence'],
              })}
            >
              <option value="off">Off</option>
              <option value="daily">Daily</option>
              <option value="three-weekly">Three times weekly (Mon/Wed/Fri)</option>
              <option value="weekly">Weekly (Monday)</option>
            </select>
          </label>
          {settings.reviewReminders.cadence !== 'off' && (
            <>
              <label className="block space-y-1">
                <span className="text-xs text-white/60">Reminder time</span>
                <input
                  type="time"
                  value={settings.reviewReminders.time}
                  onChange={(event) => void updateReminder({ time: event.target.value })}
                  className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/80"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-xs text-white/60">Quiet hours start</span>
                  <input
                    type="time"
                    value={settings.reviewReminders.quietStart}
                    onChange={(event) => void updateReminder({ quietStart: event.target.value })}
                    className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/80"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs text-white/60">Quiet hours end</span>
                  <input
                    type="time"
                    value={settings.reviewReminders.quietEnd}
                    onChange={(event) => void updateReminder({ quietEnd: event.target.value })}
                    className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/80"
                  />
                </label>
              </div>
            </>
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

        <section className="space-y-2 border-t border-white/10 pt-5">
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={settings.analyticsEnabled}
              onChange={(event) => update({ analyticsEnabled: event.target.checked })}
            />
            <span>
              <span className="block text-sm text-white/80">Share anonymous product analytics</span>
              <span className="mt-1 block text-xs text-white/45">
                Sends allowlisted actions only—never lookup text, account identity, or saved words.
              </span>
            </span>
          </label>
        </section>

        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => window.electronAPI.clearHistory().then(() => setStatus('History cleared'))}
            className="text-sm text-white/70 underline"
          >
            Clear recent lookups and offline cache
          </button>
          <button
            onClick={() => setFeedbackOpen(true)}
            className="text-sm text-white/70 underline"
          >
            Send feedback
          </button>
        </div>

        {status && <p className="text-xs text-white/60">{status}</p>}
        {version && <p className="pt-2 text-xs text-white/40">PopDict v{version}</p>}
      </div>
      <FeedbackDialog
        context={version ? `Opened from Settings, PopDict v${version}` : 'Opened from Settings'}
        onClose={() => setFeedbackOpen(false)}
        open={feedbackOpen}
      />
    </div>
  )
}
