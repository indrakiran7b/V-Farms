#!/usr/bin/env node
/** Fail fast when `npm start` runs without a production `.next` output (GoDaddy must build first). */
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const buildId = join(process.cwd(), '.next', 'BUILD_ID')
if (!existsSync(buildId)) {
  console.error(
    'assert-next-production-build: missing .next/BUILD_ID — run NODE_ENV=production npm run build before npm start.',
  )
  process.exit(1)
}
