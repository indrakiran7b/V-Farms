import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { calculateStayQuote } from '../lib/booking/quote-calc'

const baseRules = [{
  id: 'rule-default',
  name: 'Standard',
  start_date: null,
  end_date: null,
  nightly_inr: 10000,
  minimum_nights: 1,
}]

describe('calculateStayQuote', () => {
  it('calculates subtotal, 12% tax, and INR total', () => {
    const quote = calculateStayQuote(baseRules, '2026-06-01', '2026-06-03', 2)
    assert.equal(quote.nights, 2)
    assert.equal(quote.subtotal, 20000)
    assert.equal(quote.tax, 2400)
    assert.equal(quote.total, 22400)
    assert.equal(quote.currency, 'INR')
    assert.equal(quote.amountDueNow, quote.total)
  })

  it('rejects stays longer than 30 nights', () => {
    assert.throws(() => calculateStayQuote(baseRules, '2026-01-01', '2026-03-05', 2), /30 nights/)
  })

  it('enforces minimum nights on matched rules', () => {
    const rules = [{ ...baseRules[0], minimum_nights: 3 }]
    assert.throws(() => calculateStayQuote(rules, '2026-06-01', '2026-06-03', 2), /minimum stay of 3/)
  })

  it('rejects guest counts outside allowed range', () => {
    assert.throws(() => calculateStayQuote(baseRules, '2026-06-01', '2026-06-02', 0), /Guest count/)
  })

  it('totals two nights at ₹25,000 with 12% tax (₹56,000)', () => {
    const rules = [{ ...baseRules[0], nightly_inr: 25000 }]
    const quote = calculateStayQuote(rules, '2026-10-29', '2026-10-31', 2)
    assert.equal(quote.nights, 2)
    assert.equal(quote.subtotal, 50000)
    assert.equal(quote.tax, 6000)
    assert.equal(quote.total, 56000)
  })
})
