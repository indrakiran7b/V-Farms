-- Forward fix: Supabase may grant EXECUTE on new public functions to anon/authenticated.
-- Application middleware calls this RPC with the service role only.

revoke all on function public.consume_rate_limit(text, integer, integer) from public;
revoke all on function public.consume_rate_limit(text, integer, integer) from anon, authenticated;

grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;

-- Re-assert definer search_path (behavior unchanged; pins object resolution).
alter function public.consume_rate_limit(text, integer, integer)
  security definer
  set search_path = public;
