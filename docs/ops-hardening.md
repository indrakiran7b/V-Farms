# V-Farms ops hardening

## Distributed rate limiting

Public booking and payment APIs are limited in `middleware.ts` via Postgres counters in Supabase (`api_rate_limit_buckets` + `consume_rate_limit` RPC from migration `20261021120000_ops_hardening`).

| Route prefix | Limit | Window |
|--------------|-------|--------|
| `/api/bookings/*` | 40 / IP | 15 minutes |
| `/api/payments/*` | 30 / IP | 15 minutes |
| `/api/webhooks/razorpay` | 200 / IP (+ per `x-razorpay-event-id` bucket) | 1 minute |

**External service:** Supabase Postgres (same project as bookings). No separate Redis required. Apply the migration on each environment before relying on limits.

If the RPC is unavailable, the limiter **fails open** (requests allowed) so checkout is not blocked by transient DB errors—monitor Supabase health in production.

## Webhook retries

`payment_webhook_events` stores `payload_json`, `processing_status`, `last_error`, `attempt_count`, and `next_retry_at`. Owners can retry failed events from `/api/admin/webhook-events/[id]/retry` (signature was validated at ingest; retry replays internal processing only).

## Payment exceptions

When capture succeeds but the inventory hold expired, `payments.payment_status` becomes `exception` with `exception_resolution_status = open`. Resolve via admin UI; gateway reconcile uses live Razorpay fetch—never manual capture flags.

## Transactional email

Optional Resend: set `RESEND_API_KEY` and `EMAIL_FROM`. Without them, `booking_notifications` stays queued and admin dispatch returns 503 with a clear message.
