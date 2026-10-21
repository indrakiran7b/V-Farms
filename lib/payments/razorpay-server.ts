import Razorpay from 'razorpay'

export type RazorpayServerClient = {
  orders: {
    create: (params: {
      amount: number
      currency: string
      receipt: string
      notes?: Record<string, string>
    }) => Promise<{ id: string; amount: number; currency: string }>
  }
  payments: {
    fetch: (paymentId: string) => Promise<{
      id: string
      order_id: string
      amount: number
      currency: string
      status: string
    }>
  }
}

let integrationRazorpayClient: RazorpayServerClient | undefined

/** Mock Razorpay SDK for HTTP integration tests only. */
export function __integrationTestSetRazorpayClient(client: RazorpayServerClient | undefined) {
  integrationRazorpayClient = client
}

export function createRazorpayServerClient(): RazorpayServerClient {
  if (integrationRazorpayClient) return integrationRazorpayClient
  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !keySecret) {
    throw new Error('Payment gateway is not configured')
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret }) as unknown as RazorpayServerClient
}
