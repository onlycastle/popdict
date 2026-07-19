import type { Metadata } from 'next'
import { Fraunces, Inter, JetBrains_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/react'
import './globals.css'

// Type system: a dictionary voice (Fraunces serif, with italics for the
// part-of-speech convention), a neutral macOS-native body (Inter), and a
// utility mono for IPA, keycaps, and labels (JetBrains Mono).
const fraunces = Fraunces({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-serif',
})
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
})
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
})

// Canonical origin. Set NEXT_PUBLIC_SITE_URL in Vercel to the domain you own
// (popdict.space). The fallback must also be a domain we control — NEVER
// popdict.app, which is an unrelated product and would hand our SEO to a stranger.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://popdict.space'

const TITLE = 'PopDict — a macOS dictionary one keystroke away'
const DESCRIPTION =
  'A menu-bar dictionary for English learners with free translations, phrases, offline fallback, saved words, and review tools.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: '%s · PopDict',
  },
  description: DESCRIPTION,
  applicationName: 'PopDict',
  authors: [{ name: 'OriginLayer, Inc.' }],
  creator: 'OriginLayer, Inc.',
  publisher: 'PopDict',
  category: 'productivity',
  keywords: [
    'macOS dictionary',
    'menu bar dictionary',
    'pop-up dictionary',
    'English learners',
    'multilingual dictionary',
    'word translation',
    'pronunciation',
    'vocabulary',
    'look up words',
    'Mac app',
  ],
  alternates: {
    canonical: '/',
  },
  // og:image and twitter:image come from app/opengraph-image.tsx and
  // app/twitter-image.tsx (file conventions) — no hand-written image strings.
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: 'PopDict',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: 'A macOS menu-bar dictionary for English learners.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
