/** Lifetime lookups before the signed-out nudge chip appears. */
export const SIGN_IN_NUDGE_THRESHOLD = 10

export interface SignInNudgeState {
  signedIn: boolean
  lookupCount: number
  dismissedAt: number | null
}

/** Show only to signed-out users past the threshold who never dismissed it. */
export function shouldShowSignInNudge(state: SignInNudgeState): boolean {
  return (
    !state.signedIn && state.dismissedAt === null && state.lookupCount >= SIGN_IN_NUDGE_THRESHOLD
  )
}
