import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'

export type SessionCard = {
  questionId: string
  kind: 'recognition' | 'cloze'
  prompt: string
  options: string[]
}
export type QuizSession = { quizId: string | null; cards: SessionCard[] }
export type StudyCard = { definition: string; examples: string[]; similar: { phrase: string; nuance: string }[] }
export type AnswerResult = {
  word: string
  correct: boolean
  correctAnswer: string
  streak: number
  alreadyAnswered: boolean
  material: StudyCard | null
}

/** Calls the authed quiz edge actions; the user JWT is attached by functions.invoke. */
export class QuizSessionService {
  constructor(private client: SupabaseClient | null = supabase) {}

  async dueCount(): Promise<number> {
    if (!this.client) return 0
    const { data, error } = await this.client.functions.invoke('quiz', { body: { action: 'count' } })
    if (error || !data || typeof data.due !== 'number') return 0
    return data.due
  }

  async startSession(): Promise<QuizSession> {
    if (!this.client) return { quizId: null, cards: [] }
    const { data, error } = await this.client.functions.invoke('quiz', { body: { action: 'session' } })
    if (error || !data) throw new Error('session_failed')
    return { quizId: data.quizId ?? null, cards: Array.isArray(data.cards) ? data.cards : [] }
  }

  async answer(questionId: string, choiceIndex: number): Promise<AnswerResult> {
    if (!this.client) throw new Error('not_configured')
    const { data, error } = await this.client.functions.invoke('quiz', {
      body: { action: 'answer', q: questionId, c: choiceIndex },
    })
    if (error || !data) throw new Error('answer_failed')
    return data as AnswerResult
  }
}
