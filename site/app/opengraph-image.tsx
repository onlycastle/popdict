import { ImageResponse } from 'next/og'

// File-convention OG image: Next injects og:image (+ dimensions) automatically,
// and app/twitter-image.tsx re-exports this for the Twitter card.
export const alt = 'PopDict — a macOS dictionary one keystroke away'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Brand tokens mirror site/app/globals.css. Glyphs are kept to safe ranges
// (Latin, middle dot, em dash) so Satori's default font never renders tofu.
const PAPER = '#fcfbf9'
const INK = '#1a1714'
const INK_SOFT = '#6b6358'
const INK_FAINT = '#7a7160'
const AMBER = '#f5b05c'
const AMBER_INK = '#a85d0c'
const GLASS = '#14110d'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: PAPER,
          color: INK,
          padding: '76px 84px',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            fontSize: 26,
            letterSpacing: 6,
            color: INK_FAINT,
            fontWeight: 700,
          }}
        >
          ENGLISH DICTIONARY · macOS
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex' }}>
            <div
              style={{
                display: 'flex',
                fontSize: 148,
                fontWeight: 800,
                lineHeight: 1,
                padding: '0 6px',
                backgroundImage: `linear-gradient(transparent 60%, ${AMBER} 60%)`,
              }}
            >
              PopDict
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              marginTop: 26,
              fontSize: 38,
            }}
          >
            <span style={{ color: AMBER_INK, fontWeight: 600 }}>pop · dikt</span>
            <span style={{ color: INK_SOFT, fontStyle: 'italic', marginLeft: 20 }}>
              noun
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              fontSize: 44,
              color: INK,
              marginTop: 30,
              maxWidth: 940,
              lineHeight: 1.3,
            }}
          >
            A macOS dictionary one keystroke away — look up an English word,
            hear it, translate it, and save it to review.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: GLASS,
              color: PAPER,
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: 2,
              padding: '16px 30px',
              borderRadius: 16,
            }}
          >
            DOWNLOAD FREE · APPLE SILICON
          </div>
          <div style={{ display: 'flex', fontSize: 30, color: INK_FAINT, fontWeight: 600 }}>
            popdict.space
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
