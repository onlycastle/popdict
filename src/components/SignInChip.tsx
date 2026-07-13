interface SignInChipProps {
  onDismiss: () => void
  onSignIn: () => void
}

/** Signed-out mirror of ReviewChip: invites sign-in from the empty state. */
export default function SignInChip({ onDismiss, onSignIn }: SignInChipProps) {
  return (
    <div className="review-nudge signin-nudge">
      <button type="button" className="signin-nudge__main" onClick={onSignIn}>
        <span className="review-nudge__count">Save words · weekly reviews</span>
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
