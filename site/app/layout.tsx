import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/react'
import './globals.css'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://popdict.app'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'PopDict — a macOS dictionary one keystroke away',
  description:
    'A menu-bar dictionary for English learners. Look up any word or idiom, hear it pronounced, and save it to review — without leaving what you are reading.',
  openGraph: {
    title: 'PopDict — a macOS dictionary one keystroke away',
    description:
      'Look up any word or idiom, hear it pronounced, and save it to review — without leaving what you are reading.',
    url: SITE_URL,
    siteName: 'PopDict',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PopDict — a macOS dictionary one keystroke away',
    description: 'A macOS menu-bar dictionary for English learners.',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
