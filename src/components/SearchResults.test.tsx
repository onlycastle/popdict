import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import SearchResults from './SearchResults'

describe('SearchResults attribution', () => {
  it('preserves and links Free Dictionary source and license metadata', () => {
    const html = renderToStaticMarkup(
      <SearchResults
        query="bank"
        loading={false}
        error={null}
        response={{
          source: 'free-dictionary',
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
        error={null}
        response={{
          source: 'free-dictionary',
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
})
