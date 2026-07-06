import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — PopDict',
  description: 'How PopDict handles your data.',
}

export default function Privacy() {
  return (
    <main className="container prose">
      <h1>Privacy Policy</h1>
      <p className="updated">Last updated: July 5, 2026</p>

      <p>
        PopDict is a macOS dictionary app. This policy explains what data it handles and
        why. We aim to collect as little as possible.
      </p>

      <h2>What stays on your device</h2>
      <ul>
        <li>Your recent search history and app settings (hotkey, preferences).</li>
      </ul>
      <p>This data lives only on your Mac and is never sent to us.</p>

      <h2>What we store (only if you sign in)</h2>
      <p>
        Signing in is optional and only needed to save words. If you sign in with Google,
        our authentication provider (Supabase) stores:
      </p>
      <ul>
        <li>Your email address and Google account identifier, to authenticate you.</li>
        <li>The words you choose to save, so they sync to your account.</li>
      </ul>

      <h2>Quiz emails (optional)</h2>
      <p>
        If you turn on quiz emails, we use your saved words to generate a periodic
        vocabulary quiz and send it to your account email through Resend, our email
        delivery provider. The study cards and exercises in each email — definitions,
        example sentences, and quiz questions — are machine-generated using
        Anthropic’s Claude API; the saved word is sent to Anthropic to generate that
        content. Your answers are stored to schedule which words repeat. Every quiz
        email contains an unsubscribe link that takes effect immediately; you can
        also toggle quiz emails off in the app’s settings.
      </p>

      <h2>Dictionary lookups</h2>
      <p>
        When you search, the word is sent to the Free Dictionary API
        (dictionaryapi.dev) to fetch definitions. For multi-word idioms, the phrase is
        sent to our server-side function, which queries the STANDS4 phrases service. These
        lookups are not tied to your identity.
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
        above (Supabase, the dictionary providers, and our website host) to operate the
        app.
      </p>

      <h2>Contact</h2>
      <p>
        Questions? Email{' '}
        <a href="mailto:sungman.cho@originlayer.net">sungman.cho@originlayer.net</a>.
      </p>
    </main>
  )
}
