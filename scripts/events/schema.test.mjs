import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migrationPath =
  'supabase/migrations/20260719121825_expand_product_event_allowlist.sql'

function eventNamesFromTypeScript(path) {
  const source = readFileSync(path, 'utf8')
  const block = source.match(/export const PRODUCT_EVENT_NAMES = \[([\s\S]*?)\] as const/)
  if (!block) throw new Error(`PRODUCT_EVENT_NAMES not found in ${path}`)
  return [...block[1].matchAll(/'([^']+)'/g)].map((match) => match[1])
}

function eventNamesFromMigration(path) {
  const source = readFileSync(path, 'utf8')
  const block = source.match(/event_name in \(([\s\S]*?)\)\s*\)/)
  if (!block) throw new Error(`event_name constraint not found in ${path}`)
  return [...block[1].matchAll(/'([^']+)'/g)].map((match) => match[1])
}

describe('product event schema contract', () => {
  it('keeps the renderer, Edge Function, and database allowlists identical', () => {
    const renderer = eventNamesFromTypeScript('src/services/ProductAnalytics.ts')
    const edgeFunction = eventNamesFromTypeScript('supabase/functions/events/lib.ts')
    const database = eventNamesFromMigration(migrationPath)

    expect(edgeFunction).toEqual(renderer)
    expect(database).toEqual(renderer)
  })
})
