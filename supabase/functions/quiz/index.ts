// PopDict quiz emails (Supabase Edge Function, Deno runtime).
//
//   send        daily Vercel Cron (via site /api/cron/quiz) posts {action:'send'}
//               with x-quiz-token; users whose weekly quiz is due get an email
//               of multiple-choice questions built from their saved words.
//   answer      email links land on popdict.space/quiz/answer, which calls
//               GET ?action=answer&q=<question-uuid>&c=<choice>. The uuid is the
//               capability token. Records the answer, updates Leitner state
//               and streak, returns the outcome for the result page.
//   unsubscribe GET ?action=unsubscribe&u=<token> — flips enabled off.
//
// Deploy:  supabase functions deploy quiz --no-verify-jwt
// Secrets: supabase secrets set RESEND_API_KEY=... QUIZ_SEND_TOKEN=...
// Optional: QUIZ_LINK_BASE (default https://popdict.space),
//           QUIZ_FROM (default PopDict <quiz@mail.popdict.space>)

// @ts-ignore - resolved by the Deno runtime, not the app's tsc
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  buildQuestions,
  buildQuizEmailHtml,
  leitnerNext,
  nextStreak,
  type QuestionWithId,
  type ReviewRow,
  type SavedWordRow,
  selectDueWords,
} from './lib.ts'

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
  env: { get: (key: string) => string | undefined }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function admin() {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('supabase env missing')
  return createClient(url, key)
}

function linkBase(): string {
  return Deno.env.get('QUIZ_LINK_BASE') ?? 'https://popdict.space'
}

async function sendEmail(to: string, subject: string, html: string, unsubscribeUrl: string) {
  const key = Deno.env.get('RESEND_API_KEY')
  if (!key) throw new Error('RESEND_API_KEY missing')
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: Deno.env.get('QUIZ_FROM') ?? 'PopDict <quiz@mail.popdict.space>',
      to: [to],
      subject,
      html,
      headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>` },
    }),
  })
  if (!res.ok) throw new Error(`resend failed: ${res.status} ${await res.text()}`)
}

async function handleSend(req: Request): Promise<Response> {
  if (req.headers.get('x-quiz-token') !== Deno.env.get('QUIZ_SEND_TOKEN')) {
    return json({ error: 'unauthorized' }, 401)
  }
  const db = admin()
  const now = new Date()
  const cutoff = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString()

  const { data: duePrefs, error: prefsError } = await db
    .from('quiz_preferences')
    .select('user_id, unsubscribe_token, last_sent_at')
    .eq('enabled', true)
    .or(`last_sent_at.is.null,last_sent_at.lt.${cutoff}`)
    .order('last_sent_at', { ascending: true, nullsFirst: true })
    .limit(200)
  if (prefsError) return json({ error: 'prefs query failed' }, 500)

  // One distractor pool per run, shared across users.
  const { data: poolRows, error: poolError } = await db.rpc('random_en_ko', { n: 60 })
  if (poolError) return json({ error: 'distractor pool failed' }, 500)
  const distractorPool: string[] = (poolRows ?? []).map((r: { ko: string[] }) => r.ko[0])

  let sent = 0
  let skipped = 0
  for (const pref of duePrefs ?? []) {
    try {
      const [{ data: saved }, { data: reviews }] = await Promise.all([
        db.from('saved_words').select('word, normalized_word, created_at').eq('user_id', pref.user_id),
        db.from('word_reviews').select('normalized_word, box, next_due_at').eq('user_id', pref.user_id),
      ])
      const candidates = selectDueWords(
        (saved ?? []) as SavedWordRow[],
        (reviews ?? []) as ReviewRow[],
        now
      )
      if (candidates.length === 0) { skipped++; continue }

      const { data: rows } = await db
        .from('en_ko_translations')
        .select('word, ko')
        .in('word', candidates.map((c) => c.normalized_word))
      const translations = new Map<string, string[]>(
        (rows ?? []).map((r: { word: string; ko: string[] }) => [r.word, r.ko])
      )
      const questions = buildQuestions(candidates, translations, distractorPool, Math.random)
      if (questions.length < 2) { skipped++; continue }

      const { data: userRes, error: userError } = await db.auth.admin.getUserById(pref.user_id)
      const email = userRes?.user?.email
      if (userError || !email) { skipped++; continue }

      const { data: quiz, error: quizError } = await db
        .from('quizzes').insert({ user_id: pref.user_id }).select('id').single()
      if (quizError || !quiz) { skipped++; continue }

      const { data: inserted, error: qError } = await db
        .from('quiz_questions')
        .insert(questions.map((q) => ({
          quiz_id: quiz.id,
          user_id: pref.user_id,
          word: q.word,
          normalized_word: q.normalized_word,
          options: q.options,
          correct_index: q.correct_index,
        })))
        .select('id, word, normalized_word, options, correct_index')
      if (qError || !inserted) {
        await db.from('quizzes').delete().eq('id', quiz.id)
        skipped++
        continue
      }

      const unsubscribeUrl = `${linkBase()}/quiz/unsubscribe?u=${pref.unsubscribe_token}`
      const html = buildQuizEmailHtml({
        questions: inserted as QuestionWithId[],
        linkBase: linkBase(),
        unsubscribeUrl,
      })
      try {
        await sendEmail(email, `Your PopDict quiz — ${inserted.length} words`, html, unsubscribeUrl)
      } catch (e) {
        console.error('send failed', pref.user_id, e)
        await db.from('quizzes').delete().eq('id', quiz.id) // cascades to questions
        skipped++
        continue
      }

      const { error: markError } = await db
        .from('quiz_preferences')
        .update({ last_sent_at: now.toISOString(), updated_at: now.toISOString() })
        .eq('user_id', pref.user_id)
      if (markError) console.error('CRITICAL: quiz sent but last_sent_at not marked — duplicate risk', pref.user_id, markError)
      sent++
    } catch (e) {
      console.error('quiz user failed', pref.user_id, e)
      skipped++
    }
  }
  return json({ ok: true, sent, skipped })
}

async function handleAnswer(url: URL): Promise<Response> {
  const q = url.searchParams.get('q') ?? ''
  const cRaw = url.searchParams.get('c')
  const c = cRaw === null || cRaw.trim() === '' ? NaN : Number(cRaw)
  if (!UUID_RE.test(q) || !Number.isInteger(c) || c < 0 || c > 3) {
    return json({ error: 'bad_request' }, 400)
  }
  const db = admin()
  const now = new Date()

  const { data: question } = await db
    .from('quiz_questions')
    .select('id, quiz_id, user_id, word, normalized_word, options, correct_index, chosen_index, answered_at')
    .eq('id', q)
    .maybeSingle()
  if (!question) return json({ error: 'not_found' }, 404)

  const { data: pref } = await db
    .from('quiz_preferences').select('streak').eq('user_id', question.user_id).maybeSingle()
  let streak = pref?.streak ?? 0

  if (question.answered_at) {
    return json({
      word: question.word,
      correct: question.chosen_index === question.correct_index,
      correctAnswer: question.options[question.correct_index],
      streak,
      alreadyAnswered: true,
    })
  }

  const correct = c === question.correct_index
  await db
    .from('quiz_questions')
    .update({ chosen_index: c, answered_at: now.toISOString() })
    .eq('id', question.id)

  const { data: review } = await db
    .from('word_reviews')
    .select('box').eq('user_id', question.user_id).eq('normalized_word', question.normalized_word)
    .maybeSingle()
  const next = leitnerNext(review?.box ?? 1, correct)
  await db.from('word_reviews').upsert({
    user_id: question.user_id,
    normalized_word: question.normalized_word,
    box: next.box,
    next_due_at: new Date(now.getTime() + next.days * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: now.toISOString(),
  }, { onConflict: 'user_id,normalized_word' })

  // First answer of this quiz bumps the streak.
  const { data: quiz } = await db
    .from('quizzes').select('id, sent_at, answered_at').eq('id', question.quiz_id).single()
  if (quiz && !quiz.answered_at) {
    await db.from('quizzes').update({ answered_at: now.toISOString() }).eq('id', quiz.id)
    const { data: prev } = await db
      .from('quizzes')
      .select('answered_at')
      .eq('user_id', question.user_id)
      .lt('sent_at', quiz.sent_at)
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    streak = nextStreak(prev ? Boolean(prev.answered_at) : null, streak)
    await db.from('quiz_preferences').update({ streak, updated_at: now.toISOString() }).eq('user_id', question.user_id)
  }

  return json({
    word: question.word,
    correct,
    correctAnswer: question.options[question.correct_index],
    streak,
    alreadyAnswered: false,
  })
}

async function handleUnsubscribe(url: URL): Promise<Response> {
  const token = url.searchParams.get('u') ?? ''
  if (UUID_RE.test(token)) {
    await admin()
      .from('quiz_preferences')
      .update({ enabled: false, updated_at: new Date().toISOString() })
      .eq('unsubscribe_token', token)
  }
  return json({ ok: true }) // idempotent; no signal for token probing
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url)
  try {
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}))
      if (body.action === 'send') return await handleSend(req)
      return json({ error: 'unknown action' }, 400)
    }
    if (req.method === 'GET') {
      if (url.searchParams.get('action') === 'answer') return await handleAnswer(url)
      if (url.searchParams.get('action') === 'unsubscribe') return await handleUnsubscribe(url)
      return json({ error: 'unknown action' }, 400)
    }
    return json({ error: 'method not allowed' }, 405)
  } catch (e) {
    console.error(e)
    return json({ error: 'internal error' }, 500)
  }
})
