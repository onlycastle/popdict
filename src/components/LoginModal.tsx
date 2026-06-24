import { AnimatePresence, motion } from 'framer-motion'

interface LoginModalProps {
  configured: boolean
  error: string
  loading: boolean
  message: string
  onClose: () => void
  onSignIn: () => void
  open: boolean
  word: string
}

export default function LoginModal({
  configured,
  error,
  loading,
  message,
  onClose,
  onSignIn,
  open,
  word,
}: LoginModalProps) {
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
            aria-labelledby="login-modal-title"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="login-modal-title" className="text-base font-semibold text-white">
                  Sign in to save
                </h2>
                <p className="mt-1 text-sm text-white/70">
                  Save "{word}" to your account.
                </p>
              </div>
              <button
                type="button"
                className="modal-icon-button"
                onClick={onClose}
                aria-label="Close login modal"
              >
                x
              </button>
            </div>

            {!configured ? (
              <p className="mt-4 rounded-md border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-100">
                Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to enable login.
              </p>
            ) : (
              <button
                type="button"
                className="mt-5 w-full rounded-md bg-white px-3 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={onSignIn}
                disabled={loading}
              >
                {loading ? 'Opening Google...' : 'Continue with Google'}
              </button>
            )}

            {(message || error) && (
              <p className={`mt-3 text-xs ${error ? 'text-red-300' : 'text-white/60'}`}>
                {error || message}
              </p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
