import { describe, it, expect } from 'vitest'
import { parseKrdictXml } from '../../../supabase/functions/krdict/mapper'
import type { DictionaryResult } from '../../types/dictionary'

// Trimmed real response shape: krdict /api/search with translated=y&trans_lang=1.
// 사과 returns homonyms as SEPARATE <item>s (apple vs apology) that the mapper
// must merge into one entry per headword.
const FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<channel>
  <title>한국어기초사전 오픈 API - 사전 검색</title>
  <total>2</total>
  <start>1</start>
  <num>10</num>
  <item>
    <target_code>32750</target_code>
    <word>사과</word>
    <sup_no>1</sup_no>
    <pos>명사</pos>
    <link>https://krdict.korean.go.kr/kor/dicSearch/SearchView?ParaWordNo=32750</link>
    <sense>
      <sense_order>1</sense_order>
      <definition>사과나무의 열매.</definition>
      <translation>
        <trans_lang>영어</trans_lang>
        <trans_word>apple</trans_word>
        <trans_dfn>The fruit of the apple tree.</trans_dfn>
      </translation>
    </sense>
  </item>
  <item>
    <target_code>32751</target_code>
    <word>사과</word>
    <sup_no>2</sup_no>
    <pos>명사</pos>
    <link>https://krdict.korean.go.kr/kor/dicSearch/SearchView?ParaWordNo=32751</link>
    <sense>
      <sense_order>1</sense_order>
      <definition>자신의 잘못을 인정하고 용서해 달라고 빎.</definition>
      <translation>
        <trans_lang>영어</trans_lang>
        <trans_word>apology</trans_word>
        <trans_dfn>An act of acknowledging one's fault and asking for forgiveness.</trans_dfn>
      </translation>
    </sense>
  </item>
</channel>`

const MULTI_SENSE_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<channel>
  <total>1</total>
  <item>
    <word>먹다</word>
    <pos>동사</pos>
    <sense>
      <sense_order>1</sense_order>
      <definition>음식을 입에 넣어 삼키다.</definition>
      <translation>
        <trans_lang>영어</trans_lang>
        <trans_word>eat</trans_word>
        <trans_dfn>To put food in one's mouth and swallow it.</trans_dfn>
      </translation>
    </sense>
    <sense>
      <sense_order>2</sense_order>
      <definition>담배를 피우다.</definition>
      <translation>
        <trans_lang>영어</trans_lang>
        <trans_word>smoke</trans_word>
        <trans_dfn>To smoke a cigarette.</trans_dfn>
      </translation>
    </sense>
  </item>
</channel>`

describe('parseKrdictXml', () => {
  it('is structurally a DictionaryResult[]', () => {
    const results: DictionaryResult[] = parseKrdictXml(FIXTURE) // compile-time assertion
    expect(Array.isArray(results)).toBe(true)
  })

  it('merges homonym items into one entry per headword', () => {
    const results = parseKrdictXml(FIXTURE)
    expect(results).toHaveLength(1)
    expect(results[0].word).toBe('사과')
    expect(results[0].meanings).toHaveLength(1) // both homonyms are 명사 → one noun group
    expect(results[0].meanings[0].partOfSpeech).toBe('noun')
    expect(results[0].meanings[0].definitions.map((d) => d.definition)).toEqual([
      'apple — The fruit of the apple tree.',
      'apology — An act of acknowledging one\'s fault and asking for forgiveness.',
    ])
  })

  it('collects multiple senses of one item and maps Korean POS names', () => {
    const results = parseKrdictXml(MULTI_SENSE_FIXTURE)
    expect(results).toHaveLength(1)
    expect(results[0].meanings[0].partOfSpeech).toBe('verb')
    expect(results[0].meanings[0].definitions).toEqual([
      { definition: 'eat — To put food in one\'s mouth and swallow it.' },
      { definition: 'smoke — To smoke a cigarette.' },
    ])
  })

  it('falls back to the Korean definition when no translation exists', () => {
    const xml = `<channel><total>1</total><item><word>테스트</word><pos>명사</pos>
      <sense><sense_order>1</sense_order><definition>시험.</definition></sense>
    </item></channel>`
    const results = parseKrdictXml(xml)
    expect(results[0].meanings[0].definitions[0].definition).toBe('시험.')
  })

  it('keeps an unknown POS as-is', () => {
    const xml = `<channel><total>1</total><item><word>테스트</word><pos>신품사</pos>
      <sense><definition>x.</definition>
        <translation><trans_lang>영어</trans_lang><trans_word>test</trans_word></translation>
      </sense>
    </item></channel>`
    expect(parseKrdictXml(xml)[0].meanings[0].partOfSpeech).toBe('신품사')
  })

  it('uses trans_word alone when trans_dfn is missing', () => {
    const xml = `<channel><total>1</total><item><word>테스트</word><pos>명사</pos>
      <sense><definition>x.</definition>
        <translation><trans_lang>영어</trans_lang><trans_word>test</trans_word></translation>
      </sense>
    </item></channel>`
    expect(parseKrdictXml(xml)[0].meanings[0].definitions[0].definition).toBe('test')
  })

  it('returns [] for an empty result set or unexpected XML', () => {
    expect(parseKrdictXml('<channel><total>0</total></channel>')).toEqual([])
    expect(parseKrdictXml('<error><error_code>020</error_code></error>')).toEqual([])
    expect(parseKrdictXml('not xml at all')).toEqual([])
  })
})
