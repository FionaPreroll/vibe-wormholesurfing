import { readdir, readFile, rm } from 'node:fs/promises'
import { covering } from './coverage'

/**
 * Before the browser tests: every spec takes `test` from ./coverage, so its pages are measured,
 * and no coverage of an earlier run is mixed into this one's.
 */
export default async function setup(): Promise<void> {
  const dir = new URL('./', import.meta.url)
  for (const file of await readdir(dir)) {
    if (!file.endsWith('.spec.ts')) continue
    const source = await readFile(new URL(file, dir), 'utf8')
    if (/import\s*\{[^}]*\btest\b[^}]*\}\s*from\s*'@playwright\/test'/.test(source)) {
      throw new Error(`tests/e2e/${file}: import test from './coverage', not '@playwright/test'`)
    }
  }
  if (covering) await rm('coverage/e2e', { recursive: true, force: true })
}
