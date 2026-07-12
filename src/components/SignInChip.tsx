import { shouldShowSignInNudge } from './signInNudge'

interface SignInChipProps {
  dismissedAt: number | null
  lookupCount: number
  onDismiss: () => void
  onSignIn: () => void
  signedIn: boolean
}

/** Signed-out mirror of ReviewChip: invite sign-in once lookups prove value. */
export default function SignInChip({
  dismissedAt,
  lookupCount,
  onDismiss,
  onSignIn,
  signedIn,
}: SignInChipProps): JSX.Element | null {
  if (!shouldShowSignInNudge({ signedIn, lookupCount, dismissedAt })) return null
  return (
    <div className="review-nudge signin-nudge">
      <button
        type="button"
        className="signin-nudge__main"
        onClick={onSignIn}
        aria-label="Sign in to start saving words"
      >
        <span className="review-nudge__count">
          {lookupCount} lookups — save the words you look up
        </span>
        <span className="review-nudge__cta">Sign in →</span>
      </button>
      <button
        type="button"
        className="signin-nudge__dismiss"
        onClick={onDismiss}
        aria-label="Dismiss sign-in suggestion"
        title="Dismiss"
      >
        ✕
      </button>
    </div>
  )
}
