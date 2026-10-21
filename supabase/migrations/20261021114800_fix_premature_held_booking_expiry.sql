-- Forward fix: staging already applied 20261021103000_initial_vfarms_schema.sql (premature held→expired).
-- Do not edit the initial migration on deployed environments; apply this file with supabase db push.

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

  -- Only expire unpaid held bookings that already have hold history and no active unexpired hold.
  -- Skips the window between stay_bookings INSERT and inventory_holds INSERT (no hold rows yet).
  update public.stay_bookings sb
  set
    booking_status = 'expired',
    updated_at = timezone('utc', now())
  where sb.property_id = p_property_id
    and sb.booking_status = 'held'
    and sb.payment_status = 'unpaid'
    and exists (
      select 1
      from public.inventory_holds ih
      where ih.booking_id = sb.id
    )
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
  'Expires time-lapsed holds; expires unpaid held bookings only when hold rows exist and none are active-unexpired.';

-- Defer property-wide expiry sweep until hold insert/update (hold API completes the pair).
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

  if tg_op = 'UPDATE' then
    perform public.release_expired_inventory_holds(new.property_id);
  end if;

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
