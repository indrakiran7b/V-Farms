import { nightsBetween } from './dates'

export type PricingRuleRow = {
  id: string
  name: string
  start_date: string | null
  end_date: string | null
  nightly_inr: number
  minimum_nights: number
}

export function calculateStayQuote(rules: PricingRuleRow[], checkIn: string, checkOut: string, guests: number) {
  const nights = nightsBetween(checkIn, checkOut)
  if (nights < 1 || nights > 30) throw new Error('Stay must be between 1 and 30 nights')
  if (guests < 1 || guests > 20) throw new Error('Guest count must be between 1 and 20')

  const itemized = Array.from({ length: nights }, (_, index) => {
    const date = new Date(`${checkIn}T00:00:00+05:30`)
    date.setDate(date.getDate() + index)
    const stayDate = date.toISOString().slice(0, 10)
    const matches = rules.filter((rule) => (!rule.start_date || stayDate >= rule.start_date) && (!rule.end_date || stayDate <= rule.end_date))
    const rule = matches.sort((a, b) => Number(Boolean(b.start_date || b.end_date)) - Number(Boolean(a.start_date || a.end_date)))[0]
    if (!rule) throw new Error(`No active pricing rule covers ${stayDate}`)
    return { date: stayDate, nightlyRate: Number(rule.nightly_inr), pricingRuleId: rule.id, pricingRuleName: rule.name }
  })

  const minimumNights = Math.max(
    ...rules.filter((rule) => itemized.some((item) => item.pricingRuleId === rule.id)).map((rule) => rule.minimum_nights),
    1,
  )
  if (nights < minimumNights) throw new Error(`This rate requires a minimum stay of ${minimumNights} nights`)

  const subtotal = itemized.reduce((sum, item) => sum + item.nightlyRate, 0)
  const tax = Math.round(subtotal * 0.12 * 100) / 100
  const total = Math.round((subtotal + tax) * 100) / 100
  return {
    nights,
    ratePerNight: Math.round((subtotal / nights) * 100) / 100,
    subtotal,
    tax,
    fees: 0,
    total,
    amountDueNow: total,
    balanceDue: 0,
    currency: 'INR' as const,
    pricingRuleId: itemized[0].pricingRuleId,
    pricingRuleName: itemized[0].pricingRuleName,
    itemized,
  }
}
