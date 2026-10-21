# V-Farms staging end-to-end checklist

Use this document for **manual and semi-automated verification** against **staging** (Preview URL + linked Supabase + **Razorpay Test Mode**).  
Do **not** use production credentials, production Razorpay keys, or real guest PII.

**Related docs:** [staging-e2e-plan.md](./staging-e2e-plan.md) (summary tables), [ops-hardening.md](./ops-hardening.md) (rate limits, exceptions, webhooks), [schema-app-expectations.md](./schema-app-expectations.md).

---

## 0. Preflight (run once per session)

| Step | Command / action | Pass criteria | Live staging? |
|------|------------------|---------------|---------------|
| P0.1 | `pnpm run env:check` (loads `.env.local`, names only) | `publicSupabase` + `serverSupabase` true; no privileged `NEXT_PUBLIC_*` | Local env |
| P0.2 | `node scripts/verify-staging-ref.mjs uxtjpsfitsntrdrdlatk` | Both URL flags true (adjust ref if project changes) | Env vs staging ref |
| P0.3 | `npx supabase migration list` (linked) | Local versions match remote through **`20261021124500`** | **Live** Supabase metadata |
| P0.4 | `npx supabase db query --linked -f supabase/tests/ops-hardening-inspection.sql --output-format json` | Objects/columns present; **`consume_rate_limit_execute_by_role.anon` = false** after revoke migration | **Live** read-only SQL |
| P0.5 | `node scripts/verify-ops-hardening-anon-rpc.mjs` | `anonRpcAllowed: false` | **Live** anon RPC probe |
| P0.6 | Confirm deployed app build includes payment/eligibility/hardening code (Git SHA vs Vercel/GitHub Deployments) | Preview URL matches expected commit | **Live** host (not run in repo) |
| P0.7 | Razorpay Dashboard → Test Mode; webhook URL points to staging `POST /api/webhooks/razorpay` | Test keys in host env only | **Live** Razorpay config |

**Implementation map (code review reference):**

| Flow | Route / module |
|------|----------------|
| Quote | `POST /api/bookings/quote` → `lib/booking.ts` (`quoteStay`, `stayAvailabilityConflict`) |
| Hold | `POST /api/bookings/hold` → booking + `inventory_holds` |
| Create order | `POST /api/payments/create-order` → `evaluateCreateOrderEligibility`, Razorpay orders |
| Verify | `POST /api/payments/verify` → signature, gateway fetch, hold gate, confirm |
| Webhook | `POST /api/webhooks/razorpay` → raw-body HMAC, idempotent events, `processRazorpayWebhookPayload` |
| Rate limits | `middleware.ts` → `enforceApiRateLimit` → `consume_rate_limit` RPC (service role in app) |
| Notifications | `dispatchPendingBookingNotifications` + optional Resend (`RESEND_API_KEY`, `EMAIL_FROM`) |
| Admin exceptions | `/admin/payment-exceptions`, reconcile via gateway fetch only |

Mark each test: **Pass / Fail / Not run / Blocked**.

---

## 1. Quote and hold

### S1 — Valid quote

| Field | Detail |
|-------|--------|
| **Prerequisites** | Active `pricing_rules` row on staging; dates ≥ tomorrow, ≤ 30 nights; staging base URL `STAGING_BASE_URL` |
| **Action** | `POST {STAGING_BASE_URL}/api/bookings/quote` JSON: `{ "checkIn": "YYYY-MM-DD", "checkOut": "YYYY-MM-DD+2", "adults": 2, "children": 0 }` |
| **Expected HTTP** | `200`, body `{ "available": true, "quote": { ... } }` with INR totals |
| **Expected DB** | No writes |
| **Cleanup** | None |
| **Mode** | **Live staging** (or mocked: `tests/integration/http-routes.test.ts` quote case) |

### S2 — Quote conflict (optional)

| Field | Detail |
|-------|--------|
| **Prerequisites** | Existing active hold or held/confirmed booking overlapping dates (create via S3 first) |
| **Action** | Same quote POST overlapping dates |
| **Expected HTTP** | `409`, `available: false` or error |
| **Expected DB** | Unchanged |
| **Cleanup** | After S3/S4 cleanup |
| **Mode** | **Live staging** |

### S3 — Create hold

| Field | Detail |
|-------|--------|
| **Prerequisites** | S1 passed; synthetic guest (test mailbox you control, no real PII) |
| **Action** | UI: homepage → check availability → guest details → submit **or** `POST /api/bookings/hold` with `bookingInputSchema` fields + `termsAccepted: true` |
| **Expected HTTP** | `200`, `{ booking: { id, booking_reference, total_inr, ... }, hold: { expires_at } }` |
| **Expected DB** | `stay_bookings.booking_status = held`, `payment_status = unpaid`; `inventory_holds.status = active`, `expires_at ≈ now+15m` |
| **Cleanup** | Record `booking_reference` + UUID for §8; do not delete until documented |
| **Mode** | **Live staging** (mocked: integration hold test) |

---

## 2. Hold expiration and pay-after-expiry

### S4 — Create-order blocked when hold expired

| Field | Detail |
|-------|--------|
| **Prerequisites** | Hold from S3; wait until `inventory_holds.expires_at` passed **or** use read-only `node scripts/diagnose-booking-ref.mjs <ref>` to confirm hold inactive |
| **Action** | `POST /api/payments/create-order` `{ "bookingId": "<uuid>" }` |
| **Expected HTTP** | `409`, `code: "hold_expired"` (or `not_payable` if booking already expired without heal path) |
| **Expected DB** | Booking not `confirmed`; no new captured payment |
| **Cleanup** | §8 |
| **Mode** | **Live staging** (mocked: integration create-order expired hold) |

### S4b — Post-expiry availability (calendar release)

| Field | Detail |
|-------|--------|
| **Prerequisites** | S4 complete; forward migration `20261021114800` applied |
| **Action** | `POST /api/bookings/quote` same dates as expired hold |
| **Expected HTTP** | `200` available (after RPC/trigger expires stale state) |
| **Expected DB** | Expired hold/booking no longer blocks |
| **Cleanup** | §8 |
| **Mode** | **Live staging** |

---

## 3. Razorpay Test Mode — success path

### S5 — Create order

| Field | Detail |
|-------|--------|
| **Prerequisites** | S3 hold active; Razorpay **test** `RAZORPAY_KEY_ID` on staging host |
| **Action** | `POST /api/payments/create-order` `{ "bookingId": "<uuid>" }` |
| **Expected HTTP** | `200`, `keyId`, `orderId`, `amount` (paise), `currency: "INR"` |
| **Expected DB** | `payments` row `payment_status = created`, `expected_amount_inr` matches booking |
| **Cleanup** | Keep for S6; avoid duplicate test bookings where possible |
| **Mode** | **Live staging** + test keys (mocked: integration create-order) |

### S6 — Checkout + server verify (UI)

| Field | Detail |
|-------|--------|
| **Prerequisites** | S5; Razorpay Checkout.js test card (per Razorpay test docs) |
| **Action** | UI **Continue to secure payment** → complete test payment → wait for verify call |
| **Expected HTTP** | `POST /api/payments/verify` → `200`, `{ "status": "confirmed" }` |
| **Expected DB** | `stay_bookings.booking_status = confirmed`, `payment_status = captured`; `payments.payment_status = captured` |
| **UI** | Success step **only** if verify returns `confirmed` (not modal alone) |
| **Cleanup** | §8 — leave confirmed row or mark reference as archived test |
| **Mode** | **Live staging only** — **not** claimed by repo automated tests |

---

## 4. Verify edge cases

### S7 — Invalid checkout signature

| Action | `POST /api/payments/verify` valid ids, `razorpaySignature: "invalid"` |
| **Expected HTTP** | `400` |
| **Expected DB** | No confirm |
| **Mode** | Live curl **or** mocked integration test |

### S8 — Amount / currency mismatch

| Action | Tamper mock: gateway amount ≠ `expected_amount_inr` (live: only via controlled test harness; do not use prod) |
| **Expected HTTP** | `400` payment details did not match |
| **Mode** | Mocked integration (**verified in CI**); live optional |

### S9 — Duplicate verify (idempotent)

| Action | Repeat S6 verify POST with same order/payment/signature |
| **Expected HTTP** | `200`, `{ "status": "confirmed" }` both times |
| **Expected DB** | Single confirmed booking; notifications not duplicated beyond idempotency keys |
| **Mode** | Live after S6 **or** mocked integration retry test |

### S10 — Verify with missing payment row

| Action | Verify with unknown `razorpayOrderId` |
| **Expected HTTP** | `404` |
| **Mode** | Mocked integration (**verified in CI**) |

---

## 5. Webhooks

Configure Razorpay test webhook secret on staging (`RAZORPAY_WEBHOOK_SECRET`). Use Razorpay “Send test webhook” or real test payment async event.

### S11 — Valid signature + capture

| **Expected HTTP** | `200`, `{ "received": true }` (may include `confirmed`) |
| **Expected DB** | `payment_webhook_events` row; `processing_status = processed`; payload stored in `payload_json` |
| **Mode** | **Live staging** |

### S12 — Invalid webhook signature

| Action | POST raw body with wrong `x-razorpay-signature` |
| **Expected HTTP** | `400` |
| **Expected DB** | No new processed event |
| **Mode** | Live **or** mocked integration |

### S13 — Duplicate event id

| Action | Replay same body + same `x-razorpay-event-id` |
| **Expected HTTP** | Second response `{ "duplicate": true }` |
| **Expected DB** | Single event row; no double confirm |
| **Mode** | Live **or** mocked integration (**CI verified**) |

### S14 — Out-of-order failed then captured

| **Expected** | Booking ends `confirmed` only after captured event; failed alone leaves `held` |
| **Mode** | Mocked integration (**CI verified**); live optional |

---

## 6. Rate limiting (live API)

Limits (see `lib/security/rate-limit-profiles.ts`): bookings **40/15m/IP**, payments **30/15m/IP**, webhooks **200/min/IP** (+ per event-id bucket).

### S15 — Booking rate limit

| **Prerequisites** | Migration `20261021120000` + **`20261021124500`** applied; use isolated IP or lab machine |
| **Action** | >40 `POST /api/bookings/quote` from same IP within 15 minutes |
| **Expected HTTP** | `429`, `Retry-After` header, JSON error |
| **Expected DB** | Normal traffic rows only; no schema change |
| **Cleanup** | Wait window or use different IP; **do not** truncate `api_rate_limit_buckets` in prod-like staging without ops approval |
| **Mode** | **Live staging only** (RPC logic unit-tested; middleware not load-tested in CI) |

### S16 — Payment rate limit

| Action | >30 `POST /api/payments/create-order` (invalid UUIDs acceptable after limit kicks in) |
| **Expected HTTP** | `429` after threshold |
| **Mode** | **Live staging only** |

---

## 7. Captured payment after hold expiry + admin reconciliation

### S17 — Exception path (hold expired, gateway captured)

| **Setup** | Hard to trigger safely live: pay near hold expiry or use DB time manipulation **only in dedicated sandbox** (not recommended on shared staging). |
| **Expected HTTP (verify)** | `409`, `code: hold_expired`, `paymentRecorded: true` |
| **Expected DB** | `payments.payment_status = exception`, `exception_resolution_status = open`; booking **not** confirmed |
| **Mode** | Mocked integration (**CI verified**); live **manual / optional** |

### S18 — Admin exception queue

| **Prerequisites** | Admin owner session on staging |
| **Action** | Open `/admin/payment-exceptions`; list shows ref, amounts, Razorpay ids, resolution status |
| **Action (owner)** | “Reconcile via gateway” — uses Razorpay fetch; confirms **only** if captured + active hold |
| **Expected audit** | Row in `admin_audit_logs` for resolve/reconcile |
| **Mode** | **Live staging** (UI + service role) |

---

## 8. Notifications

### S19 — Queue on confirm

| **Expected DB** | After S6, `booking_notifications` rows for `email` + `sms`, `status = pending` |
| **Mode** | **Live staging** after S6 |

### S20 — Email delivery (if configured)

| **Prerequisites** | `RESEND_API_KEY` + `EMAIL_FROM` on staging |
| **Action** | Owner: `POST /api/admin/notifications/dispatch` **or** automatic dispatch after verify |
| **Expected** | Email row `status = sent`, `provider_message_id` set |
| **Mode** | **Live staging** + Resend test |

### S21 — No provider configured

| **Expected** | Rows stay `pending`; dispatch API `503` with setup message; admin notifications page still lists queue |
| **Mode** | **Live staging** env without Resend |

### S22 — Retry / dead letter

| **Mode** | Mocked `tests/hardening.test.ts` (fetch 429 → `failed`); live optional by forcing provider failure |

---

## 9. Safe cleanup (proposals — do not delete production-like rows blindly)

**Existing tools (read-only / non-destructive):**

| Script | Purpose |
|--------|---------|
| `scripts/check-staging-env.mjs` | Env presence |
| `scripts/verify-staging-ref.mjs` | Staging ref in URLs |
| `scripts/diagnose-booking-ref.mjs` | Booking/hold/payment **status fields** by reference |
| `supabase/tests/ops-hardening-inspection.sql` | Schema/permission audit |
| `scripts/verify-ops-hardening-anon-rpc.mjs` | Anon RPC probe |
| `scripts/verify-ops-hardening-anon-tables.mjs` | Anon table read probe |

**Proposed (not implemented — add when needed):**

| Proposed script | Behavior |
|-----------------|----------|
| `scripts/staging-register-test-booking.mjs` | Append `{ reference, booking_id, created_at, suite_id }` to `.staging-test-manifest.json` (gitignored) |
| `scripts/staging-cleanup-manifest.mjs` | **Owner-only**, service role: for manifest entries only, cancel held test bookings past 24h, mark payments `failed` if never captured — **never** touch rows not in manifest |
| `scripts/staging-rate-limit-smoke.mjs` | Fire N quote requests, stop at first 429, print count only |

Until manifest scripts exist: **cleanup = record references in run log**; avoid shared-date holds; prefer unique date ranges per tester.

---

## 10. Automated vs manual summary

| Category | What ran in repo (this session) | Staging live |
|----------|--------------------------------|--------------|
| Typecheck | `pnpm run typecheck` — **PASS** | N/A |
| Unit + static migration audits | **119 tests PASS** | N/A |
| Mocked HTTP integration (quote/hold/pay/verify/webhook) | **CI PASS** — not live | Not a substitute for S6/S11 |
| Production build | `pnpm run build` — **PASS** | Deploy not performed |
| Razorpay test charge | **Not run** | Requires manual S6 |
| Rate limit 429 on staging URL | **Not run** | Requires S15/S16 |
| Notification send | **Not run** | Requires S20/S21 |
| Migrations on linked staging | **`20261021124500` listed on remote** (CLI) | Re-run P0.4–P0.5 after apply |

---

## 11. Execution log template

```
Date:
Operator:
STAGING_BASE_URL:
Git SHA deployed (if known):
Razorpay mode: test
Resend configured: yes/no

| ID  | Result      | Notes |
|-----|-------------|-------|
| P0.*|             |       |
| S1  |             |       |
| ... |             |       |
```
