# Supabase staging workflow (V-Farms)

The repo includes an **initial reviewed migration** (`supabase/migrations/20261021103000_initial_vfarms_schema.sql`) derived from application code. If staging already has divergent DDL, prefer `db pull` and reconcile with `docs/schema-app-expectations.md` before applying anything.

## CLI

- Use: `npx supabase` (documented version: run `pnpm run supabase:version`)
- Config: `supabase/config.toml` (from `supabase init`)

## Dedicated staging project (required)

1. Create a **separate** Supabase project for staging (never use production credentials for staging tests).
2. In the Supabase dashboard → **Settings → API**, note the project URL and keys (store in host env, not in git).
3. Link the CLI (interactive login):

   ```bash
   npx supabase login
   npx supabase link --project-ref <STAGING_PROJECT_REF>
   ```

4. Pull the **live** schema into version control:

   ```bash
   npx supabase db pull
   ```

   Review generated files under `supabase/migrations/` before committing.

5. Compare pulled schema with `docs/schema-app-expectations.md` (application references only).

## Apply migrations

- **Staging:** `npx supabase db push` (only after review, only on staging)
- **Production:** manual promotion process — never auto-apply from this task

## RLS verification

Run inspection queries in `supabase/tests/rls-inspection.sql` against staging, then record results in your deployment checklist.

## Local Supabase (optional)

```bash
npx supabase start
```

Requires Docker. Local DB is not a substitute for validating staging RLS unless you pull staging policies.
