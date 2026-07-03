import { app, shell } from 'electron'
import {
  buildFeedbackIssueUrl,
  DEFAULT_FEEDBACK_REPO,
  type FeedbackOpenResult,
  type FeedbackPayload,
} from '../shared/feedback'

// Baked in at build time so a release can wire feedback without editing source:
//   POPDICT_GITHUB_REPO=owner/repo npm run release:arm64
const GITHUB_REPO = process.env.POPDICT_GITHUB_REPO || DEFAULT_FEEDBACK_REPO

/** Open a prefilled GitHub Issues feedback form. */
export async function openFeedback(
  payload: FeedbackPayload = {}
): Promise<FeedbackOpenResult> {
  try {
    const url = buildFeedbackIssueUrl(payload, {
      repo: GITHUB_REPO,
      version: app.getVersion(),
      platform: process.platform,
    })
    await shell.openExternal(url)
    return { ok: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not open the feedback link.'
    console.warn(message)
    return { ok: false, message }
  }
}
