-- Read-only staging inspection for consume_rate_limit hardening (no DML).
-- After 20261021124500_revoke_consume_rate_limit_anon_grants.sql, anon/authenticated EXECUTE should be false.

select jsonb_build_object(
  'migration_version_present',
  exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20261021120000'
  ),
  'tables', (
    select coalesce(jsonb_agg(table_name order by table_name), '[]'::jsonb)
    from information_schema.tables
    where table_schema = 'public'
      and table_name in ('api_rate_limit_buckets', 'admin_audit_logs')
  ),
  'payments_exception_columns', (
    select coalesce(jsonb_agg(column_name order by column_name), '[]'::jsonb)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'payments'
      and column_name in (
        'exception_resolution_status',
        'exception_resolution_note',
        'exception_resolved_at',
        'exception_resolved_by'
      )
  ),
  'webhook_observability_columns', (
    select coalesce(jsonb_agg(column_name order by column_name), '[]'::jsonb)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'payment_webhook_events'
      and column_name in ('payload_json', 'last_error', 'attempt_count', 'next_retry_at', 'processing_status')
  ),
  'indexes', (
    select coalesce(jsonb_agg(indexname order by indexname), '[]'::jsonb)
    from pg_indexes
    where schemaname = 'public'
      and indexname in ('api_rate_limit_buckets_window_start_idx', 'admin_audit_logs_created_at_idx')
  ),
  'payments_exception_check', (
    select conname
    from pg_constraint
    where conname = 'payments_exception_resolution_status_check'
  ),
  'consume_rate_limit_function', (
    select exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'consume_rate_limit'
        and pg_get_function_identity_arguments(p.oid) = 'p_bucket_key text, p_limit integer, p_window_seconds integer'
    )
  ),
  'consume_rate_limit_grants', (
    select coalesce(
      jsonb_agg(
        jsonb_build_object('grantee', grantee, 'privilege_type', privilege_type)
        order by grantee, privilege_type
      ),
      '[]'::jsonb
    )
    from information_schema.role_routine_grants
    where specific_schema = 'public'
      and routine_name = 'consume_rate_limit'
  ),
  'consume_rate_limit_execute_by_role', (
    select jsonb_build_object(
      'anon', has_function_privilege('anon', 'public.consume_rate_limit(text, integer, integer)', 'EXECUTE'),
      'authenticated', has_function_privilege('authenticated', 'public.consume_rate_limit(text, integer, integer)', 'EXECUTE'),
      'service_role', has_function_privilege('service_role', 'public.consume_rate_limit(text, integer, integer)', 'EXECUTE')
    )
  ),
  'rls_enabled', (
    select jsonb_build_object(
      'api_rate_limit_buckets', (
        select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname = 'api_rate_limit_buckets'
      ),
      'admin_audit_logs', (
        select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname = 'admin_audit_logs'
      )
    )
  ),
  'policies', (
    select coalesce(jsonb_agg(jsonb_build_object('tablename', tablename, 'policyname', policyname) order by tablename, policyname), '[]'::jsonb)
    from pg_policies
    where schemaname = 'public'
      and tablename in ('api_rate_limit_buckets', 'admin_audit_logs')
  )
) as ops_hardening_inspection;
