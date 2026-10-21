/** Shown when the guest closes Razorpay without completing payment (dates remain held). */
export function checkoutDismissedUserMessage(): string {
  return 'Checkout was closed. Your dates are still held for a short time—you can try secure payment again when ready.'
}

/** Mirrors app/page.tsx payNow handler success gate — client must not assume Razorpay modal success. */
export function shouldShowBookingSuccessAfterVerify(httpOk: boolean, verifyBody: { status?: string; error?: string }): boolean {
  return httpOk && verifyBody.status === 'confirmed'
}

export function verifyUserMessageAfterCheckout(httpOk: boolean, verifyBody: { status?: string; error?: string; message?: string }): string {
  if (shouldShowBookingSuccessAfterVerify(httpOk, verifyBody)) return ''
  if (verifyBody.error) return verifyBody.error
  if (verifyBody.message) return verifyBody.message
  return 'Payment is pending verification.'
}

/** Verify fetch failed (timeout/offline) — never treat as confirmed. */
export function verifyNetworkFailureMessage(): string {
  return 'We could not verify payment with our server. If money was debited, contact V-Farms with your booking reference before paying again.'
}
