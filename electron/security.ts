import { app, shell } from 'electron'

// Renderer/navigation hardening (applies to every window the app creates).
// Fuses harden the binary but do not cover renderer navigation; deny new
// windows and block in-app navigation to remote origins. External https links
// are handed to the system browser instead.
export function registerWebContentsHardening(): void {
  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      try {
        if (new URL(url).protocol === 'https:') {
          void shell.openExternal(url)
        }
      } catch {
        // ignore malformed URLs
      }
      return { action: 'deny' }
    })

    contents.on('will-navigate', (event, url) => {
      const devServer = MAIN_WINDOW_VITE_DEV_SERVER_URL
      const isDevOrigin = devServer ? url.startsWith(devServer) : false
      const isLocalFile = url.startsWith('file://')
      if (isDevOrigin || isLocalFile) return
      event.preventDefault()
      try {
        if (new URL(url).protocol === 'https:') void shell.openExternal(url)
      } catch {
        // ignore malformed URLs
      }
    })
  })
}
