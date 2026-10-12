# Release checklist

- [ ] Owner approved room facts, event rules, map and public copy.
- [ ] G01–G14 inventory tests green, including concurrency.
- [ ] P01–P08 payment tests green, including late capture after hold expiry.
- [ ] Admin RBAC: content editor cannot refund; anonymous `/api/admin/*` is 401.
- [ ] Razorpay test-mode smoke, then live keys only after owner approval.
- [ ] Resend domain verified; failed notifications visible in admin.
- [ ] Supabase migrations applied; RLS reviewed; service role never exposed to the browser.
- [ ] Database PITR/backups purchased and restore-rehearsed. Storage media backed up separately.
- [ ] Custom domain, TLS, Sentry/uptime, and Vercel env vars set.
- [ ] Legal pages replaced with counsel-approved versions.
- [ ] One live test payment and reversal under merchant rules.
