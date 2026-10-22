# `.airo/config.json` — V-Farms GoDaddy (committed source of truth)

Use this when resolving **Git pull conflicts** on the host or merging dashboard edits. Keep any **extra keys** the dashboard added only if you understand them; these four must match for npm production deploy:

```json
{
  "buildCommand": "npm run build",
  "serveCommand": "npm start",
  "installCommand": "npm ci --omit=dev",
  "packageManager": "npm"
}
```

## What controls Preview startup (verified behavior)

| Mechanism | Role |
|-----------|------|
| **`serveCommand`** | Used when the PaaS runs the **production server** after build (logs: `custom serve command from .airo/config.json`). |
| **`buildCommand`** | Runs **`npm run build`** → `next build --webpack` in `package.json`. |
| **`installCommand`** | Production install from **`package-lock.json`** (`npm ci --omit=dev`). Build deps live in **`dependencies`**. |
| **`devCommand`** | **Not documented by GoDaddy** as Preview-only control. Do not rely on it alone. |
| **`scripts/dev-server.mjs`** | If Preview wrongly runs **`npm run dev`**, cwd **`/app`** triggers **build + `next start`** instead of Turbopack. |
| **Dashboard → Settings → Build / Run** | Can **override** repo `.airo` until aligned with the table above. |

GoDaddy logs often **prepend** `NODE_ENV=production` to shell commands. Do **not** duplicate it in `.airo` unless the dashboard requires it.

## Host Git conflict (`.airo/config.json`)

A new Git branch does **not** reset files on the server. After connecting branch **`production`**:

1. **Pull from GitHub** / **Update Preview**.
2. If pull fails with *local changes would be overwritten* for `.airo/config.json`: in **File Manager**, replace `.airo/config.json` with the committed file from this repo (or discard local edits on the host), then pull again.
3. Align **Settings → Build / Run** with `npm run build` and `npm start`.
