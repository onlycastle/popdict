import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import SearchResults from './SearchResults'

describe('SearchResults attribution', () => {
  it('preserves and links Free Dictionary source and license metadata', () => {
    const html = renderToStaticMarkup(
      <SearchResults
        query="bank"
        loading={false}
        failure={null}
        response={{
          source: 'free-dictionary',
          provenance: 'live',
          dictionaryResults: [{
            word: 'bank',
            meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'A financial institution.' }] }],
            sourceUrls: ['https://en.wiktionary.org/wiki/bank'],
            license: {
              name: 'CC BY-SA 3.0',
              url: 'https://creativecommons.org/licenses/by-sa/3.0',
            },
          }],
        }}
      />
    )

    expect(html).toContain('https://en.wiktionary.org/wiki/bank')
    expect(html).toContain('https://creativecommons.org/licenses/by-sa/3.0')
    expect(html).toContain('CC BY-SA 3.0')
  })

  it('distinguishes pronunciation attribution from entry attribution', () => {
    const html = renderToStaticMarkup(
      <SearchResults
        query="bank"
        loading={false}
        failure={null}
        response={{
          source: 'free-dictionary',
          provenance: 'live',
          dictionaryResults: [{
            word: 'bank',
            meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'A financial institution.' }] }],
            sourceUrls: ['https://en.wiktionary.org/wiki/bank'],
            license: {
              name: 'Entry CC BY-SA',
              url: 'https://example.test/entry-license',
            },
            phonetics: [{
              audio: 'https://cdn.example.test/bank.mp3',
              sourceUrl: 'https://commons.wikimedia.org/wiki/File:En-us-bank.ogg',
              license: {
                name: 'Audio CC BY',
                url: 'https://example.test/audio-license',
              },
            }],
          }],
        }}
      />
    )

    expect(html).toContain('Entry source')
    expect(html).toContain('https://example.test/entry-license')
    expect(html).toContain('Audio source')
    expect(html).toContain('https://commons.wikimedia.org/wiki/File:En-us-bank.ogg')
    expect(html).toContain('Audio Audio CC BY')
    expect(html).toContain('https://example.test/audio-license')
  })

  it('renders every source and license for a combined phrase entry', () => {
    const html = renderToStaticMarkup(
      <SearchResults
        query="break the ice"
        loading={false}
        failure={null}
        response={{
          source: 'combined',
          provenance: 'live',
          dictionaryResults: [{
            word: 'break the ice',
            meanings: [{ partOfSpeech: 'phrase', definitions: [{ definition: 'Begin a conversation.' }] }],
            attributions: [
              {
                label: 'Wiktionary via Kaikki',
                sourceUrl: 'https://en.wiktionary.org/wiki/break_the_ice',
                license: {
                  name: 'CC BY-SA 4.0',
                  url: 'https://creativecommons.org/licenses/by-sa/4.0/',
                },
              },
              {
                label: 'Free Dictionary',
                sourceUrl: 'https://dictionaryapi.dev/',
                license: {
                  name: 'CC BY-SA 3.0',
                  url: 'https://creativecommons.org/licenses/by-sa/3.0/',
                },
              },
            ],
          }],
        }}
      />
    )

    expect(html).toContain('Wiktionary via Kaikki')
    expect(html).toContain('https://creativecommons.org/licenses/by-sa/4.0/')
    expect(html).toContain('Free Dictionary')
    expect(html).toContain('https://creativecommons.org/licenses/by-sa/3.0/')
  })

  it('shows phrase usage labels retained from Wiktionary', () => {
    const html = renderToStaticMarkup(
      <SearchResults
        query="bloody hell"
        loading={false}
        failure={null}
        response={{
          source: 'kaikki-phrases',
          provenance: 'live',
          dictionaryResults: [{
            word: 'bloody hell',
            meanings: [{ partOfSpeech: 'phrase', definitions: [{
              definition: 'An exclamation of surprise.',
              usageLabels: ['UK', 'slang', 'vulgar'],
            }] }],
          }],
        }}
      />
    )
    expect(html).toContain('UK · slang · vulgar')
  })
})
