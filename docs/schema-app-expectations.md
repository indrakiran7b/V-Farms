# Application database expectations

**Source of truth for new environments:** review and apply `supabase/migrations/20261021103000_initial_vfarms_schema.sql` on **staging first**. This document maps tables to code paths and records known ambiguities. It is not a substitute for the migration SQL.

## Conventions

- **Money:** all `*_inr` columns are **rupees** (`numeric(12,2)`). Razorpay **paise** is used only in `lib/payments/money.ts` at the gateway boundary.
- **Stay dates:** half-open interval **[check_in, check_out)** — see `lib/booking/dates.ts` (`dateRangesOverlap`, `validateStayDates`).
- **Property:** single estate id `vfarms-estate` (`lib/booking.ts` `PROPERTY_ID`).
- **Access:** booking/payment/event **writes use `adminSupabase()` (service role)** on the server. RLS is defense-in-depth for anon/authenticated clients.

## Core booking and payments

### `pricing_rules`

| Column / note | Evidence |
|---------------|----------|
| `id`, `name`, `start_date`, `end_date`, `nightly_inr`, `minimum_nights`, `active`, `updated_at` | `lib/booking.ts`, `app/api/admin/pricing/route.ts`, admin pricing page |
| Overlap of **active** rules | App-level only (`app/api/admin/pricing/route.ts`); not a DB constraint |

### `stay_bookings`

| Column / note | Evidence |
|---------------|----------|
| Guest + dates + counts | `app/api/bookings/hold/route.ts` insert |
| `booking_status`: `held`, `confirmed`, `expired` | hold insert; verify confirms; `release_expired_inventory_holds` expires unpaid `held` rows with no active unexpired hold |
| `payment_status`: `unpaid`, `captured` | hold insert; confirm path |
| Money + `price_snapshot` jsonb | hold insert from `calculateStayQuote` |
| `currency` | Not set on insert; migration default **`INR`** (required by create-order/verify) |
| `created_at` | Admin dashboard ordering |
| **Overlap** | Partial exclusion **`stay_bookings_no_overlap_confirmed`** for `booking_status = 'confirmed'` only |

`POST /api/bookings/hold` and GET `/api/availability` both use **`stayAvailabilityConflict`** (`lib/booking/availability.ts`): active unexpired holds plus held/confirmed bookings. DB triggers duplicate overlap rules under advisory lock; booking/hold inserts map **`23P01`** to HTTP 409.

**Ambiguity:** `bookingInputSchema.notes` is never persisted — no column by design.

### `inventory_holds`

| Column / note | Evidence |
|---------------|----------|
| `property_id`, `booking_id`, `check_in`, `check_out`, `expires_at`, `status` | hold route |
| `status = 'active'` in queries | `lib/booking.ts`, payment flows |
| **Overlap** | **`inventory_holds_no_overlap_active`** → PostgreSQL **`23P01`** → HTTP 409 in hold route |
| **Expiry** | `release_expired_inventory_holds(property_id)` — apply forward migration `20261021114800_fix_premature_held_booking_expiry.sql` on staging after initial schema; only expires unpaid `held` when hold rows exist and none are active-unexpired |

**Limitation:** Exclusion indexes cannot use `expires_at > now()`. Expiry is an explicit **`active` → `expired`** transition at reserve time, not a background cron. Holds already marked `expired` do not participate in exclusion or app read filters.

**Concurrency:** `stay_bookings_reserve_dates` / `inventory_holds_reserve_dates` use **`pg_advisory_xact_lock(hashtextextended(property_id))`**, expire stale holds, check held/confirmed booking overlap, then rely on GiST exclusion for active holds. **Not verified in CI** — requires PostgreSQL integration tests after apply.

### `payments`

| Column / note | Evidence |
|---------------|----------|
| `razorpay_order_id`, `expected_amount_inr`, `currency`, `payment_status` | create-order insert |
| `razorpay_payment_id`, `captured_amount_inr`, `verification_status` | verify + webhook |
| `payment_status` values used | `created`, `pending`, `captured`, `failed` (`lib/payments/status.ts`); `exception` type exists but unused in routes |

### `payment_webhook_events`

| Column / note | Evidence |
|---------------|----------|
| `provider_event_id` unique | webhook insert; duplicate → **`23505`** (`isPostgresUniqueViolation`) |
| `processing_status`, `processed_at` | webhook route updates |

### `booking_notifications`

| Column / note | Evidence |
|---------------|----------|
| Upsert on `idempotency_key` | `lib/payments/notifications.ts`, verify + webhook |
| `channel` | `email`, `sms` |
| `status` | Default `pending`; admin dashboard queries `failed`, `dead_letter` |
| Delivery worker | **Not implemented** in repo |

## Events CRM

### `event_enquiries`

Public POST (service role) insert; admin GET/PATCH/quote via `requireAdminApi`. Status enum in `app/api/events/enquiries/route.ts` and admin events UI.

### `event_quotes`

Insert: `enquiry_id`, `version`, `subtotal_inr`, `deposit_inr`, `terms`. Select also expects `currency`, `status`, `accepted_at` — migration defaults: `currency = INR`, `status = draft`, `accepted_at` null (**quote status lifecycle not fully coded**).

### `event_audit_logs`

Append-only `action` + `details` jsonb from enquiries API.

## Admin content

### `content_entries` / `gallery_items`

Admin read via service role. RLS allows **anon/authenticated SELECT** only when `status = 'published'` / `published = true` (future public site). No write API in repo yet.

## Overlap / concurrency verification (after apply)

1. Run `supabase/tests/rls-inspection.sql` on staging.
2. Concurrent hold inserts for overlapping dates → one **`23P01`**, one 409.
3. Back-to-back stays sharing a checkout/check-in date → allowed (`dateRangesOverlap` test).
4. Confirm two **`confirmed`** overlapping ranges → exclusion failure.

## RLS summary (JWT clients)

| Role | Sensitive tables | Pricing mutations |
|------|------------------|-------------------|
| `anon` | Denied — **no table SELECT** except published content/gallery grants | Denied |
| `authenticated` non-admin | Denied | Denied |
| `authenticated` admin (`app_metadata.admin_role`) | CRUD via admin policies | **Owner only** (`is_owner()`) |
| `service_role` | Bypasses RLS (server routes) | Bypasses RLS |

Align admin users with `app_metadata.admin_role` = `owner` | `manager` | `staff` (`lib/auth/admin.ts`).
