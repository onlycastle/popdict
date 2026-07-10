import { app } from 'electron'
import * as path from 'path'
import type { Logger } from '../../shared/logger'
import { AUTH_PROTOCOL, describeAuthUrl, isAuthCallbackUrl, isQuizDeepLink } from '../../shared/authUrl'
import type { AuthCallbackBroker } from './AuthCallbackBroker'
import type { WindowManager } from '../windows/WindowManager'

/** Register popdict:// as this app's protocol client (dev + packaged paths). */
export function registerAuthProtocol(log: Logger): void {
  if (process.defaultApp && process.argv.length >= 2) {
    const ok = app.setAsDefaultProtocolClient(AUTH_PROTOCOL, process.execPath, [
      path.resolve(process.argv[1]),
    ])
    log.event('register protocol default app', { ok, protocol: AUTH_PROTOCOL })
    return
  }

  const ok = app.setAsDefaultProtocolClient(AUTH_PROTOCOL)
  log.event('register protocol packaged app', { ok, protocol: AUTH_PROTOCOL })
}

/**
 * Wire deep-link delivery: macOS routes callbacks through `open-url`; on a
 * second launch the URL arrives in argv via `second-instance`. A second launch
 * without a callback just surfaces the search window.
 */
export function installDeepLinkHandlers(deps: {
  broker: AuthCallbackBroker
  windows: WindowManager
  log: Logger
  hasSingleInstanceLock: boolean
}): void {
  const { broker, windows, log, hasSingleInstanceLock } = deps

  app.on('open-url', (event, url) => {
    event.preventDefault()
    if (isQuizDeepLink(url)) {
      log.event('macOS open-url event: quiz deep link')
      windows.open('review')
      return
    }
    log.event('macOS open-url event', describeAuthUrl(url))
    broker.receive(url)
  })

  if (hasSingleInstanceLock) {
    app.on('second-instance', (_event, argv) => {
      const quizUrl = argv.find((arg) => isQuizDeepLink(arg))
      if (quizUrl) {
        log.event('second instance quiz deep link')
        windows.open('review')
        return
      }

      const callbackUrl = argv.find((arg) => isAuthCallbackUrl(arg))
      if (callbackUrl) {
        log.event('second instance auth callback', describeAuthUrl(callbackUrl))
        broker.receive(callbackUrl)
      } else {
        log.event('second instance without auth callback')
        windows.showSearch()
      }
    })
  }
}
