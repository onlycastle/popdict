import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import TranslationCard, { wiktionaryEntryUrl } from './TranslationCard'

describe('TranslationCard', () => {
  it('renders ranked translations, sense labels, and attribution links', () => {
    const html = renderToStaticMarkup(
      <TranslationCard
        language="es"
        word="bank"
        state="ready"
        translations={[
          { text: 'banco', senseLabel: 'financial institution', rank: 1 },
          { text: 'orilla', senseLabel: 'river edge', rank: 2 },
        ]}
      />
    )
    expect(html).toContain('banco')
    expect(html).toContain('river edge')
    expect(html).toContain('English Wiktionary via Kaikki')
    expect(html).toContain('creativecommons.org/licenses/by-sa/4.0')
    expect(html).toContain(wiktionaryEntryUrl('bank'))
  })

  it('renders a retry action for failures without sign-in gating', () => {
    expect(renderToStaticMarkup(
      <TranslationCard language="ko" word="bank" state="error" onRetry={() => undefined} />
    )).toContain('Retry')
  })
})
