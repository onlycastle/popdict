/** Visibility inputs for the search-view sign-in chip. */
export interface SignInNudgeState {
  configured: boolean
  authLoading: boolean
  signedIn: boolean
  /** null = never dismissed; undefined = settings not loaded yet. */
  dismissedAt: number | null | undefined
}

export function shouldShowSignInNudge(s: SignInNudgeState): boolean {
  return s.configured && !s.authLoading && !s.signedIn && s.dismissedAt === null
}

export function loginModalSubtitle(word: string): string {
  const trimmed = word.trim()
  return trimmed
    ? `Save “${trimmed}” now, sync it, and build a personalized weekly review.`
    : 'Sync saved words and get a personalized weekly review after five saves.'
}
