// The popup's only chrome: quiet icons at the right end of the search row.
// No wordmark (the popup doesn't need to announce itself) and no close button —
// Esc and clicking away both dismiss, like every macOS floating panel.
// Each control routes through the existing electronAPI bridge — no new IPC.

const ICON_PROPS = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

function BookmarkIcon() {
  return (
    <svg {...ICON_PROPS} aria-hidden="true">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function FeedbackIcon() {
  return (
    <svg {...ICON_PROPS} aria-hidden="true">
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
      <path d="M8 9h8" />
      <path d="M8 13h5" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg {...ICON_PROPS} aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

type WindowControlsProps = {
  onFeedbackClick: () => void
}

function WindowControls({ onFeedbackClick }: WindowControlsProps) {
  return (
    <div className="chrome-controls">
      <button
        type="button"
        className="icon-button"
        aria-label="Send feedback"
        title="Send feedback"
        onClick={onFeedbackClick}
      >
        <FeedbackIcon />
      </button>
      <button
        type="button"
        className="icon-button"
        aria-label="Saved words"
        title="Saved words"
        onClick={() => window.electronAPI?.openSavedWords()}
      >
        <BookmarkIcon />
      </button>
      <button
        type="button"
        className="icon-button"
        aria-label="Settings"
        title="Settings"
        onClick={() => window.electronAPI?.openSettings()}
      >
        <SettingsIcon />
      </button>
    </div>
  )
}

export default WindowControls
