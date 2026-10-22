# GoDaddy Node.js Hosting — V-Farms staging deployment guide

**Target:** Staging subdomain on [GoDaddy Node.js Hosting](https://www.godaddy.com/hosting/nodejs) (persistent **Node.js 22** process, **not** Vercel).  
**Repository:** `I:\V-Farms`  
**Status:** Preparation only — **no deployment performed** by this document.

---

## 1. Verified repository facts (local, this session)

| Check | Command | Result |
|-------|---------|--------|
| Typecheck | `pnpm run typecheck` / `npm run typecheck` | **PASS** |
| Tests | `pnpm run test` / `npm run test` | **PASS** (119/119) |
| Production build | `pnpm run build` / `npm run build` | **PASS** (`next build --webpack` 16.4.0) |
| npm lockfile | `npm ci` (clean `node_modules`) then build | **PASS** (388 packages) |
| Local Node | `node -v` | **v24.13.1** (dev machine; hosting uses **Node 22** per GoDaddy) |

**Stack (from `package.json`):**

- **Next.js** `16.4.0`, **React** 19, App Router
- **Scripts:** `"build": "next build --webpack"`, `"start": "next start"` (no custom server; **Webpack** avoids Turbopack CSS/port-binding failures on restricted PaaS builders)
- **Package manager (local):** optional `pnpm-lock.yaml` for dev; **no** `packageManager` field in `package.json` (avoids Corepack/pnpm on GoDaddy)
- **GoDaddy install:** **`package-lock.json`** + root `.npmrc` (npm registry; platform docs emphasize **npm**). Upload zip **excludes** `pnpm-lock.yaml` (kept in repo for local pnpm only).
- **Node:** `"engines": { "node": "22.x" }` (GoDaddy runtime is Node **22**; `engines` does not override host)
- **Site URL:** `lib/site-url.ts` → `NEXT_PUBLIC_SITE_URL` with fallback `https://v-farms.in`
- **Build deps in `dependencies`:** `typescript`, `tailwindcss`, `@tailwindcss/postcss`, `postcss`, `@types/node`, `@types/react`, `@types/react-dom` (GoDaddy production-only install; avoids Next auto-installing devDeps during build)
- **Preflight:** `pnpm run verify:godaddy` — disposable copy, `npm ci`, tests, then `npm ci --omit=dev` + `npm run build`
- **Images:** `next.config.mjs` → `images.unoptimized: true` (no Vercel Image Optimization required)

**API surface (build output):** `/api/bookings/*`, `/api/payments/*`, `/api/webhooks/razorpay`, `/api/admin/*`, middleware on admin + booking/payment/webhook paths.

**Supabase migrations (staging — already applied; do not re-run from app deploy):**

| Version | Purpose |
|---------|---------|
| `20261021103000` | Initial V-Farms schema |
| `20261021114800` | Premature held-booking expiry fix |
| `20261021120000` | Ops hardening (rate limits, webhook fields, exceptions, audit) |
| `20261021124500` | Revoke `consume_rate_limit` from anon/authenticated |

Apply any **future** migrations manually via Supabase CLI (`db push` / your runbook) — **never** from the Node host boot script.

---

## 2. GoDaddy compatibility (evidence + dashboard confirmation)

### Compatible (verified from repo + GoDaddy public docs)

| Item | Evidence |
|------|----------|
| Framework | GoDaddy lists **Next.js**; project uses `next build` / `next start` |
| Start command | `package.json` → `"start": "next start"` — matches `npm start` contract |
| Port binding | Next.js `next start` respects **`process.env.PORT`** (GoDaddy requirement); no hardcoded port in repo |
| Lockfile | Upload **`package-lock.json`** only (exclude `pnpm-lock.yaml` from zip) so the host uses **npm** |
| Persistent process | Rate limits use **Supabase RPC** (`consume_rate_limit`); suitable for multi-request / single long-lived Node process |
| No custom server | No `server.js` / Express wrapper — **do not add** unless GoDaddy support requires it |

### GoDaddy build install policy (documented — not guessed)

GoDaddy’s [Node.js app requirements](https://developer.godaddy.com/en/docs/api-users/hosting/app-requirements) state explicitly:

> **The platform installs only `dependencies` before running build and start.**

The public [deploy contract](https://github.com/godaddy/nodejs-hosting-agent-skill/blob/main/skills/godaddy-nodejs-hosting/contract.md) describes the same pipeline: **production install (omits `devDependencies`) → `run build` → `run start`**, using npm/pnpm/yarn from the lockfile or `packageManager`.

**V-Farms status:** Build-time packages listed above are in **`dependencies`** so production install satisfies `next build`. Test-only tools (`tsx`, `@types/*`) remain in **`devDependencies`**.

**Confirm in GoDaddy dashboard / first build log (no public “install devDependencies” toggle documented):**

| Dashboard / log item | What to verify |
|----------------------|----------------|
| Install command | e.g. `pnpm install --prod` / `npm ci --omit=dev` (exact flags in build log) |
| Build command | Defaults to `npm run build` — whether `pnpm run build` is used when `pnpm-lock.yaml` is present |
| Environment variables | When `NEXT_PUBLIC_*` vars are injected relative to **build** (required for site URL if made env-driven) |
| Node version | Blog/docs: runtime is **Node 22**; `engines.node` in `package.json` does **not** change it |
| Custom build/start overrides | Any app settings that replace default `build` / `start` scripts |
| Failed build AI summary | Whether suggested fix mentions missing PostCSS/Tailwind/TypeScript modules |

### Requires confirmation in GoDaddy dashboard / docs

| Item | Why |
|------|-----|
| **Node 22** runtime | GoDaddy states apps run on **Node.js 22**; local dev on Node 24 — confirm Next 16.4 builds on their builder (expected OK) |
| **Production install before build** | **Documented:** only `dependencies` installed before **both** build and start — see **B1** |
| **Zip size 100 MB** | Exclude `node_modules`, `.next` (platform builds), `.git`, tests optional |
| **HTTPS / CDN / WAF** | Automatic on publish — confirm subdomain SSL after DNS |
| **Preview vs publish URL** | Preview is account-private; staging subdomain = **publish** + DNS |
| **Outbound HTTPS** | Required to Supabase, Razorpay, optional Resend — confirm no egress block |

**Package manager (production EACCES fix):** GoDaddy’s [deploy contract](https://github.com/godaddy/nodejs-hosting-agent-skill/blob/main/skills/godaddy-nodejs-hosting/contract.md) picks **npm, pnpm, or yarn** from the **lockfile** or **`packageManager`** in `package.json`. Official [app requirements](https://developer.godaddy.com/en/docs/api-users/hosting/app-requirements) describe **`npm run build`** and **`npm start`**. If the archive includes `pnpm-lock.yaml` and/or `"packageManager": "pnpm@…"`, production may run **`pnpm start`** — which can fail with **`pnpm-native: spawnSync EACCES`**. This repo targets **npm only on the host**:

- Upload **`package-lock.json`** + **`.npmrc`** (no `pnpm-lock.yaml` in zip).
- **Do not** set `packageManager` in the uploaded `package.json`.
- **Do not** upload `node_modules/`, `.next/`, or preview build artifacts (platform runs install + build).
- **Airo override:** See [`.airo/config.schema.md`](../.airo/config.schema.md). Committed **`.airo/config.json`**: `npm run build`, `npm start`, `npm ci --omit=dev`, `packageManager`: `npm`. The host may prepend `NODE_ENV=production` in logs — do not duplicate in `.airo` unless the dashboard requires it.
- **Clean deploy branch:** Use Git branch **`production`** in GoDaddy (Pull from GitHub → branch **`production`**) so Preview is isolated from `feature/staging-prep`.
- **Preview / Turbopack:** If logs show **`> next dev`**, use **`scripts/dev-server.mjs`** (cwd `/app` → production build + start), **Settings → Build / Run**, and host **`.airo`** merge steps in the schema doc.
- **`.airo/config.json` Git conflict on host:** Replace the server copy with the committed file or discard host-local edits, then pull branch **`production`** again.

**Publish / runtime logs (`pnpm-native EACCES` or `next dev`):** **Publish** may reuse a stale preview artifact (`Archive size: 225MB+`, `node_modules and build output present from preview - serving directly`) or dashboard overrides (`pnpm start`, `npm run dev`). Fix order: (1) **Settings → Build/Run** — build `NODE_ENV=production npm run build`, start/dev `NODE_ENV=production npm start`; (2) **Update Preview** on `feature/staging-prep`; (3) **Runtime Logs** must show **`next start`** / **`next build --webpack`**, never **`next dev`** or **pnpm**; (4) then **Publish to Live**.

**Turbopack on PaaS:** Next.js 16 defaults to Turbopack for `next build`, which can fail on restricted hosts (e.g. `globals.css` / OS error 13 when spawning a helper that binds a port). This repo uses **`next build --webpack`** (supported in Next 16.4.0 per `next build --help`).

**Middleware deprecation:** Next 16 may warn that `middleware.ts` is deprecated in favor of `proxy`. **No codemod applied** — keep existing Supabase session + rate-limit middleware until a manual migration is validated.

**Official references (external):**

- [Node.js app requirements](https://developer.godaddy.com/en/docs/api-users/hosting/app-requirements)
- [GoDaddy Node.js Hosting overview](https://www.godaddy.com/hosting/nodejs)

---

## 3. Blockers before first upload

Resolve these **before** packaging or publishing.

### B1 — ~~Build-time packages in devDependencies~~ (resolved in repo)

Build tooling moved to **`dependencies`**. Confirm first GoDaddy build log still completes `next build` without missing modules.

### B2 — Uncommitted working tree

**Evidence:** Large modified/untracked set (payment hardening, middleware, admin APIs, `supabase/migrations/*`, tests, docs).

**Risk:** Zip from wrong folder state; staging missing payment/eligibility/hardening code.

**Remediation:** Commit (or tag) intended release; deploy from that revision. **Do not discard** current changes.

### B3 — `NEXT_PUBLIC_SITE_URL` on GoDaddy before build

**Evidence:** Metadata uses `getSiteUrl()` from `lib/site-url.ts`. Without env, fallback is **`https://v-farms.in`** (production canonical).

**Risk:** Staging builds emit production canonical URLs if `NEXT_PUBLIC_SITE_URL` is unset on the host.

**Remediation:** In GoDaddy app env, set before deploy/build:

| Environment | Example value |
|-------------|----------------|
| Staging | `https://staging.yourdomain.com` (your GoDaddy staging subdomain) |
| Production | `https://v-farms.in` (or your live hostname) |

Also set `STAGING_BASE_URL` to the same staging origin for E2E scripts; configure Razorpay webhook to `https://<staging-host>/api/webhooks/razorpay`.

### B4 — Environment on host, not only locally

**Evidence:** Preflight noted missing `STAGING_BASE_URL` locally; production deploy on GitHub still at older SHA.

**Remediation:** Configure **all server secrets** in GoDaddy app env UI (see §6). Run `pnpm run env:check` locally only as a template — host env is separate.

### B5 — Razorpay / E2E not verified

**Evidence:** Mocked tests pass; live test checkout not confirmed on target URL.

**Remediation:** After publish, run `docs/STAGING_E2E_CHECKLIST.md` from **P0** onward against GoDaddy URL.

---

## 4. Runtime / architecture notes (no code changes required for deploy)

| Concern | Finding |
|---------|---------|
| **Local disk state** | App does not rely on writable local files for booking/payment (Supabase + Razorpay). |
| **Background workers** | No in-process job queue; notification dispatch via API (`/api/admin/notifications/dispatch`) and optional post-confirm hook. |
| **Cron** | No verified in-repo cron route in current tree; use **external cron** (GoDaddy/host cron or manual) to POST admin dispatch if needed — **not verified** on GoDaddy. |
| **In-memory rate limit** | `lib/security/rate-limit.ts` still used for **admin login** throttling; **API** limits use Supabase (`middleware.ts` → `consume_rate_limit`). Single persistent Node OK; **multiple instances** would need shared limiter only (already on API paths). |
| **Middleware** | `middleware.ts` runs on Edge-capable Next middleware; on Node hosting with `next start`, Next runs middleware in supported runtime — **confirm on first deploy** (smoke test admin + API). |
| **`@vercel/analytics`** | Optional; does not block self-host. |
| **`shadcn` in dependencies** | CLI package in runtime deps — bloat only, not a functional blocker. |

---

## 5. Environment variables

Configure in **GoDaddy app environment** (never commit values). Names from `lib/env.ts` / `.env.example`:

### Public (browser / middleware)

| Name | Role |
|------|------|
| `NEXT_PUBLIC_SITE_URL` | Canonical origin (no trailing slash); **set on GoDaddy before build** |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (staging ref) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon/publishable key |

### Server-only secrets

| Name | Role |
|------|------|
| `SUPABASE_URL` | Same staging project (optional if public URL set) |
| `SUPABASE_SERVICE_ROLE_KEY` | API routes, booking, rate-limit RPC |
| `RAZORPAY_KEY_ID` | Test mode key for staging (`rzp_test_…`) |
| `RAZORPAY_KEY_SECRET` | Server-only |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook HMAC |
| `RESEND_API_KEY` | Optional email |
| `EMAIL_FROM` | Optional email |

### Recommended for staging ops

| Name | Role |
|------|------|
| `STAGING_BASE_URL` | `https://staging.example.com` — E2E checklist, Razorpay webhook |
| `NODE_ENV` | `production` on host (GoDaddy may set automatically — confirm) |

**Never** use `NEXT_PUBLIC_*` for service role, Razorpay secret, or webhook secret (`publicEnvExposesPrivilegedKeys()` guards naming in tests).

---

## 5b. Dual lockfile strategy (pnpm local, npm on GoDaddy)

| File | Purpose |
|------|---------|
| `pnpm-lock.yaml` | **Keep in repo** — local/CI with `pnpm install`; **not** in GoDaddy zip |
| `package-lock.json` | **Authoritative on GoDaddy** — include in upload zip |
| `.npmrc` | `registry=https://registry.npmjs.org/` (GoDaddy contract) |

After changing `dependencies` in `package.json`:

```powershell
cd I:\V-Farms
pnpm install
pnpm run lockfile:sync-npm
```

`lockfile:sync-npm` runs `scripts/sync-npm-lock.mjs`: it briefly renames `node_modules` (pnpm layout breaks npm arborist), omits `packageManager` for the npm CLI call, writes `package-lock.json`, then restores `package.json` and `node_modules`.

Verify npm reproducibility (clean tree):

```powershell
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
npm ci
npm run typecheck
npm run test
npm run build
pnpm install
```

Do **not** delete `pnpm-lock.yaml` when refreshing `package-lock.json`.

Preflight (disposable temp copy — does not replace main `node_modules`):

```powershell
pnpm run verify:godaddy
```

Runs: `npm ci` → typecheck → tests → build → `npm ci --omit=dev` → `npm run build`.

---

## 6. Safe packaging (automated script)

From repo root (runs preflight first; refuses on secrets, legacy Vercel canonical URL, or lockfile issues):

```powershell
cd I:\V-Farms
pnpm run package:godaddy
```

Output: `dist/vfarms-godaddy-staging.zip`, `dist/godaddy-package-manifest.json` (file count, size, SHA-256).

**Inspect the zip (no extract):**

```powershell
tar -tf dist\vfarms-godaddy-staging.zip | Select-String -Pattern '\.env'
tar -tf dist\vfarms-godaddy-staging.zip | Select-String -Pattern 'node_modules|\.git|\.next'
tar -tf dist\vfarms-godaddy-staging.zip | Select-String -Pattern 'package-lock\.json|pnpm-lock\.yaml|\.npmrc|GODADDY_STAGING|supabase/migrations'
Get-Item dist\vfarms-godaddy-staging.zip | Format-List Name, Length
Get-Content dist\godaddy-package-manifest.json
```

Empty matches for `.env`, `node_modules`, `.git`, `.next` are expected.

## 6b. Safe packaging rules (zip upload)

**Include:**

- Application source (`app/`, `components/`, `lib/`, `public/`, `middleware.ts`, `next.config.mjs`, `postcss.config.mjs`, `tsconfig.json`, etc.)
- `package.json`, **`package-lock.json`**, **`pnpm-lock.yaml`**, **`.npmrc`**
- `supabase/migrations/` (reference only — **do not execute** on host)

**Exclude:**

- `node_modules/`
- `.next/` (let platform build, unless using pre-build strategy per B1)
- `.env`, `.env.local`, `.env.*` (configure in GoDaddy UI)
- `.git/` (optional)
- `tests/`, `*.tsbuildinfo` (optional, reduces size)
- `supabase/.temp/`, credentials

**Max zip ~100 MB** (GoDaddy marketing/docs) — source-only zips are usually fine.

---

## 7. Preview deployment steps (staging subdomain)

**Not executed in repo — operator runbook:**

1. **Resolve blockers** §3 (especially B2, B3, B4).
2. **Supabase:** Confirm migration parity (`npx supabase migration list` linked) — four versions through `20261021124500`; run read-only inspection SQL if desired (`supabase/tests/ops-hardening-inspection.sql`).
3. **Package** per §6.
4. **GoDaddy:** Create or select Node.js app → upload zip **or** connect GitHub branch.
5. **Environment:** Set variables §6 (test Razorpay keys only).
6. **Build settings:** Prefer **`npm run build`** / **`npm start`** (include `package-lock.json` in zip); Start → `next start`.
7. **Preview deploy** (private URL) — smoke:
   - `GET /` 200
   - `POST /api/bookings/quote` (valid body) 200 or 409
   - Admin login redirect
8. **Publish** to public URL when ready.
9. **DNS (staging subdomain):** In GoDaddy DNS, CNAME/A records as instructed by Node.js Hosting publish flow — **confirm exact targets in dashboard** (not verified here).
10. **Razorpay Test Mode:** Webhook `https://<staging-subdomain>/api/webhooks/razorpay`; rotate webhook secret to match host env.
11. **Verification:** `docs/STAGING_E2E_CHECKLIST.md` P0 → S*.

---

## 8. Rollback

1. **App:** Redeploy previous zip / GitHub commit via GoDaddy deployment history (keep prior artifact).
2. **DNS:** Revert subdomain record to previous target or disable publish.
3. **Database:** App rollback **does not** rollback Supabase — forward migrations stay applied; use app-level compatibility only. Data fixes via admin/SQL runbooks, not automatic down migrations.
4. **Razorpay:** Point webhook back to last known-good URL or disable until fixed.

---

## 9. Cleanup (staging)

- Remove test bookings only via controlled admin/SQL using a **manifest** (see `STAGING_E2E_CHECKLIST.md` §9 proposals) — do not bulk-delete production-like rows.
- Clear GoDaddy preview apps if unused (saves plan slots per GoDaddy docs).
- Rotate staging secrets if exposed during testing.

---

## 10. Next-stage commands (operator)

Run locally **before** upload (same machine as dev):

```bash
cd I:\V-Farms
pnpm run env:check
pnpm run typecheck
pnpm run test
pnpm run build
pnpm run lockfile:sync-npm
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue; npm ci; npm run build
pnpm install
node scripts/verify-staging-ref.mjs uxtjpsfitsntrdrdlatk
npx supabase migration list
```

After GoDaddy env is configured (replace base URL):

```bash
# Read-only DB/grants (linked staging)
npx supabase db query --linked -f supabase/tests/ops-hardening-inspection.sql --output-format json
node scripts/verify-ops-hardening-anon-rpc.mjs
```

Post-publish smoke (no secrets in output):

```bash
curl -sS -o /dev/null -w "%{http_code}" https://YOUR-STAGING-SUBDOMAIN/
curl -sS -X POST https://YOUR-STAGING-SUBDOMAIN/api/bookings/quote \
  -H "Content-Type: application/json" \
  -d "{\"checkIn\":\"2026-12-01\",\"checkOut\":\"2026-12-03\",\"adults\":2,\"children\":0}"
```

GoDaddy CLI (optional — **confirm installed**):

```bash
# Example from GoDaddy docs; app IDs from dashboard
gddy apps list
gddy deployment create --app <APP_ID> --file ./vfarms-staging.zip
gddy deployment publish --app <APP_ID> --deployment <DEPLOYMENT_ID>
```

---

## 11. Verified vs unverified summary

| Topic | Status |
|-------|--------|
| Local typecheck / test / build | **Verified** (this session) |
| GoDaddy Node 22 + Next.js support | **Public docs** — runtime OK pending first deploy |
| GoDaddy production install + `next build` | **Repo prepared** — confirm on first host build log |
| npm `package-lock.json` + `npm ci` | **Verify locally** after dependency changes |
| GoDaddy PORT assignment | **Expected OK** (`next start`) — confirm first deploy |
| Staging Supabase migrations | **Verified** previously via CLI list (re-check before go-live) |
| Live Razorpay on GoDaddy URL | **Not verified** |
| DNS / subdomain / SSL | **Dashboard confirmation required** |
| Deployment succeeded | **Not claimed** |
