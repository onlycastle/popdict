import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const schemaPath = 'supabase/migrations/20260716115322_p1_saved_words_phrases_access.sql'
const savedWordsHardeningPath =
  'supabase/migrations/20260719123529_harden_saved_word_text_arrays_and_tags.sql'
const atomicQuizPath =
  'supabase/migrations/20260719124500_atomic_quiz_answers_and_material_snapshots.sql'

async function filesUnder(root) {
  const entries = await readdir(root, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
    const path = join(root, entry.name)
    if (entry.isDirectory()) files.push(...await filesUnder(path))
    else files.push(path)
  }
  return files
}

describe('translation database boundary', () => {
  it('permits public reads while denying all client writes', async () => {
    const sql = await readFile(schemaPath, 'utf8')
    expect(sql).toMatch(/enable row level security/i)
    expect(sql).toMatch(/revoke all privileges[\s\S]*from public, anon, authenticated/i)
    expect(sql).toMatch(/grant select[\s\S]*to anon, authenticated/i)
    expect(sql).not.toMatch(/grant\s+(?:insert|update|delete)[\s\S]*to authenticated/i)
    expect(sql).toMatch(/to anon, authenticated[\s\S]*using \(true\)/i)
  })

  it('retires usage counters and leaves older phrase clients a no-upstream response', async () => {
    const [sql, idioms] = await Promise.all([
      readFile('supabase/migrations/20260714121310_remove_idiom_usage_add_word_translations.sql', 'utf8'),
      readFile('supabase/functions/idioms/index.ts', 'utf8'),
    ])
    expect(sql).toMatch(/drop table if exists public\.idiom_usage/i)
    expect(sql).toMatch(/drop function if exists public\.increment_idiom_usage/i)
    expect(sql).toMatch(/drop table if exists public\.word_glosses/i)
    expect(sql).toMatch(/drop table if exists public\.stripe_subscriptions/i)
    expect(sql).toMatch(/drop function if exists public\.claim_gloss_generation/i)
    expect(idioms).toContain("error: 'upstream_disabled'")
    expect(idioms).not.toMatch(/\bfetch\s*\(/)
    expect(idioms).not.toMatch(/Deno\.env\.get/)
  })

  it('bounds normalized tags and related-word arrays at the database boundary', async () => {
    const sql = await readFile(savedWordsHardeningPath, 'utf8')
    expect(sql).toMatch(/tag\s*=\s*trim\(regexp_replace\(tag, '\\s\+'/i)
    expect(sql).toMatch(/char_length\(tag\) between 1 and 40/i)
    expect(sql).toMatch(/cardinality\(value\) <= 20/i)
    expect(sql).toMatch(/char_length\(item\) not between 1 and 300/i)
  })

  it('records quiz answers atomically with persisted reveal material', async () => {
    const sql = await readFile(atomicQuizPath, 'utf8')
    expect(sql).toMatch(/add column if not exists material jsonb/i)
    expect(sql).toMatch(/create or replace function public\.record_quiz_answer/i)
    expect(sql).toMatch(/for update/i)
    expect(sql).toMatch(/insert into public\.word_reviews/i)
    expect(sql).toMatch(/update public\.quiz_questions/i)
    expect(sql).toMatch(/revoke all[\s\S]*from public, anon, authenticated/i)
  })

  it('contains no live Stripe, Gemini, or STANDS4 network endpoint', async () => {
    const files = (await Promise.all([
      filesUnder('src'),
      filesUnder('electron'),
      filesUnder('supabase/functions'),
      filesUnder('site/app'),
    ])).flat().filter((path) => /\.(?:ts|tsx|js|mjs)$/.test(path))
    const contents = await Promise.all(files.map((path) => readFile(path, 'utf8')))
    const runtime = contents.join('\n')
    expect(runtime).not.toMatch(/(?:checkout|billing)\.stripe\.com/i)
    expect(runtime).not.toMatch(/generativelanguage\.googleapis\.com/i)
    expect(runtime).not.toMatch(/stands4\.com/i)
  })
})
