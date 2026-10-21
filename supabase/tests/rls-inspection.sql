-- Run against STAGING in Supabase SQL editor (read-only inspection).
-- Record results in docs/staging-e2e-plan.md section H.

-- Tables the app references
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'pricing_rules',
    'stay_bookings',
    'inventory_holds',
    'payments',
    'payment_webhook_events',
    'booking_notifications',
    'event_enquiries',
    'event_quotes',
    'event_audit_logs',
    'content_entries',
    'gallery_items'
  )
order by tablename;

-- Policies per table
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'pricing_rules',
    'stay_bookings',
    'inventory_holds',
    'payments',
    'payment_webhook_events',
    'booking_notifications',
    'event_enquiries',
    'event_quotes',
    'event_audit_logs',
    'content_entries',
    'gallery_items'
  )
order by tablename, policyname;

-- Overlap / exclusion constraints on holds and bookings
select c.conrelid::regclass as table_name,
       c.conname,
       pg_get_constraintdef(c.oid) as definition
from pg_constraint c
join pg_namespace n on n.oid = c.connamespace
where n.nspname = 'public'
  and c.contype in ('x', 'u', 'f', 'c')
  and c.conrelid::regclass::text in ('inventory_holds', 'stay_bookings')
order by 1, 2;

-- Unique indexes supporting idempotency
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('payment_webhook_events', 'booking_notifications')
order by tablename, indexname;
