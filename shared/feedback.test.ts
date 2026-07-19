import { describe, expect, it } from 'vitest'
import { normalizeFeedbackPayload } from './feedback'

describe('normalizeFeedbackPayload', () => {
  it('normalizes a private feedback submission without adding public issue content', () => {
    expect(normalizeFeedbackPayload({
      type: 'bug',
      message: '  Search freezes.\r\nIt happened twice.  ',
      contact: ' person@example.test ',
      context: ' Search term: serendipity ',
    })).toEqual({
      type: 'bug',
      message: 'Search freezes.\nIt happened twice.',
      contact: 'person@example.test',
      context: 'Search term: serendipity',
    })
  })

  it('falls back safely and clamps every text field', () => {
    const normalized = normalizeFeedbackPayload({
      type: 'bad' as never,
      message: 'x'.repeat(2_000),
      contact: 'y'.repeat(200),
      context: 'z'.repeat(600),
    })
    expect(normalized.type).toBe('other')
    expect(normalized.message).toHaveLength(1800)
    expect(normalized.contact).toHaveLength(160)
    expect(normalized.context).toHaveLength(500)
  })
})
