import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Unsubscribed — PopDict',
  description: 'Quiz emails are off.',
  robots: { index: false },
}

export default function Unsubscribed() {
  return (
    <main className="container prose">
      <h1>Quiz emails are off.</h1>
      <p>You can turn them back on anytime in PopDict → Settings → Word quiz.</p>
      <p>
        <a href="/">← PopDict</a>
      </p>
    </main>
  )
}
