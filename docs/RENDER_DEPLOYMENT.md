# V-Farms — Render web service + GoDaddy DNS (`vfarms.in`)

Deploy the existing Next.js 16 App Router app as a **Node web service** on Render (free tier available). **Do not** use static export. This guide does not change DNS for you or publish automatically.

## Render build and start (exact commands)

| Step | Command |
|------|---------|
| **Build** | `npm ci && npm run build` |
| **Start** | `npm start` (runs `prestart` → production `.next` guard, then `next start`) |
| **Node** | **22.x** — set `NODE_VERSION=22.12.0` (or match `package.json` `engines.node`) in Render env |

`next start` listens on **`process.env.PORT`** (Render injects `PORT`). No custom server or GoDaddy `/app` dev-server behavior is required on Render.

Optional repo blueprint: [`render.yaml`](../render.yaml). Static sanity check: `npm run verify:render` (after a local build, optional).

---

## Environment variables (names only)

Set values in **Render → Service → Environment**. Never commit secrets.

### Build-time (must exist before **Build**)

Next.js inlines `NEXT_PUBLIC_*` at build time.

| Variable | Role |
|----------|------|
| `NEXT_PUBLIC_SITE_URL` | Canonical origin, no trailing slash — e.g. `https://vfarms.in` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (browser + middleware) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/publishable key (or `NEXT_PUBLIC_SUPABASE_ANON_KEY`) |

If you change any `NEXT_PUBLIC_*` value, trigger a **new deploy/build** on Render.

### Runtime (server routes, webhooks, admin)

| Variable | Role |
|----------|------|
| `SUPABASE_URL` | Server Supabase URL (may match public URL) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role for API routes (never `NEXT_PUBLIC_*`) |
| `RAZORPAY_KEY_ID` | Checkout |
| `RAZORPAY_KEY_SECRET` | Verify + create order |
| `RAZORPAY_WEBHOOK_SECRET` | `POST /api/webhooks/razorpay` signature verification |

### Optional runtime

| Variable | Role |
|----------|------|
| `RESEND_API_KEY` | Transactional email |
| `EMAIL_FROM` | Verified sender for Resend |
| `STAGING_BASE_URL` | Local/E2E scripts only — not required on Render production |

### Never set in Git or Render logs

- `.env`, `.env.local`, service role keys, Razorpay secrets, webhook secrets.

**Rotation:** If any credential was ever exposed in logs, Git, or chat, rotate it in Supabase/Razorpay and update Render env.

Local name-only check: `npm run env:check` (reads `.env.local` if present; does not print values).

Catalog in code: `lib/env.ts` → `ENV_CATALOG`.

---

## GitHub → Render (manual)

1. Push the intended branch (e.g. **`production`**) to `https://github.com/indrakiran7b/V-Farms`.
2. [Render Dashboard](https://dashboard.render.com/) → **New +** → **Web Service**.
3. Connect **GitHub** → repository **V-Farms** → branch **`production`** (or your release branch).
4. Configure:
   - **Runtime:** Node
   - **Build Command:** `npm ci && npm run build`
   - **Start Command:** `npm start`
   - **Instance type:** Free (see limitations below)
5. Add **Environment** variables from the tables above (all required runtime + build-time public vars).
6. **Create Web Service** and wait for the first build. Fix build errors from logs; do not disable tests or auth in code.
7. Note the default Render URL: `https://<service-name>.onrender.com` — use it for smoke tests before custom domain.

**Blueprint alternative:** **New +** → **Blueprint** → point at repo; Render reads `render.yaml`. Still add secret env vars in the dashboard.

---

## Custom domain `vfarms.in` (GoDaddy DNS — manual)

Render assigns DNS targets when you add a custom domain. **Use the exact records Render shows** for your service (do not guess IPs/CNAMEs).

### On Render

1. Service → **Settings** → **Custom Domains** → **Add Custom Domain**.
2. Add **`vfarms.in`** (apex).
3. Optionally add **`www.vfarms.in`** and configure redirect (Render UI: redirect www → apex or apex → www — pick one canonical host).
4. Copy Render’s verification / routing records (often **ANAME/ALIAS** or **A/CNAME** for apex; **CNAME** for `www`).

### On GoDaddy

1. [GoDaddy DNS Management](https://dcc.godaddy.com/) for **vfarms.in**.
2. **Add** the records Render displays (names and values must match Render’s panel).
3. Remove or avoid conflicting old **A/CNAME** records for `@` or `www` that point at previous hosts (GoDaddy Node, etc.) only after you intend to cut over.
4. Wait for DNS propagation (minutes to hours). Render shows certificate provisioning when DNS is correct.

### Application config after domain is live

1. Set **`NEXT_PUBLIC_SITE_URL=https://vfarms.in`** (or `https://www.vfarms.in` if that is canonical) in Render → **Environment**.
2. **Manual Deploy** / rebuild so metadata, sitemap, and robots use the new origin (`lib/site-url.ts` → `getSiteUrl()`).

### Supabase (Authentication → URL configuration)

Update in the Supabase project dashboard (staging vs production project as you use):

| Setting | Example |
|---------|---------|
| **Site URL** | `https://vfarms.in` |
| **Redirect URLs** | `https://vfarms.in/**`, `https://www.vfarms.in/**` (if www is used), plus `https://<name>.onrender.com/**` during transition |

Admin login uses email/password via server actions; session cookies still depend on correct site URL and HTTPS.

### Razorpay

| Item | URL |
|------|-----|
| **Webhook** | `https://vfarms.in/api/webhooks/razorpay` (update in Razorpay Dashboard when going live) |
| **Checkout** | Uses keys from env; no code change for domain if env keys match mode (test vs live) |

Keep **test keys** until checkout, verify, and webhooks succeed on Render preview URL, then switch to live keys for production.

---

## Production smoke-test checklist

After deploy (Render URL or `vfarms.in`):

- [ ] `GET /` returns **200**
- [ ] `GET /robots.txt`, `/sitemap.xml` show canonical host from `NEXT_PUBLIC_SITE_URL`
- [ ] **Booking quote** — `POST /api/bookings/quote` with valid dates → quote or expected 409
- [ ] **Hold** — `POST /api/bookings/hold` → booking reference; hold expires per policy
- [ ] **Razorpay** — create order → test payment → `POST /api/payments/verify` → booking confirmed (test mode)
- [ ] **Webhook** — Razorpay test event to `/api/webhooks/razorpay` with valid signature
- [ ] **Admin** — `/admin/login` with user that has `admin_role` in app metadata
- [ ] **Rate limits** — repeated API calls eventually **429** (middleware / RPC path)
- [ ] No secrets in browser Network tab or page source (`NEXT_PUBLIC_*` only public keys)

---

## Free tier limitations (Render)

- **Spin-down:** Free web services may **sleep after inactivity**; first request after sleep can be slow (cold start).
- **Usage limits:** CPU, bandwidth, and build minutes are capped; heavy traffic or long builds may require a paid plan.
- **No SLA** on free tier — do not assume 24/7 uninterrupted availability for production without a paid instance.

---

## Coexistence with GoDaddy Node hosting

- **`.airo/config.json`** and `npm run verify:godaddy` / `package:godaddy` remain for GoDaddy; Render ignores `.airo`.
- Use **one primary production host** for `vfarms.in` DNS to avoid split-brain. Point GoDaddy DNS at Render when cut over; leave GoDaddy Node app running but not on the apex if migrating.

---

## Local validation before deploy

```bash
npm ci
npm run typecheck
npm run test
npm run build
npm run verify:render
```

Report Node version: `package.json` expects **22.x**; align Render `NODE_VERSION` accordingly.
