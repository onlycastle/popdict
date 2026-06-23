import { describe, expect, it } from 'vitest'
import { sanitizeSelection } from './selection'

describe('sanitizeSelection', () => {
  it('accepts a single word', () => {
    expect(sanitizeSelection('serendipity')).toBe('serendipity')
  })

  it('accepts a short phrase and collapses whitespace', () => {
    expect(sanitizeSelection('  kick   the\n bucket ')).toBe('kick the bucket')
  })

  it('rejects empty or whitespace-only selections', () => {
    expect(sanitizeSelection('')).toBeNull()
    expect(sanitizeSelection('   \n\t ')).toBeNull()
  })

  it('rejects selections with no letters', () => {
    expect(sanitizeSelection('12345')).toBeNull()
    expect(sanitizeSelection('!!! ...')).toBeNull()
  })

  it('rejects paragraph-length selections', () => {
    expect(sanitizeSelection('word '.repeat(40))).toBeNull()
  })
})
