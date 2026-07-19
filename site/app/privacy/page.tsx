import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — PopDict',
  description: 'How PopDict handles your data.',
}

export default function Privacy() {
  return (
    <main className="container prose">
      <h1>Privacy Policy</h1>
      <p className="updated">Last updated: July 19, 2026</p>

      <p>
        PopDict is a macOS dictionary app. This policy explains what data it handles and
        why. We aim to collect as little as possible.
      </p>

      <h2>What stays on your device</h2>
      <ul>
        <li>Your recent search history and app settings (hotkey, translation language, preferences).</li>
        <li>A 90-day, 100-entry cache of successful lookups and selected-language translations for offline fallback.</li>
        <li>A local successful-lookup count used to time a one-time feedback prompt.</li>
      </ul>
      <p>This data lives only on your Mac and is never sent to us.</p>

      <h2>What we store (only if you sign in)</h2>
      <p>
        Signing in is optional and only needed to save words or use
        account-based review features. If you sign in with Google,
        our authentication provider (Supabase) stores:
      </p>
      <ul>
        <li>Your email address and Google account identifier, to authenticate you.</li>
        <li>The words you choose to save, including their displayed dictionary snapshot, tags, private notes, and review schedule.</li>
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
        (dictionaryapi.dev) to fetch English definitions. Multi-word searches also
        query PopDict’s read-only Wiktionary-derived phrase table in Supabase. If you
        select a translation language, PopDict queries its read-only translation table
        for the successfully resolved English word whether or not you are signed in.
        Lookups are not tied to your PopDict identity, and PopDict does not send words
        to a live translation vendor.
      </p>

      <h2>Analytics</h2>
      <p>
        When anonymous product analytics are enabled, PopDict sends only an allowlisted
        event name (for example, successful lookup, sign-in started, sign-in completed,
        first word saved, or feedback submitted), the app version, platform, and random
        per-app-launch session and event identifiers to Supabase. Event records do not
        contain the word you looked up, a saved word, your email, or your account ID.
        You can turn this setting off at any time in Settings.
      </p>
      <p>
        To protect the public analytics and feedback endpoints from abuse, we
        derive a one-hour rate-limit key from the request’s network address. We
        store only the keyed hash, hour, endpoint name, and request count—not the
        raw network address—and remove old buckets after 48 hours of subsequent
        endpoint activity.
      </p>
      <p>
        This website uses privacy-friendly, cookieless Vercel Web Analytics to count
        visits. When you use a website download button, we also record the release and
        asset, referring site hostname, coarse country code, and tagged button source;
        GitHub separately counts delivery of the release asset.
      </p>

      <h2>Feedback</h2>
      <p>
        You can send feedback privately without an account. We store the category,
        message, optional contact information, app version and platform in Supabase. If
        PopDict offers current search context, it is included only when the checkbox in
        the feedback form is selected. Feedback is not automatically published to a
        GitHub issue.
      </p>

      <h2>Deleting your data</h2>
      <p>
        You can remove saved words at any time from the Saved Words window in the app. To
        delete your account and all associated data, contact us at the address below.
      </p>

      <h2>Sharing</h2>
      <p>
        We do not sell your data. Data is processed only by the service providers named
        above (Supabase, Free Dictionary, Resend, GitHub, Vercel, Slack when
        operational notifications are enabled, and our website host) to
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
