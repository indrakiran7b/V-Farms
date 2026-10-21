# Staging end-to-end test plan

Run against: **staging base URL**, **staging Supabase**, **Razorpay test mode**, synthetic customer data only.

Set `STAGING_BASE_URL` and credentials in host env (see `.env.example`). Mark each row **Pass / Fail / Not run**.

## Admin auth

| # | Case | Steps | Expected |
|---|------|--------|----------|
| A1 | Login success | Valid owner/manager/staff user | Redirect to `/admin`, session cookie set |
| A2 | Login failure | Wrong password | Generic error, no account enumeration |
| A3 | Direct URL | GET `/admin/bookings` without cookie | Redirect `/admin/login` |
| A4 | Invalid role | User without `app_metadata.admin_role` | Access denied / login |
| A5 | Logout | Sign out from shell | Session cleared, `/admin/login` |
| A6 | Pricing API owner | Staff cookie → POST `/api/admin/pricing` | 403 Owner access required |

## Quote & availability

| # | Case | Expected |
|---|------|----------|
| B1 | Valid quote | POST `/api/bookings/quote` → INR breakdown |
| B2 | Invalid dates | check-out ≤ check-in → 400 |
| B3 | No pricing rule | 400 with clear message |
| B4 | Availability GET | `/api/availability?checkIn&checkOut` reflects holds/bookings |

## Holds & conflicts

| # | Case | Expected |
|---|------|----------|
| C1 | Create hold | POST `/api/bookings/hold` → booking `held`, hold ~15m |
| C2 | Expired hold | After 15m, create-order → 409 hold expired |
| C2b | Post-expiry availability | After hold window, `/api/availability` same dates → available (held row → `expired` via RPC/trigger) |
| C3 | Concurrent overlap | Two parallel holds same dates | One succeeds; other 409 / `23P01` |
| C4 | Confirmed block | Confirmed stay blocks overlapping quote | 409 / unavailable |

## Razorpay (test mode)

| # | Case | Expected |
|---|------|----------|
| D1 | Create order | POST `/api/payments/create-order` → amount in **paise**, currency INR |
| D2 | INR match | `amount === round(amount_due_now_inr * 100)` |
| D3 | Verify success | Valid test payment + POST `/api/payments/verify` | `confirmed`, booking `confirmed` |
| D4 | Invalid signature | Tampered signature → 400 |
| D5 | Failed payment | Failed gateway status → pending/failed, booking stays `held` |
| D6 | Webhook duplicate | Same `x-razorpay-event-id` twice | Second `duplicate: true` |
| D7 | Webhook bad signature | Invalid HMAC → 400 |

## Persistence & admin

| # | Case | Expected |
|---|------|----------|
| E1 | Reload booking | DB row matches API after confirm |
| E2 | Admin ledger | `/admin/bookings` shows same reference & totals |
| E3 | Payments admin | `expected_amount_inr` / `captured_amount_inr` in INR |

## Public APIs (no admin cookie)

| # | Case | Expected |
|---|------|----------|
| F1 | Quote/hold | Works without admin session |
| F2 | Event enquiry POST | 201 without admin |
| F3 | Event enquiry GET | 401 without admin |

## Notifications

| # | Case | Expected |
|---|------|----------|
| G1 | Queue rows | After confirm, `booking_notifications` rows for email/sms |
| G2 | Delivery | **Not implemented in repo** — expect `status` not `sent` unless external worker added |

## RLS (anon/authenticated clients)

Use publishable key in a small script or Supabase SQL + client test — see `supabase/tests/rls-inspection.sql`.

| # | Case | Expected |
|---|------|----------|
| H1 | Anon SELECT bookings | Denied |
| H2 | Anon INSERT pricing_rules | Denied |
| H3 | Authenticated non-admin | Denied on private tables |
