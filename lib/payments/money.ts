/** Stored amounts and API quotes use INR (rupees). Razorpay uses integer paise. */
export function inrToRazorpayPaise(amountInr: number): number {
  return Math.round(Number(amountInr) * 100)
}

export function razorpayPaiseToInr(paise: number): number {
  return paise / 100
}

export function razorpayAmountMatchesInr(paise: number, amountInr: number): boolean {
  return paise === inrToRazorpayPaise(amountInr)
}
