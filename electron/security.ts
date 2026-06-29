import * as path from 'node:path'
import { pathToFileURL } from 'node:url'
import { app, shell } from 'electron'
import { shouldAllowNavigation } from './navigationPolicy'

function packagedIndexFileUrl(): string {
  // Mirrors WindowManager's production load target.
  const indexPath = path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
  return pathToFileURL(indexPath).toString()
}

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
      if (
        shouldAllowNavigation(url, {
          devServerUrl: MAIN_WINDOW_VITE_DEV_SERVER_URL,
          packagedIndexFileUrl: packagedIndexFileUrl(),
        })
      ) {
        return
      }
      event.preventDefault()
      try {
        if (new URL(url).protocol === 'https:') void shell.openExternal(url)
      } catch {
        // ignore malformed URLs
      }
    })
  })
}
