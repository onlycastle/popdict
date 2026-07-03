// One-time ETL: kaikki.org English Wiktionary extract → en_ko_translations CSV.
//
// Usage:
//   npx vite-node scripts/build-en-ko-dataset.ts <input.jsonl[.gz]> [output.csv]
//
// Input: the "English" extract from https://kaikki.org/dictionary/English/
// (file named like kaikki.org-dictionary-English.jsonl.gz, ~2 GB). Streamed
// line-by-line, so memory stays flat. Output defaults to
// out-data/en_ko_translations.csv, loaded in the ops runbook via psql \copy.
import { createReadStream, mkdirSync, writeFileSync } from 'node:fs'
import { createGunzip } from 'node:zlib'
import { createInterface } from 'node:readline'
import { dirname } from 'node:path'
import { extractKoTranslations, mergeTranslations, toCsvLine } from '../shared/enko'

async function main(): Promise<void> {
  const [input, output = 'out-data/en_ko_translations.csv'] = process.argv.slice(2)
  if (!input) {
    console.error('Usage: npx vite-node scripts/build-en-ko-dataset.ts <input.jsonl[.gz]> [output.csv]')
    process.exit(1)
  }

  const raw = createReadStream(input)
  const stream = input.endsWith('.gz') ? raw.pipe(createGunzip()) : raw
  const lines = createInterface({ input: stream, crlfDelay: Infinity })

  const map = new Map<string, string[]>()
  let read = 0
  let malformed = 0

  for await (const line of lines) {
    read++
    if (read % 200_000 === 0) console.log(`…${read.toLocaleString()} lines, ${map.size.toLocaleString()} words so far`)
    if (!line.trim()) continue
    try {
      const extracted = extractKoTranslations(JSON.parse(line))
      if (extracted) mergeTranslations(map, extracted)
    } catch {
      malformed++
    }
  }

  const rows = [...map.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([word, ko]) => toCsvLine(word, ko))

  mkdirSync(dirname(output), { recursive: true })
  writeFileSync(output, rows.join('\n') + '\n', 'utf8')

  console.log(`Done: ${read.toLocaleString()} lines read, ${malformed} malformed skipped.`)
  console.log(`${rows.length.toLocaleString()} words with Korean translations → ${output}`)
}

void main()
