export type RecordPayload = {
  action: 'record'
  version: string
  asset: string
  referrer: string | null
  country: string | null
}

// Build the record payload from the incoming request's headers + resolved release.
export function deriveRecordContext(
  headers: Headers,
  release: { tag: string; assetName: string },
): RecordPayload {
  return {
    action: 'record',
    version: release.tag,
    asset: release.assetName,
    referrer: headers.get('referer'),
    country: headers.get('x-vercel-ip-country'),
  }
}

// Best-effort POST to the downloads function. Never throws: a lost analytics
// event must never surface to the user or block the download.
export async function postDownloadRecord(payload: RecordPayload): Promise<void> {
  const url = process.env.DOWNLOADS_FN_URL
  const token = process.env.DOWNLOADS_RECORD_TOKEN
  if (!url || !token) return
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-record-token': token },
      body: JSON.stringify(payload),
    })
  } catch {
    // swallow: best-effort only
  }
}
