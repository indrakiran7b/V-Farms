# V-Farms

A production-oriented MVP for **V-Farms**, a private five-acre dragon fruit farm and exclusive five-room retreat near Hyderabad, Telangana.

**Non-negotiable rule:** V-Farms is one property. Every overnight stay and every approved event reserves the entire estate. Individual rooms are never independently bookable.

## Stack

- Next.js 16 App Router, TypeScript, Tailwind CSS 4
- Atomic property inventory in a transactional store (development JSON ledger; Supabase SQL ready for production)
- Razorpay (test mode until live merchant credentials are supplied)
- Resend for transactional email
- Vitest + Playwright
- Vercel deployment

## Local development

```bash
npm install
copy .env.example .env.local
# Add Razorpay test keys to .env.local, then restart the dev server (Next.js only loads env at startup)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Default staff login after first boot (change immediately):

- Email: `owner@v-farms.example` or `ADMIN_BOOTSTRAP_EMAIL`
- Password: `change-me-now` or `ADMIN_BOOTSTRAP_PASSWORD`

The first process start writes `data/local-store.json`. That file is the local source of truth and is gitignored.

## Environment variables

See `.env.example`. Never commit `.env.local` or secrets.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser-safe Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only. Never expose to the client |
| `ADMIN_SESSION_SECRET` | Signs staff cookies |
| `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD` | First owner account |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` | Payments |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Checkout.js public key |
| `RESEND_API_KEY` / `EMAIL_FROM` (or `RESEND_FROM_EMAIL`) / `NOTIFY_OPS_EMAIL` | Mail |
| `CRON_SECRET` | Optional bearer token for `/api/cron/notifications` retries |

Without Razorpay keys, public checkout stays disabled with a clear guest message; holds and enquiries still work. The **owner** records verified offline payments under `/admin/payments` → **Record offline payment** (reference, INR amount, method, transaction id, received time, notes).

Without Resend keys, messages stay in the admin notification queue with a visible failure and retry.

## Payments (Razorpay test mode)

1. Create a Razorpay **test** account and generate Key ID, Key Secret, and Webhook Secret.
2. Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, and `NEXT_PUBLIC_RAZORPAY_KEY_ID`.
3. Register webhook URL `https://<your-domain>/api/webhooks/razorpay` for `payment.captured` and related events.
4. Complete a stay hold on `/stays`, pay via Checkout, and confirm the stay becomes `confirmed` only after `/api/payments/verify` or a **signed** webhook — not the browser redirect alone.
5. Review `/admin/payments` for ledger entries, exceptions (`paid_unbooked`, `amount_mismatch`, duplicates), and email delivery status.

### Reconciliation and refunds

- Open exceptions in `/admin/payments` must be resolved before treating ambiguous money as revenue.
- Only the **owner** role may record refunds (`payment.refund`). Provide gateway refund id when available; failed refunds create an exception.
- Replay webhooks in Razorpay dashboard to verify idempotent handling.

### Email

- Configure Resend with a verified domain for `EMAIL_FROM`.
- Failed sends remain in the notification queue; retry from admin or schedule `POST /api/cron/notifications` with `Authorization: Bearer $CRON_SECRET`.
- Confirmation emails are sent only after **verified** booking confirmation (not on hold creation).

### Production activation checklist

- [ ] Live Razorpay keys approved by owner (keep test keys in staging)
- [ ] Webhook secret rotated and verified on production URL
- [ ] Resend domain verified; test deliverability to Gmail/Outlook
- [ ] Legal cancellation/refund policies published (not draft placeholders)
- [ ] Manual sandbox + one production smoke payment reviewed by owner

See `docs/RAZORPAY_SANDBOX.md` for hands-on sandbox steps.

## Database

Apply `supabase/migrations/0001_init.sql` to a Supabase project. Row Level Security is enabled. Public roles can read published editorial tables only. Stays, payments, holds and audit logs have no public write policies.

Until Supabase credentials are present, the app uses the local atomic ledger in `data/local-store.json`. Availability is computed, never hardcoded as open.

## Testing

```bash
npm test
npx playwright install
npm run test:e2e
npm run lint
npm run typecheck
```

Razorpay sandbox steps are in `docs/RAZORPAY_SANDBOX.md`.

## Deployment

1. Create a Vercel project from this repository.
2. Set environment variables in the Vercel dashboard.
3. Apply Supabase migrations.
4. Configure the Razorpay webhook URL: `https://<domain>/api/webhooks/razorpay`.
5. Verify the Resend sending domain.
6. Walk `docs/RELEASE_CHECKLIST.md` before accepting live money.

## Backups

Supabase database backups do not include Storage originals. Keep a separate media backup of `public/videos` and any uploaded room photography. A daily snapshot alone does not meet the proposed one-hour RPO; purchase PITR if that target is required.

## Owner decisions

See `docs/OWNER_DECISIONS.md`. Placeholder rates, capacities and room facts are labelled as awaiting approval and must not be treated as published commercial offers.
