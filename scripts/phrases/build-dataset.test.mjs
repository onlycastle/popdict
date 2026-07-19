import { describe, expect, it } from 'vitest'
import {
  candidatesFromEntry,
  hasBannedLabel,
  normalizePhrase,
  rankCandidates,
  sqlForRows,
} from './build-dataset.mjs'

function entry(word, pos, senses) {
  return { word, pos, lang_code: 'en', senses }
}

describe('phrase dataset generation', () => {
  it('normalizes exact phrases and punctuation deterministically', () => {
    expect(normalizePhrase('  Break   a leg! ')).toBe('break a leg')
    expect(normalizePhrase('single')).toBeNull()
    expect(normalizePhrase('— —')).toBeNull()
  })

  it('includes idiomatic multi-word senses in ordinary parts of speech', () => {
    const rows = candidatesFromEntry(entry('rain cats and dogs', 'verb', [{
      glosses: ['To rain very heavily.'],
      tags: ['idiomatic', 'impersonal'],
      examples: [{ type: 'example', text: 'It rained cats and dogs.' }],
      synonyms: [{ word: 'pour' }],
    }]))
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      normalizedPhrase: 'rain cats and dogs',
      partOfSpeech: 'verb',
      definition: 'To rain very heavily.',
      usageLabels: ['idiomatic', 'impersonal'],
    })
  })

  it('includes supported phrase POS and removes retired editorial labels', () => {
    const rows = candidatesFromEntry(entry('under the weather', 'phrase', [
      { glosses: ['Feeling ill.'], tags: ['idiomatic', 'informal', 'US'] },
      { glosses: ['Old form.'], tags: ['archaic', 'vulgar'] },
      { glosses: ['Legitimate coarse sense.'], tags: ['vulgar', 'offensive'] },
    ]))
    expect(rows.map((row) => row.definition)).toEqual([
      'Feeling ill.',
      'Legitimate coarse sense.',
    ])
    expect(rows[1].usageLabels).toEqual(['vulgar', 'offensive'])
    expect(hasBannedLabel(['Northern England', 'slang'])).toBe(false)
    expect(hasBannedLabel(['nonstandard spelling'])).toBe(true)
  })

  it('deduplicates definitions, prioritizes idiomatic senses, and caps at three', () => {
    const rows = rankCandidates([
      ...candidatesFromEntry(entry('make the grade', 'phrase', [
        { glosses: ['Literal sense.'] },
        { glosses: ['Succeed.'], tags: ['idiomatic'] },
        { glosses: ['Succeed.'], tags: ['idiomatic', 'US'] },
        { glosses: ['Meet a standard.'] },
        { glosses: ['Receive a score.'] },
      ])),
    ])
    expect(rows).toHaveLength(3)
    expect(rows.map((row) => row.definition)).toEqual([
      'Succeed.',
      'Literal sense.',
      'Meet a standard.',
    ])
    expect(rows.map((row) => row.sense_rank)).toEqual([1, 2, 3])
  })

  it('emits bounded insert batches and licensed attribution fields', () => {
    const row = rankCandidates(candidatesFromEntry(entry('break a leg', 'phrase', [{
      glosses: ['Good luck.'], tags: ['idiomatic'], synonyms: [{ word: "knock 'em dead" }],
    }]))) [0]
    const sql = sqlForRows([row], {
      snapshotDate: '2026-07-09',
      wiktionaryDumpDate: '2026-07-06',
      kaikkiSha256: 'documented-fake-sha',
      phraseCount: 1,
      rowCount: 1,
    })
    expect(sql).toContain('insert into public.phrase_entries')
    expect(sql).toContain('CC BY-SA 4.0')
    expect(sql).toContain("knock ''em dead")
  })
})
