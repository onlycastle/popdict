import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Use — PopDict',
  description: 'Terms for using PopDict.',
}

export default function Terms() {
  return (
    <main className="container prose">
      <h1>Terms of Use</h1>
      <p className="updated">Last updated: July 14, 2026</p>

      <p>
        PopDict’s English dictionary and signed-in translations are free. The software
        is provided “as is,” without warranty of any kind, and its application source
        code is available under the MIT License.
      </p>

      <h2>Dictionary data</h2>
      <p>
        English definitions and translations come from third-party dictionary sources;
        their accuracy, completeness, and availability are not guaranteed. Do not rely
        on dictionary output for legal, medical, financial, or other high-stakes
        decisions.
      </p>
      <p>
        The generated PopDict translation dataset and normalized NGSL-GR headword list
        are licensed separately from the application code under Creative Commons
        Attribution-ShareAlike 4.0. You may reuse and adapt that data under the license,
        including its attribution and share-alike requirements. See the Licenses page
        and bundled notices for source and transformation details.
      </p>

      <h2>Acceptable use</h2>
      <p>
        Don’t attempt to abuse, overload, interfere with, or gain unauthorized access to
        the backend services PopDict relies on.
      </p>

      <h2>Third-party services</h2>
      <p>
        Definitions come from the Free Dictionary API. Authentication, saved words, and
        read-only translation access are provided by Supabase. Optional quiz email
        delivery is provided by Resend, and downloads are distributed by GitHub.
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
