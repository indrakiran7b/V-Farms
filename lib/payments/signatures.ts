import crypto from 'node:crypto'

export function timingSafeEqualStrings(expected: string, received: string): boolean {
  const expectedBuffer = Buffer.from(expected, 'utf8')
  const receivedBuffer = Buffer.from(received, 'utf8')
  return expectedBuffer.length === receivedBuffer.length && crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
}

export function razorpayCheckoutSignature(orderId: string, paymentId: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex')
}

export function verifyCheckoutSignature(orderId: string, paymentId: string, secret: string, receivedSignature: string): boolean {
  return timingSafeEqualStrings(razorpayCheckoutSignature(orderId, paymentId, secret), receivedSignature)
}

export function razorpayWebhookDigest(rawBody: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
}

export function verifyWebhookSignature(rawBody: string, secret: string, receivedSignature: string): boolean {
  const digest = razorpayWebhookDigest(rawBody, secret)
  return digest.length === receivedSignature.length && timingSafeEqualStrings(digest, receivedSignature)
}
