import { hasTransactionalEmailConfig } from '@/lib/env'

export type SendEmailInput = {
  to: string
  subject: string
  html: string
}

export type SendEmailResult =
  | { ok: true; providerMessageId: string }
  | { ok: false; error: string; retryable: boolean }

export async function sendTransactionalEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (!hasTransactionalEmailConfig()) {
    return { ok: false, error: 'Transactional email is not configured', retryable: false }
  }
  const apiKey = process.env.RESEND_API_KEY!
  const from = process.env.EMAIL_FROM!
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
      }),
    })
    const body = (await response.json()) as { id?: string; message?: string }
    if (!response.ok) {
      const retryable = response.status >= 500 || response.status === 429
      return { ok: false, error: body.message ?? 'Email provider rejected the request', retryable }
    }
    if (!body.id) return { ok: false, error: 'Email provider returned no message id', retryable: false }
    return { ok: true, providerMessageId: body.id }
  } catch {
    return { ok: false, error: 'Unable to reach email provider', retryable: true }
  }
}
