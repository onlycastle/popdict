import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Use — PopDict',
  description: 'Terms for using PopDict.',
}

export default function Terms() {
  return (
    <main className="container prose">
      <h1>Terms of Use</h1>
      <p className="updated">Last updated: June 23, 2026</p>

      <p>
        PopDict is provided free of charge, “as is,” without warranty of any kind. The
        software is open source under the MIT License.
      </p>

      <h2>Acceptable use</h2>
      <p>
        Use PopDict for personal dictionary lookups and vocabulary study. Don’t attempt to
        abuse, overload, or reverse the backend services it relies on.
      </p>

      <h2>Third-party services</h2>
      <p>
        Definitions come from third-party dictionary providers; their accuracy and
        availability are not guaranteed. Authentication and storage are provided by
        Supabase.
      </p>

      <h2>Liability</h2>
      <p>
        To the fullest extent permitted by law, the author is not liable for any damages
        arising from use of the software.
      </p>

      <h2>Contact</h2>
      <p>
        <a href="mailto:sungman.cho@originlayer.net">sungman.cho@originlayer.net</a>
      </p>
    </main>
  )
}
