-- Distributed rate limits, webhook observability, payment exception tracking, admin audit.

create table public.api_rate_limit_buckets (
  bucket_key text not null,
  window_start timestamptz not null,
  request_count integer not null default 0,
  primary key (bucket_key, window_start)
);

create index api_rate_limit_buckets_window_start_idx
  on public.api_rate_limit_buckets (window_start);

create or replace function public.consume_rate_limit(
  p_bucket_key text,
  p_limit integer,
  p_window_seconds integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_count integer;
  v_retry_after integer;
begin
  if p_limit < 1 or p_window_seconds < 1 then
    return jsonb_build_object('allowed', false, 'retry_after_seconds', 60);
  end if;
  v_window_start := to_timestamp(
    floor(extract(epoch from timezone('utc', now())) / p_window_seconds) * p_window_seconds
  );
  insert into public.api_rate_limit_buckets as b (bucket_key, window_start, request_count)
  values (p_bucket_key, v_window_start, 1)
  on conflict (bucket_key, window_start) do update
    set request_count = b.request_count + 1
  returning request_count into v_count;
  if v_count > p_limit then
    v_retry_after := p_window_seconds - mod(extract(epoch from timezone('utc', now()))::integer, p_window_seconds);
    return jsonb_build_object('allowed', false, 'retry_after_seconds', greatest(v_retry_after, 1));
  end if;
  return jsonb_build_object('allowed', true, 'retry_after_seconds', 0);
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer) from public;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;

alter table public.payments
  add column if not exists exception_resolution_status text,
  add column if not exists exception_resolution_note text,
  add column if not exists exception_resolved_at timestamptz,
  add column if not exists exception_resolved_by uuid;

alter table public.payments
  drop constraint if exists payments_exception_resolution_status_check;

alter table public.payments
  add constraint payments_exception_resolution_status_check check (
    exception_resolution_status is null
    or exception_resolution_status in ('open', 'refund_initiated', 'manual_complete', 'dismissed')
  );

alter table public.payment_webhook_events
  add column if not exists payload_json jsonb,
  add column if not exists last_error text,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists next_retry_at timestamptz;

create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null,
  actor_role text not null,
  action text not null,
  target_type text not null,
  target_id text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index admin_audit_logs_created_at_idx on public.admin_audit_logs (created_at desc);

alter table public.admin_audit_logs enable row level security;

create policy admin_audit_logs_service on public.admin_audit_logs
  for all to service_role using (true) with check (true);

alter table public.api_rate_limit_buckets enable row level security;

create policy api_rate_limit_buckets_service on public.api_rate_limit_buckets
  for all to service_role using (true) with check (true);
