import type { TargetLanguage } from '../../shared/language'
import type { TranslationState } from '../hooks/useTranslations'

export type TranslationPanelState = 'hidden' | 'gated' | 'loading' | 'ready' | 'error'

export function translationPanelState(input: {
  language: TargetLanguage | null
  canonicalWord: string | null
  authLoading: boolean
  signedIn: boolean
  lookupStatus: TranslationState['status']
}): TranslationPanelState {
  if (!input.language || !input.canonicalWord || input.authLoading) return 'hidden'
  if (!input.signedIn) return 'gated'
  if (input.lookupStatus === 'loading') return 'loading'
  if (input.lookupStatus === 'ready') return 'ready'
  if (input.lookupStatus === 'error') return 'error'
  return 'hidden'
}
