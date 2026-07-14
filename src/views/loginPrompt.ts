export type LoginPromptPurpose = 'save' | 'translate'

interface TranslationLoginPromptState {
  open: boolean
  purpose: LoginPromptPurpose
  signedIn: boolean
}

/** Translation has no pending write to close the modal after OAuth returns. */
export function shouldCloseTranslationLoginPrompt({
  open,
  purpose,
  signedIn,
}: TranslationLoginPromptState): boolean {
  return open && purpose === 'translate' && signedIn
}
