import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — PopDict',
  description: 'How PopDict handles your data.',
}

export default function Privacy() {
  return (
    <main className="container prose">
      <h1>Privacy Policy</h1>
      <p className="updated">Last updated: July 14, 2026</p>

      <p>
        PopDict is a macOS dictionary app. This policy explains what data it handles and
        why. We aim to collect as little as possible.
      </p>

      <h2>What stays on your device</h2>
      <ul>
        <li>Your recent search history and app settings (hotkey, translation language, preferences).</li>
      </ul>
      <p>This data lives only on your Mac and is never sent to us.</p>

      <h2>What we store (only if you sign in)</h2>
      <p>
        Signing in is optional and only needed to save words, view translations, or use
        account-based review features. If you sign in with Google,
        our authentication provider (Supabase) stores:
      </p>
      <ul>
        <li>Your email address and Google account identifier, to authenticate you.</li>
        <li>The words you choose to save, so they sync to your account.</li>
      </ul>

      <h2>Quiz emails (optional)</h2>
      <p>
        If you turn on quiz emails, we use your saved words and previously prepared
        study materials stored in Supabase to assemble a periodic vocabulary quiz and
        send it to your account email through Resend, our email delivery provider.
        Your answers are stored to schedule which words repeat. Every quiz
        email contains an unsubscribe link that takes effect immediately; you can
        also toggle quiz emails off in the app’s settings.
      </p>

      <h2>Dictionary lookups</h2>
      <p>
        When you search, the text is sent to the Free Dictionary API
        (dictionaryapi.dev) to fetch English definitions. This lookup is not tied to
        your PopDict identity. If you are signed in and select a translation language,
        PopDict queries its read-only Wiktionary-derived translation table in Supabase
        for the successfully resolved English word. PopDict does not send the word to a
        live translation vendor.
      </p>

      <h2>Analytics</h2>
      <p>
        The PopDict app sends no analytics or telemetry. This website uses privacy-
        friendly, cookieless analytics (Vercel Web Analytics) to count visits.
      </p>

      <h2>Deleting your data</h2>
      <p>
        You can remove saved words at any time from the Saved Words window in the app. To
        delete your account and all associated data, contact us at the address below.
      </p>

      <h2>Sharing</h2>
      <p>
        We do not sell your data. Data is processed only by the service providers named
        above (Supabase, Free Dictionary, Resend, GitHub, and our website host) to
        operate the app and website.
      </p>

      <h2>Contact</h2>
      <p>
        Questions? Email{' '}
        <a href="mailto:sungman.cho@originlayer.net">sungman.cho@originlayer.net</a>.
      </p>
    </main>
  )
}
