export type QuotaRpcResult = {
  data: boolean | null
  error: unknown
}

export type RequestQuotaInput = {
  headers: Headers
  limit: number
  scope: 'feedback' | 'events'
  secret: string
  consume: (keyHash: string, limit: number) => Promise<QuotaRpcResult>
  now?: Date
}

function requestAddress(headers: Headers): string {
  // Supabase's gateway contract identifies the first X-Forwarded-For value as
  // the client address. Do not accept alternate caller-controlled headers.
  const candidate = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  if (!candidate) throw new Error('forwarded client address missing')
  return candidate.slice(0, 128)
}

function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function requestQuotaKey(
  headers: Headers,
  scope: 'feedback' | 'events',
  secret: string,
  now = new Date(),
): Promise<string> {
  const hour = now.toISOString().slice(0, 13)
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return hex(await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${scope}:${hour}:${requestAddress(headers)}`),
  ))
}

export async function consumeRequestQuota(input: RequestQuotaInput): Promise<boolean> {
  const keyHash = await requestQuotaKey(
    input.headers,
    input.scope,
    input.secret,
    input.now,
  )
  const { data, error } = await input.consume(keyHash, input.limit)
  if (error) throw new Error('quota check failed')
  return data === true
}
