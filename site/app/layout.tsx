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

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://popdict.app'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'PopDict — a macOS dictionary one keystroke away',
  description:
    'A menu-bar dictionary for English learners. Look up any word or idiom, hear it pronounced, and save it to review — without leaving what you are reading.',
  icons: {
    icon: '/popdict-logo.png',
    apple: '/popdict-logo.png',
  },
  openGraph: {
    title: 'PopDict — a macOS dictionary one keystroke away',
    description:
      'Look up any word or idiom, hear it pronounced, and save it to review — without leaving what you are reading.',
    url: SITE_URL,
    siteName: 'PopDict',
    type: 'website',
    images: ['/popdict-logo.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PopDict — a macOS dictionary one keystroke away',
    description: 'A macOS menu-bar dictionary for English learners.',
    images: ['/popdict-logo.png'],
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
