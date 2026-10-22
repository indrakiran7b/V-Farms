# `.airo/config.json` (GoDaddy / Airo Node.js Hosting)

Canonical production commands for this repo (merge with any extra keys the dashboard adds; do **not** reintroduce `pnpm` or `next dev`):

```json
{
  "buildCommand": "NODE_ENV=production npm run build",
  "serveCommand": "NODE_ENV=production npm start",
  "devCommand": "NODE_ENV=production npm start",
  "installCommand": "npm ci --omit=dev --ignore-scripts",
  "packageManager": "npm"
}
```

**Git pull conflict:** If GoDaddy modified `.airo/config.json`, keep dashboard-only keys you recognize, but ensure `buildCommand`, `serveCommand`, and `devCommand` match the block above. Then **Update Preview**.
