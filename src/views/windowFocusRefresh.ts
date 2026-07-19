type FocusTarget = {
  addEventListener: (type: 'focus', listener: () => void) => void
  removeEventListener: (type: 'focus', listener: () => void) => void
}

export function subscribeWindowFocus(target: FocusTarget, refresh: () => void): () => void {
  target.addEventListener('focus', refresh)
  return () => target.removeEventListener('focus', refresh)
}
