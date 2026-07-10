import { AnimatePresence, motion } from 'framer-motion'

interface QuizOptInPromptProps {
  onDismiss: () => void
  onEnable: () => void
  open: boolean
}

/** One-time nudge after the 5th saved word: offer the weekly quiz email. */
export default function QuizOptInPrompt({ onDismiss, onEnable, open }: QuizOptInPromptProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="login-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <motion.div
            className="login-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="quiz-opt-in-title"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="quiz-opt-in-title" className="dict-headword text-xl">
                  Five words saved
                </h2>
                <p className="mt-1 text-sm text-white/70">
                  Want a short weekly quiz email so they stick?
                </p>
              </div>
              <button
                type="button"
                className="modal-icon-button"
                onClick={onDismiss}
                aria-label="Dismiss quiz offer"
              >
                ✕
              </button>
            </div>
            <button type="button" className="btn-primary mt-5 w-full" onClick={onEnable}>
              Send me the weekly quiz
            </button>
            <button type="button" className="btn-ghost mt-2 w-full text-sm" onClick={onDismiss}>
              Not now
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
