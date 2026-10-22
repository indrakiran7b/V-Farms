# `.airo/config.json` — V-Farms GoDaddy (committed source of truth)

Use this when resolving **Git pull conflicts** on the host or merging dashboard edits. These keys must match for npm production deploy:

```json
{
  "buildCommand": "NODE_ENV=production npm run build",
  "serveCommand": "NODE_ENV=production npm start",
  "devCommand": "NODE_ENV=production npm start",
  "installCommand": "npm ci --omit=dev",
  "packageManager": "npm"
}
```

## Why production logs showed `pnpm` (`pnpm-native EACCES`)

| Cause | What happens |
|-------|----------------|
| **Host `.airo/config.json` out of sync** | Logs show `hasAiroConfig: true` but `pnpm run build` / `pnpm start` — the **server copy** or **dashboard Build/Run** still stores pnpm commands. |
| **`packageManager: ""` in logs** | Empty manager lets the [deploy contract](https://github.com/godaddy/nodejs-hosting-agent-skill/blob/main/skills/godaddy-nodejs-hosting/contract.md) pick **npm, pnpm, or yarn from lockfiles**. Git deploy includes tracked **`pnpm-lock.yaml`**; zip upload from this repo **excludes** it. |
| **Stale Preview → Publish** | Publish may reuse a large preview artifact (`node_modules` + `.next`) built when pnpm/dev was still configured. |
| **Wrong Git branch** | Deploy branch must be **`production`** with the committed file above. |

Repo fix alone does not reset the host working tree. After pull, replace `/app/.airo/config.json` with the committed file and align the dashboard (below).

## What controls Preview startup (verified behavior)

| Mechanism | Role |
|-----------|------|
| **`serveCommand`** | Used when the PaaS runs the **production server** after build (logs: `custom serve command from .airo/config.json`). |
| **`buildCommand`** | Runs **`npm run build`** → `next build --webpack` in `package.json`. |
| **`installCommand`** | Production install from **`package-lock.json`** (`npm ci --omit=dev`). Build deps live in **`dependencies`**. |
| **`packageManager`** | Must be **`"npm"`** — do not leave blank on the host. |
| **`devCommand`** | Set to **`NODE_ENV=production npm start`** for parity; **not documented by GoDaddy** as Preview-only control. |
| **`scripts/dev-server.mjs`** | If Preview wrongly runs **`npm run dev`**, cwd **`/app`** triggers **build + `next start`** instead of Turbopack. |
| **Dashboard → Settings → Build / Run** | Can **override** repo `.airo` until aligned with the table above. |

GoDaddy logs often show `NODE_ENV=production` on commands; the committed `.airo` includes it so dashboard and repo match.

## Host Git conflict (`.airo/config.json`)

After connecting branch **`production`**:

1. **Pull from GitHub** / **Update Preview**.
2. If pull fails with *local changes would be overwritten* for `.airo/config.json`: in **File Manager**, replace `.airo/config.json` with the committed file (or discard local edits), then pull again.
3. **Settings → Build / Run:** build `NODE_ENV=production npm run build`, start `NODE_ENV=production npm start`, package manager **npm** (not pnpm).
4. **Update Preview** (fresh build) before **Publish** — do not publish a stale pnpm preview artifact.
