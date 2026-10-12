-- V-Farms exclusive whole-property inventory
-- V-Farms is one property-wide booking inventory for both stays and events.

create extension if not exists btree_gist;

create table if not exists properties (
  id text primary key,
  name text not null,
  timezone text not null default 'Asia/Kolkata',
  currency text not null default 'INR',
  location_label text not null,
  max_adults int not null,
  max_children int not null,
  max_guests int not null,
  min_nights int not null default 1,
  max_nights int not null default 14,
  min_advance_days int not null default 0,
  advance_booking_days int not null default 365,
  hold_minutes int not null default 15,
  turnover_same_day_allowed boolean not null default true,
  check_in_time text not null default '14:00',
  check_out_time text not null default '11:00',
  event_day_exclusive boolean not null default true,
  capacity_awaiting_owner_approval boolean not null default true,
  published_rates_awaiting_owner_approval boolean not null default true,
  contact_phone text,
  contact_whatsapp text,
  contact_email text,
  support_hours text,
  maps_url text,
  postal_address text,
  created_at timestamptz not null default now()
);

insert into properties (id, name, location_label, max_adults, max_children, max_guests)
values ('vfarms-estate', 'V-Farms', 'Near Hyderabad, Telangana, India', 10, 6, 10)
on conflict (id) do nothing;

create table if not exists room_profiles (
  id text primary key,
  property_id text not null references properties(id),
  sort_order int not null,
  name text not null,
  slug text not null,
  description text not null,
  size_label text,
  bed_configuration text,
  view text,
  amenities jsonb not null default '[]',
  photo_paths jsonb not null default '[]',
  awaiting_owner_approval boolean not null default true
);

create table if not exists inventory_blocks (
  id text primary key,
  property_id text not null references properties(id),
  kind text not null check (kind in ('stay', 'event', 'hold', 'maintenance', 'admin')),
  hold_purpose text check (hold_purpose in ('stay', 'event')),
  status text not null check (status in ('active', 'confirmed', 'held')),
  start_date date not null,
  end_date date not null,
  stay_half_open boolean not null default false,
  source_type text not null,
  source_id text not null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  constraint dates_ok check (end_date >= start_date)
);

create index if not exists inventory_blocks_property_dates on inventory_blocks (property_id, start_date, end_date);

create or replace function vf_block_range(kind text, start_date date, end_date date, stay_half_open boolean)
returns daterange language sql immutable as $$
  select case
    when kind in ('stay') or stay_half_open then daterange(start_date, end_date, '[)')
    when kind = 'event' then daterange(start_date, end_date, '[]')
    else daterange(start_date, end_date, '[]')
  end;
$$;

-- Conservative event rule: events also occupy stay arrival and departure dates.
-- Stay vs stay uses half-open nights; event vs stay uses inclusive stay dates.
create or replace function vf_conflict_range(kind text, hold_purpose text, start_date date, end_date date, stay_half_open boolean)
returns daterange language sql immutable as $$
  select case
    when kind = 'event' or hold_purpose = 'event' then daterange(start_date, end_date + 1, '[)')
    when kind = 'stay' or hold_purpose = 'stay' or stay_half_open then daterange(start_date, end_date, '[)')
    else daterange(start_date, end_date + 1, '[)')
  end;
$$;

alter table inventory_blocks
  drop constraint if exists inventory_blocks_no_overlap;

alter table inventory_blocks
  add constraint inventory_blocks_no_overlap
  exclude using gist (
    property_id with =,
    vf_conflict_range(kind, hold_purpose, start_date, end_date, stay_half_open) with &&
  )
  where (status in ('active', 'confirmed', 'held') and (expires_at is null or expires_at > now()));

create table if not exists stays (
  id text primary key,
  reference text unique not null,
  property_id text not null references properties(id),
  status text not null,
  check_in date not null,
  check_out date not null,
  adults int not null,
  children int not null,
  guest jsonb not null,
  hold_id text,
  hold_expires_at timestamptz,
  price_snapshot jsonb not null,
  policy_snapshot jsonb not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists event_enquiries (
  id text primary key,
  reference text unique not null,
  status text not null,
  organizer jsonb not null,
  event_type text not null,
  start_date date not null,
  end_date date not null,
  expected_attendance int not null,
  preferred_timing text,
  requirements jsonb not null default '{}',
  quote_id text,
  hold_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists event_quotes (
  id text primary key,
  enquiry_id text not null references event_enquiries(id),
  status text not null,
  overnight_rooms_included boolean not null,
  overnight_rooms_statement text not null,
  inclusions jsonb not null default '[]',
  exclusions jsonb not null default '[]',
  lines jsonb not null default '[]',
  deposit_paise bigint not null,
  total_paise bigint not null,
  expires_at timestamptz not null,
  policy_snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists rate_rules (
  id text primary key,
  property_id text not null references properties(id),
  name text not null,
  priority int not null,
  start_date date,
  end_date date,
  weekdays int[],
  nightly_paise bigint not null,
  label text not null,
  awaiting_owner_approval boolean not null default true
);

create table if not exists payments (
  id text primary key,
  purpose text not null check (purpose in ('stay', 'event')),
  source_id text not null,
  hold_id text,
  status text not null,
  amount_paise bigint not null,
  currency text not null default 'INR',
  method text not null,
  razorpay_order_id text,
  razorpay_payment_id text,
  offline_reference text,
  captured_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists payments_webhook_payment_id on payments (razorpay_payment_id) where razorpay_payment_id is not null;

create table if not exists payment_exceptions (
  id text primary key,
  kind text not null,
  payment_id text not null,
  source_id text,
  message text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists webhook_events (
  id text primary key,
  provider text not null,
  event_id text not null unique,
  event_type text not null,
  payload_hash text not null,
  processed_at timestamptz not null default now()
);

create table if not exists notifications (
  id text primary key,
  type text not null,
  to_email text not null,
  subject text not null,
  body text not null,
  status text not null,
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table if not exists faqs (
  id text primary key,
  question text not null,
  answer text not null,
  category text not null,
  sort_order int not null,
  published boolean not null default true
);

create table if not exists gallery_items (
  id text primary key,
  kind text not null,
  src text not null,
  caption text not null,
  alt text not null,
  sort_order int not null,
  authentic boolean not null default true,
  awaiting_owner_approval boolean not null default false
);

create table if not exists estate_hotspots (
  id text primary key,
  title text not null,
  description text not null,
  x_percent numeric not null,
  y_percent numeric not null,
  schematic_only boolean not null default true,
  awaiting_owner_approval boolean not null default true
);

create table if not exists site_content (
  id text primary key default 'home',
  payload jsonb not null
);

create table if not exists admin_users (
  id text primary key,
  email text unique not null,
  name text not null,
  role text not null check (role in ('owner', 'reservations', 'operations', 'content')),
  created_at timestamptz not null default now()
);

create table if not exists audit_log (
  id text primary key,
  actor_id text not null,
  actor_role text not null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

create or replace function vf_expire_holds()
returns void language sql as $$
  update inventory_blocks
    set status = 'active'
    where kind = 'hold' and expires_at is not null and expires_at <= now();
  delete from inventory_blocks
    where kind = 'hold' and expires_at is not null and expires_at <= now();
$$;

-- Atomic stay hold
create or replace function vf_acquire_stay_hold(
  p_id text,
  p_check_in date,
  p_check_out date,
  p_hold_id text,
  p_expires timestamptz
) returns void language plpgsql as $$
begin
  perform vf_expire_holds();
  insert into inventory_blocks (
    id, property_id, kind, hold_purpose, status, start_date, end_date, stay_half_open, source_type, source_id, expires_at
  ) values (
    p_hold_id, 'vfarms-estate', 'hold', 'stay', 'held', p_check_in, p_check_out, true, 'hold', p_hold_id, p_expires
  );
end;
$$;

alter table properties enable row level security;
alter table room_profiles enable row level security;
alter table inventory_blocks enable row level security;
alter table stays enable row level security;
alter table event_enquiries enable row level security;
alter table event_quotes enable row level security;
alter table rate_rules enable row level security;
alter table payments enable row level security;
alter table payment_exceptions enable row level security;
alter table webhook_events enable row level security;
alter table notifications enable row level security;
alter table faqs enable row level security;
alter table gallery_items enable row level security;
alter table estate_hotspots enable row level security;
alter table site_content enable row level security;
alter table admin_users enable row level security;
alter table audit_log enable row level security;

create policy "public read rooms" on room_profiles for select using (true);
create policy "public read faqs" on faqs for select using (published = true);
create policy "public read gallery" on gallery_items for select using (true);
create policy "public read hotspots" on estate_hotspots for select using (true);
create policy "public read content" on site_content for select using (true);
create policy "public read rates" on rate_rules for select using (true);
create policy "public read property" on properties for select using (true);

-- Private tables: no public policies. Service role bypasses RLS.
