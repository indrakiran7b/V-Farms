-- V-Farms initial schema (derived from application code in repo — review before applying).
-- Money columns store INR (rupees). Razorpay paise conversion happens in application code only.
-- Do not apply to production without review.

create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner', 'manager', 'staff')
    or (auth.jwt() -> 'app_metadata' ->> 'role') in ('owner', 'manager', 'staff'),
    false
  );
$$;

comment on function public.is_admin() is
  'Matches lib/auth/admin.ts readAdminRole(); used for optional JWT-based RLS. API routes use service role.';

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'admin_role') = 'owner'
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'owner',
    false
  );
$$;

-- ---------------------------------------------------------------------------
-- pricing_rules
-- ---------------------------------------------------------------------------

create table public.pricing_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_date date,
  end_date date,
  nightly_inr numeric(12, 2) not null check (nightly_inr > 0),
  minimum_nights integer not null default 1 check (minimum_nights >= 1 and minimum_nights <= 365),
  active boolean not null default true,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint pricing_rules_date_order check (
    start_date is null or end_date is null or end_date >= start_date
  )
);

create index pricing_rules_active_start_idx on public.pricing_rules (active, start_date desc nulls first);

create trigger pricing_rules_set_updated_at
before update on public.pricing_rules
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- stay_bookings
-- ---------------------------------------------------------------------------

create table public.stay_bookings (
  id uuid primary key default gen_random_uuid(),
  booking_reference text not null,
  property_id text not null,
  guest_name text not null,
  guest_email text not null,
  guest_phone text not null,
  guest_count integer not null check (guest_count >= 1 and guest_count <= 20),
  check_in date not null,
  check_out date not null,
  booking_status text not null default 'held',
  payment_status text not null default 'unpaid',
  subtotal_inr numeric(12, 2) not null,
  tax_inr numeric(12, 2) not null,
  fees_inr numeric(12, 2) not null default 0,
  total_inr numeric(12, 2) not null,
  amount_due_now_inr numeric(12, 2) not null,
  balance_due_inr numeric(12, 2) not null default 0,
  price_snapshot jsonb not null default '{}'::jsonb,
  currency text not null default 'INR',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint stay_bookings_check_out_after_check_in check (check_out > check_in),
  constraint stay_bookings_booking_status_check check (booking_status in ('held', 'confirmed', 'expired')),
  constraint stay_bookings_payment_status_check check (payment_status in ('unpaid', 'captured')),
  constraint stay_bookings_currency_inr check (currency = 'INR')
);

create unique index stay_bookings_booking_reference_key on public.stay_bookings (booking_reference);

create index stay_bookings_availability_idx
  on public.stay_bookings (property_id, booking_status, check_in, check_out);

-- Confirmed stays must not overlap (half-open [check_in, check_out)).
-- Held overlaps are serialized via inventory_holds exclusion + hold route cleanup.
alter table public.stay_bookings
  add constraint stay_bookings_no_overlap_confirmed
  exclude using gist (
    property_id with =,
    daterange(check_in, check_out, '[)') with &&
  )
  where (booking_status = 'confirmed');

create trigger stay_bookings_set_updated_at
before update on public.stay_bookings
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Booking concurrency (expiry transition + advisory locks)
-- Exclusion indexes cannot use expires_at > now(); expired rows are transitioned
-- to status = 'expired' before overlap checks on each reserve path.
-- ---------------------------------------------------------------------------

create or replace function public.release_expired_inventory_holds(p_property_id text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  holds_updated integer;
  bookings_updated integer;
begin
  update public.inventory_holds ih
  set status = 'expired'
  where ih.property_id = p_property_id
    and ih.status = 'active'
    and ih.expires_at <= timezone('utc', now());

  get diagnostics holds_updated = row_count;

  -- Unpaid held bookings without an active unexpired hold no longer reserve inventory.
  update public.stay_bookings sb
  set
    booking_status = 'expired',
    updated_at = timezone('utc', now())
  where sb.property_id = p_property_id
    and sb.booking_status = 'held'
    and sb.payment_status = 'unpaid'
    and not exists (
      select 1
      from public.inventory_holds ih
      where ih.booking_id = sb.id
        and ih.status = 'active'
        and ih.expires_at > timezone('utc', now())
    );

  get diagnostics bookings_updated = row_count;
  return holds_updated + bookings_updated;
end;
$$;

comment on function public.release_expired_inventory_holds(text) is
  'Expires stale holds and matching unpaid held bookings (no active unexpired hold). Service role + reserve triggers only.';

create or replace function public.stay_bookings_reserve_dates()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.booking_status not in ('held', 'confirmed') then
    return new;
  end if;

  if tg_op = 'UPDATE'
    and old.booking_status = new.booking_status
    and old.check_in = new.check_in
    and old.check_out = new.check_out
    and old.property_id = new.property_id
    and old.payment_status = new.payment_status
  then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.property_id, 0));
  perform public.release_expired_inventory_holds(new.property_id);

  if exists (
    select 1
    from public.stay_bookings sb
    where sb.property_id = new.property_id
      and sb.id is distinct from new.id
      and sb.booking_status in ('held', 'confirmed')
      and sb.check_in < new.check_out
      and sb.check_out > new.check_in
  ) then
    raise exception 'stay dates overlap an existing held or confirmed booking'
      using errcode = '23P01';
  end if;

  return new;
end;
$$;

create trigger stay_bookings_reserve_dates
before insert or update on public.stay_bookings
for each row execute function public.stay_bookings_reserve_dates();

-- ---------------------------------------------------------------------------
-- inventory_holds
-- ---------------------------------------------------------------------------

create table public.inventory_holds (
  id uuid primary key default gen_random_uuid(),
  property_id text not null,
  booking_id uuid not null references public.stay_bookings (id) on delete cascade,
  check_in date not null,
  check_out date not null,
  expires_at timestamptz not null,
  status text not null default 'active',
  created_at timestamptz not null default timezone('utc', now()),
  constraint inventory_holds_check_out_after_check_in check (check_out > check_in),
  constraint inventory_holds_status_check check (status in ('active', 'released', 'expired'))
);

create index inventory_holds_active_lookup_idx
  on public.inventory_holds (property_id, status, expires_at, check_in, check_out);

-- App maps PostgreSQL exclusion_violation (23P01) to HTTP 409 on hold insert.
alter table public.inventory_holds
  add constraint inventory_holds_no_overlap_active
  exclude using gist (
    property_id with =,
    daterange(check_in, check_out, '[)') with &&
  )
  where (status = 'active');

create or replace function public.inventory_holds_reserve_dates()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status <> 'active' then
    return new;
  end if;

  if tg_op = 'UPDATE'
    and old.status = new.status
    and old.check_in = new.check_in
    and old.check_out = new.check_out
    and old.property_id = new.property_id
    and old.booking_id = new.booking_id
    and old.expires_at = new.expires_at
  then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.property_id, 0));
  perform public.release_expired_inventory_holds(new.property_id);

  if exists (
    select 1
    from public.stay_bookings sb
    where sb.property_id = new.property_id
      and sb.id is distinct from new.booking_id
      and sb.booking_status in ('held', 'confirmed')
      and sb.check_in < new.check_out
      and sb.check_out > new.check_in
  ) then
    raise exception 'stay dates overlap an existing held or confirmed booking'
      using errcode = '23P01';
  end if;

  return new;
end;
$$;

create trigger inventory_holds_reserve_dates
before insert or update on public.inventory_holds
for each row execute function public.inventory_holds_reserve_dates();

-- ---------------------------------------------------------------------------
-- payments
-- ---------------------------------------------------------------------------

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.stay_bookings (id) on delete restrict,
  razorpay_order_id text not null,
  razorpay_payment_id text,
  expected_amount_inr numeric(12, 2) not null,
  captured_amount_inr numeric(12, 2),
  currency text not null default 'INR',
  payment_status text not null default 'created',
  verification_status text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint payments_currency_inr check (currency = 'INR')
);

create unique index payments_razorpay_order_id_key on public.payments (razorpay_order_id);

create index payments_booking_id_idx on public.payments (booking_id, expected_amount_inr);

create trigger payments_set_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- payment_webhook_events
-- ---------------------------------------------------------------------------

create table public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider_event_id text not null,
  event_type text not null,
  processing_status text not null default 'received',
  processed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index payment_webhook_events_provider_event_id_key
  on public.payment_webhook_events (provider_event_id);

-- ---------------------------------------------------------------------------
-- booking_notifications
-- ---------------------------------------------------------------------------

create table public.booking_notifications (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.stay_bookings (id) on delete cascade,
  channel text not null,
  idempotency_key text not null,
  status text not null default 'pending',
  provider_message_id text,
  attempt_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint booking_notifications_channel_check check (channel in ('email', 'sms'))
);

create unique index booking_notifications_idempotency_key_key
  on public.booking_notifications (idempotency_key);

create trigger booking_notifications_set_updated_at
before update on public.booking_notifications
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Events CRM
-- ---------------------------------------------------------------------------

create table public.event_enquiries (
  id uuid primary key default gen_random_uuid(),
  reference text not null,
  event_date date not null,
  guest_count integer not null check (guest_count >= 1 and guest_count <= 1000),
  contact_name text not null,
  contact_email text not null,
  contact_phone text not null,
  requirements text not null default '',
  status text not null default 'new',
  internal_notes text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint event_enquiries_status_check check (
    status in (
      'new', 'reviewing', 'quoted', 'accepted', 'held', 'confirmed',
      'cancelled', 'expired', 'refunded'
    )
  )
);

create unique index event_enquiries_reference_key on public.event_enquiries (reference);

create trigger event_enquiries_set_updated_at
before update on public.event_enquiries
for each row execute function public.set_updated_at();

create table public.event_quotes (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references public.event_enquiries (id) on delete cascade,
  version integer not null check (version >= 1),
  subtotal_inr numeric(12, 2) not null,
  deposit_inr numeric(12, 2) not null,
  terms text not null default '',
  currency text not null default 'INR',
  status text not null default 'draft',
  created_at timestamptz not null default timezone('utc', now()),
  accepted_at timestamptz,
  constraint event_quotes_currency_inr check (currency = 'INR'),
  constraint event_quotes_enquiry_version_key unique (enquiry_id, version)
);

create table public.event_audit_logs (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references public.event_enquiries (id) on delete cascade,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index event_audit_logs_enquiry_id_created_idx
  on public.event_audit_logs (enquiry_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Admin content (read-only admin UI today; optional public read when published)
-- ---------------------------------------------------------------------------

create table public.content_entries (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  title text not null,
  body text not null default '',
  status text not null default 'draft',
  updated_at timestamptz not null default timezone('utc', now()),
  published_at timestamptz
);

create unique index content_entries_slug_key on public.content_entries (slug);

create trigger content_entries_set_updated_at
before update on public.content_entries
for each row execute function public.set_updated_at();

create table public.gallery_items (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null,
  public_url text not null,
  caption text not null default '',
  alt_text text not null default '',
  category text not null default '',
  display_order integer not null default 0,
  published boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.pricing_rules enable row level security;
alter table public.stay_bookings enable row level security;
alter table public.inventory_holds enable row level security;
alter table public.payments enable row level security;
alter table public.payment_webhook_events enable row level security;
alter table public.booking_notifications enable row level security;
alter table public.event_enquiries enable row level security;
alter table public.event_quotes enable row level security;
alter table public.event_audit_logs enable row level security;
alter table public.content_entries enable row level security;
alter table public.gallery_items enable row level security;

-- JWT admins (defense in depth). Server routes use service_role and bypass RLS.
create policy pricing_rules_admin_select on public.pricing_rules
  for select to authenticated
  using (public.is_admin());

create policy pricing_rules_owner_insert on public.pricing_rules
  for insert to authenticated
  with check (public.is_owner());

create policy pricing_rules_owner_update on public.pricing_rules
  for update to authenticated
  using (public.is_owner())
  with check (public.is_owner());

create policy pricing_rules_owner_delete on public.pricing_rules
  for delete to authenticated
  using (public.is_owner());

create policy stay_bookings_admin_all on public.stay_bookings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy inventory_holds_admin_all on public.inventory_holds
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy payments_admin_all on public.payments
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy payment_webhook_events_admin_all on public.payment_webhook_events
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy booking_notifications_admin_all on public.booking_notifications
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy event_enquiries_admin_all on public.event_enquiries
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy event_quotes_admin_all on public.event_quotes
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy event_audit_logs_admin_all on public.event_audit_logs
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy content_entries_admin_all on public.content_entries
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy gallery_items_admin_all on public.gallery_items
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Optional future public site reads (no PII). Service role used by admin UI today.
create policy content_entries_public_published on public.content_entries
  for select to anon, authenticated
  using (status = 'published');

create policy gallery_items_public_published on public.gallery_items
  for select to anon, authenticated
  using (published = true);

-- ---------------------------------------------------------------------------
-- Grants (RLS enforces access; service_role bypasses RLS)
-- ---------------------------------------------------------------------------

grant usage on schema public to postgres, anon, authenticated, service_role;

grant all on all tables in schema public to postgres, service_role;

-- Authenticated: table privileges exist so RLS policies apply; non-admins have no policies on PII tables.
grant select, insert, update, delete on all tables in schema public to authenticated;

-- Anon: no broad SELECT on sensitive tables; published content/gallery only (RLS also restricts).
revoke all on all tables in schema public from anon;
grant select on public.content_entries to anon;
grant select on public.gallery_items to anon;

grant all on all sequences in schema public to postgres, service_role;
grant usage on all sequences in schema public to authenticated;

revoke all on function public.release_expired_inventory_holds(text) from public;
grant execute on function public.release_expired_inventory_holds(text) to service_role;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, service_role;

revoke all on function public.is_owner() from public;
grant execute on function public.is_owner() to authenticated, service_role;

alter default privileges in schema public
  grant all on tables to postgres, service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

alter default privileges in schema public
  revoke all on tables from anon;
