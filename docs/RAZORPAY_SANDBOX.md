# Razorpay sandbox validation

Automated tests mock signature verification. They do not move money.

## Configure test mode

1. Create a Razorpay test account.
2. Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` and `NEXT_PUBLIC_RAZORPAY_KEY_ID`.
3. Point the webhook to `/api/webhooks/razorpay`.
4. Use Razorpay test UPI/cards only.

## Manual sandbox checklist

- [ ] Create a stay hold for an available weekend.
- [ ] Complete test checkout.
- [ ] Confirm the stay is `confirmed` only after `/api/payments/verify` or the signed webhook, not after the thank-you redirect.
- [ ] Replay the same webhook: booking stays confirmed once.
- [ ] Expire a hold, then capture a payment: an exception appears; the calendar is not double-booked.
- [ ] Record an owner refund with a reason.

Do not treat test payments as live income. Do not enable live keys until the owner authorizes production testing.
