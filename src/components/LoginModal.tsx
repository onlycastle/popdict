import { AnimatePresence, motion } from 'framer-motion'
import { loginModalSubtitle } from './signInNudge'
import type { TargetLanguage } from '../../shared/language'
import { targetLanguageLabel } from '../../shared/language'

interface LoginModalProps {
  configured: boolean
  error: string
  loading: boolean
  message: string
  onClose: () => void
  onSignIn: () => void
  open: boolean
  purpose?: 'save' | 'translate'
  translationLanguage?: TargetLanguage | null
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
  purpose = 'save',
  translationLanguage = null,
  word,
}: LoginModalProps) {
  const subtitle = purpose === 'translate' && translationLanguage
    ? `Sign in to see ${targetLanguageLabel(translationLanguage)} translations for “${word}”.`
    : loginModalSubtitle(word)

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
                <h2 id="login-modal-title" className="dict-headword text-xl">
                  {purpose === 'translate' ? 'Sign in to translate' : 'Sign in to save'}
                </h2>
                <p className="mt-1 text-sm text-white/70">{subtitle}</p>
              </div>
              <button
                type="button"
                className="modal-icon-button"
                onClick={onClose}
                aria-label="Close login modal"
              >
                ✕
              </button>
            </div>

            {!configured ? (
              <p className="notice mt-4">
                Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to enable login.
              </p>
            ) : (
              <button
                type="button"
                className="btn-primary mt-5 w-full"
                onClick={onSignIn}
                disabled={loading}
              >
                {loading ? 'Opening Google…' : 'Continue with Google'}
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
