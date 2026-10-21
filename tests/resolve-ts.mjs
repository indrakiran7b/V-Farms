import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('next/')) {
    try {
      return await nextResolve(`${specifier}.js`, context)
    } catch {
      // fall through
    }
  }
  if (specifier.startsWith('@/')) {
    const rel = specifier.slice(2).replace(/\\/g, '/')
    const base = path.join(projectRoot, rel)
    for (const candidate of [`${base}.ts`, `${base}.tsx`, base]) {
      try {
        return await nextResolve(pathToFileURL(candidate).href, context)
      } catch {
        // try next
      }
    }
  }
  if (specifier.startsWith('.') && !specifier.endsWith('.ts') && !specifier.endsWith('.json') && !specifier.endsWith('.mjs')) {
    try {
      return await nextResolve(`${specifier}.ts`, context)
    } catch {
      // fall through
    }
  }
  return nextResolve(specifier, context)
}
