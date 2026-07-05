import { FormEvent, useEffect, useId, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { FeedbackType } from '../../shared/feedback'

type FeedbackStatus = {
  kind: 'error' | 'success'
  text: string
}

type FeedbackOption = {
  type: FeedbackType
  label: string
}

type FeedbackDialogProps = {
  context?: string
  onClose: () => void
  open: boolean
}

const FEEDBACK_OPTIONS: FeedbackOption[] = [
  { type: 'bug', label: 'Bug' },
  { type: 'idea', label: 'Idea' },
  { type: 'dictionary', label: 'Dictionary' },
  { type: 'other', label: 'Other' },
]

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

export default function FeedbackDialog({ context, onClose, open }: FeedbackDialogProps) {
  const titleId = useId()
  const messageId = useId()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [type, setType] = useState<FeedbackType>('bug')
  const [message, setMessage] = useState('')
  const [contact, setContact] = useState('')
  const [includeContext, setIncludeContext] = useState(Boolean(context))
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState<FeedbackStatus | null>(null)

  useEffect(() => {
    if (!open) return
    setStatus(null)
    setSubmitting(false)
    setIncludeContext(Boolean(context))
    window.setTimeout(() => textareaRef.current?.focus(), 0)
  }, [context, open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      onClose()
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [onClose, open])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedMessage = message.trim()
    if (!trimmedMessage) {
      setStatus({ kind: 'error', text: 'Add a short note first.' })
      textareaRef.current?.focus()
      return
    }

    setSubmitting(true)
    setStatus(null)
    try {
      const result = await window.electronAPI.sendFeedback({
        type,
        message: trimmedMessage,
        contact: contact.trim(),
        context: includeContext ? context : '',
      })
      if ('message' in result) {
        setStatus({ kind: 'error', text: result.message })
      } else {
        setStatus({ kind: 'success', text: 'Opening GitHub...' })
        window.setTimeout(onClose, 250)
      }
    } catch (error) {
      setStatus({
        kind: 'error',
        text: error instanceof Error ? error.message : 'Could not open feedback.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="login-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose()
          }}
        >
          <motion.form
            className="login-modal feedback-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onSubmit={handleSubmit}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id={titleId} className="dict-headword text-xl">
                  Send feedback
                </h2>
                <p className="mt-1 text-sm text-white/65">A public GitHub issue will open.</p>
              </div>
              <button
                type="button"
                className="modal-icon-button"
                onClick={onClose}
                aria-label="Close feedback"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="mt-5">
              <span className="dict-label mb-2 block">Category</span>
              <div className="feedback-segments" role="tablist" aria-label="Feedback category">
                {FEEDBACK_OPTIONS.map((option) => (
                  <button
                    key={option.type}
                    type="button"
                    role="tab"
                    aria-selected={type === option.type}
                    className="feedback-segment"
                    onClick={() => setType(option.type)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="mt-4 block" htmlFor={messageId}>
              <span className="dict-label mb-2 block">Details</span>
              <textarea
                id={messageId}
                ref={textareaRef}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                className="feedback-textarea"
                placeholder="What happened or what would make this better?"
                rows={5}
              />
            </label>

            <label className="mt-4 block">
              <span className="dict-label mb-2 block">Contact</span>
              <input
                value={contact}
                onChange={(event) => setContact(event.target.value)}
                className="feedback-input"
                placeholder="Email or GitHub username (optional)"
              />
            </label>

            {context && (
              <label className="mt-4 flex items-center gap-2 text-sm text-white/75">
                <input
                  type="checkbox"
                  checked={includeContext}
                  onChange={(event) => setIncludeContext(event.target.checked)}
                />
                <span>Include current context</span>
              </label>
            )}

            {status && (
              <p className={`mt-4 text-xs ${status.kind === 'error' ? 'text-red-300' : 'text-white/60'}`}>
                {status.text}
              </p>
            )}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button type="button" className="btn-ghost text-sm" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn-primary text-sm" disabled={submitting}>
                {submitting ? 'Opening...' : 'Send feedback'}
              </button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
