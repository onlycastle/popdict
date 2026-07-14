/** Apply preference changes whenever the popup regains focus. */
export function handleSearchWindowFocus(refreshSettings: () => void, focusInput: () => void): void {
  refreshSettings()
  focusInput()
}
