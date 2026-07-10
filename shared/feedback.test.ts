import { describe, expect, it } from 'vitest'
import { buildFeedbackIssueUrl } from './feedback'

describe('buildFeedbackIssueUrl', () => {
  it('builds a GitHub issue URL with submitted feedback details', () => {
    const url = new URL(
      buildFeedbackIssueUrl(
        {
          type: 'bug',
          message: 'Search freezes after saving a word.\nIt happens twice.',
          contact: '@popdict-user',
          context: 'Search term: serendipity',
        },
        { repo: 'onlycastle/popdict', version: '1.2.0', platform: 'darwin' }
      )
    )

    expect(`${url.origin}${url.pathname}`).toBe(
      'https://github.com/onlycastle/popdict/issues/new'
    )
    expect(url.searchParams.get('title')).toBe(
      'Bug: Search freezes after saving a word. (v1.2.0)'
    )
    expect(url.searchParams.get('body')).toContain('## Category\nBug')
    expect(url.searchParams.get('body')).toContain('## Feedback\nSearch freezes after saving')
    expect(url.searchParams.get('body')).toContain('## Contact\n@popdict-user')
    expect(url.searchParams.get('body')).toContain('## Context\nSearch term: serendipity')
    expect(url.searchParams.get('body')).toContain('PopDict 1.2.0\nPlatform: darwin')
  })

  it('falls back safely for invalid categories and empty details', () => {
    const url = new URL(
      buildFeedbackIssueUrl(
        { type: 'bad' as never, message: '   ' },
        { repo: 'https://github.com/onlycastle/popdict/', version: '', platform: '' }
      )
    )

    expect(url.searchParams.get('title')).toBe('Other: PopDict feedback (vunknown)')
    expect(url.searchParams.get('body')).toContain('## Category\nOther')
    expect(url.searchParams.get('body')).toContain('## Feedback\n_No details provided._')
    expect(url.searchParams.get('body')).toContain('PopDict unknown\nPlatform: unknown')
  })

  it('rejects invalid repository values', () => {
    expect(() =>
      buildFeedbackIssueUrl(
        { message: 'Hello' },
        { repo: 'https://example.com/not-github/repo', version: '1.2.0', platform: 'darwin' }
      )
    ).toThrow('Feedback repository is not configured.')
  })
})
