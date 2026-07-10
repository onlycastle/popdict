// Ask the quiz function to send due quiz emails, with the send token.
export async function triggerQuizSend(): Promise<Response> {
  const url = process.env.QUIZ_FN_URL
  const token = process.env.QUIZ_SEND_TOKEN
  if (!url || !token) throw new Error('quiz cron not configured')
  return fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-quiz-token': token },
    body: JSON.stringify({ action: 'send' }),
  })
}
