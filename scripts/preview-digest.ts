// Local digest-email preview. Renders the REAL production email
// (supabase/functions/quiz/lib.ts → buildDigestEmailHtml) to an HTML file you
// open in a browser — no Supabase, no send, no DB.
//
//   npm run preview:digest                 # default words
//   npm run preview:digest -- vivid wary   # your own words
//
// With GEMINI_API_KEY in .env.local it generates real study material; without
// it, bundled sample cards render so you can still check the layout. Runs on
// Deno (the same runtime the edge function uses).
import { buildExercise, buildDigestEmailHtml, type QuestionWithId } from '../supabase/functions/quiz/lib.ts'
import { generateStudyMaterial, type StudyMaterial } from '../supabase/functions/quiz/materials.ts'

// --- Load GEMINI_API_KEY from .env.local (npm scripts don't auto-source it). ---
try {
  const env = await Deno.readTextFile(new URL('../.env.local', import.meta.url))
  const line = env.split('\n').find((l) => l.startsWith('GEMINI_API_KEY='))
  if (line && !Deno.env.get('GEMINI_API_KEY')) {
    Deno.env.set('GEMINI_API_KEY', line.slice('GEMINI_API_KEY='.length).trim())
  }
} catch {
  // no .env.local — fall back to samples below
}

// Bundled fallbacks so the layout always renders offline / keyless.
const SAMPLES: Record<string, StudyMaterial> = {
  delight: {
    definition: 'a feeling of great pleasure and enjoyment',
    examples: ['The children squealed with delight when the puppy ran toward them.'],
    similar: [
      { phrase: 'joy', nuance: 'deeper and more lasting than delight' },
      { phrase: 'pleasure', nuance: 'more general, less intense' },
    ],
    recognition_distractors: ['a polite request for permission', 'a small decorative light', 'a sudden feeling of doubt'],
    cloze: { sentence: 'Watching the sunset was a pure delight after the long week.', distractors: ['burden', 'schedule', 'argument'] },
  },
  resilient: {
    definition: 'able to quickly recover from difficult situations',
    examples: ['Children are often more resilient than adults when facing challenges.'],
    similar: [
      { phrase: 'tough', nuance: 'more about strength than bouncing back' },
      { phrase: 'adaptable', nuance: 'about changing to fit, not recovering' },
    ],
    recognition_distractors: ['easily damaged or broken', 'unwilling to change plans', 'quick to become angry'],
    cloze: { sentence: 'The town proved remarkably resilient, rebuilding within a year of the flood.', distractors: ['fragile', 'ancient', 'crowded'] },
  },
  thorough: {
    definition: 'done carefully and completely, with attention to every detail',
    examples: ['The police conducted a thorough investigation into the incident.'],
    similar: [
      { phrase: 'detailed', nuance: 'about the amount of specifics, not the care taken' },
      { phrase: 'meticulous', nuance: 'implies extreme, sometimes fussy, care' },
    ],
    recognition_distractors: ['quick and shallow', 'careless or hasty', 'vague and imprecise'],
    cloze: { sentence: 'She gave the report a thorough review, checking every fact.', distractors: ['brief', 'quick', 'rough'] },
  },
}

const words = Deno.args.length ? Deno.args : ['delight', 'resilient', 'thorough']
const usingKey = Boolean(Deno.env.get('GEMINI_API_KEY'))
console.log(usingKey ? '· GEMINI_API_KEY found — generating real content' : '· no GEMINI_API_KEY — using bundled samples')

// Deterministic shuffle so previews are stable across runs.
const rng = (() => { let s = 42; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280 } })()

const entries: { question: QuestionWithId; material: StudyMaterial; box: number }[] = []
let i = 0
for (const word of words) {
  const w = word.trim().toLowerCase()
  const material = (usingKey ? await generateStudyMaterial(w) : null) ?? SAMPLES[w] ?? null
  if (!material) {
    console.log(`  ⚠️  skipped "${w}" (generation failed and no bundled sample)`)
    continue
  }
  // Vary the exercise type: last word shown as a cloze (box 3), rest recognition.
  const box = i === words.length - 1 ? 3 : 1
  const q = {
    ...buildExercise({ word: w, normalized_word: w, created_at: '' }, material, box, rng),
    id: `0000000${i}-0000-4000-8000-00000000000${i}`,
  } as QuestionWithId
  entries.push({ question: q, material, box })
  i++
}

if (entries.length === 0) {
  console.error('Nothing to preview.')
  Deno.exit(1)
}

const body = buildDigestEmailHtml({
  entries,
  streak: 4,
  buckets: { new: entries.length - 1, learning: 1, mastered: 0 },
  linkBase: 'https://popdict.space',
  unsubscribeUrl: 'https://popdict.space/quiz/unsubscribe?u=preview',
})
// charset matters — Resend sends UTF-8; declare it so the · and — render.
const html = `<!doctype html><html><head><meta charset="utf-8"><title>PopDict digest preview</title></head><body style="margin:0;background:#efece6;padding:24px 0;">${body}</body></html>`

const out = new URL('../preview-digest.html', import.meta.url)
await Deno.writeTextFile(out, html)
console.log(`\nWrote ${out.pathname}`)
// Best-effort auto-open on macOS.
try {
  await new Deno.Command('open', { args: [out.pathname] }).output()
} catch {
  console.log('Open it in a browser to view.')
}
