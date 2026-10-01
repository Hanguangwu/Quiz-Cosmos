/**
 * Shared filesystem helpers for the content pipeline.
 *
 * Used by `scripts/validate-content.ts` and `scripts/build-index.ts` so both
 * see exactly the same file set, the same category registry and the same theme
 * allow-list. Only `node:fs` / `node:path` are used — no glob dependency.
 *
 * Card front matter is parsed by the app's own parser
 * (`src/lib/parser.ts`), so validation can never disagree with the runtime. This
 * module only reads YAML configuration, and it does so with the same `yaml`
 * package the parser uses — never gray-matter, which is Node-only and would drag
 * `Buffer` into any consumer that shares this module.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'
import type { IndexedCard } from '../../src/types/index.ts'

/** Repo root, derived from this file's location (`scripts/lib/`). */
export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

export const CONTENT_DIR = path.join(REPO_ROOT, 'content')
export const CATEGORIES_FILE = path.join(REPO_ROOT, 'config', 'categories.yml')
export const INDEX_FILE = path.join(REPO_ROOT, 'public', 'index.json')

/** Repo-relative, forward-slash path — the form used in reports and cards. */
export function toRepoPath(absolute: string): string {
  return path.relative(REPO_ROOT, absolute).split(path.sep).join('/')
}

/**
 * Known theme ids.
 *
 * Keep in sync with `DEFAULT_THEME_ID` (`src/types/theme.ts`) and the theme
 * registry under `src/features/themes/`: that registry cannot be imported here
 * because it is a browser module (CSS custom properties, no node build), so the
 * id list is duplicated on purpose. Add every new theme id to this array.
 */
export const THEME_IDS: readonly string[] = [
  'apple-notes',
  'paper', // DEFAULT_THEME_ID
  'memphis',
  'retro',
  'cyberpunk',
  'terminal',
  'shui-mo',
  'xuan-zhi',
  'zhu-jian',
  'forest',
]

export interface SubcategoryEntry {
  label: string | null
}

export interface CategoryEntry {
  id: string
  label: string | null
  order: number
  subcategories: Map<string, SubcategoryEntry>
}

export interface CategoryConfig {
  version: number
  categories: CategoryEntry[]
  byId: Map<string, CategoryEntry>
}

/** Recursively collect every Markdown file under `content/`, sorted. */
export function listContentFiles(root: string = CONTENT_DIR): string[] {
  const out: string[] = []
  const walk = (dir: string) => {
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      return
    }
    for (const entry of entries.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
      if (entry.startsWith('.')) continue
      const full = path.join(dir, entry)
      const stats = statSync(full)
      if (stats.isDirectory()) walk(full)
      else if (entry.toLowerCase().endsWith('.md')) out.push(full)
    }
  }
  walk(root)
  return out.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
}

export function readTextFile(absolute: string): string {
  return readFileSync(absolute, 'utf8')
}

export function fileExists(absolute: string): boolean {
  return existsSync(absolute)
}

function scalar(value: string): string | null {
  const text = value.trim()
  if (text === '' || text === '~' || text === 'null' || text === '{}' || text === '""' || text === "''") return null
  if (/^"(.*)"$/.test(text)) return /^"(.*)"$/.exec(text)?.[1] ?? null
  if (/^'(.*)'$/.test(text)) return /^'(.*)'$/.exec(text)?.[1] ?? null
  return text
}

/**
 * Read `config/categories.yml`.
 *
 * The file is a plain YAML document — it carries no `---` front-matter fence —
 * so it goes straight into the `yaml` parser. The previous implementation
 * wrapped the text in synthetic `---` fences only because that is the shape
 * gray-matter's API demanded; with the fence gone there is exactly one YAML
 * entry point in the repo, and it is the same one `src/lib/parser.ts` uses for
 * card front matter (so the repo depends on no transitive `js-yaml`).
 */
export function loadCategoryConfig(file: string = CATEGORIES_FILE): CategoryConfig {
  const raw = readTextFile(file)
  let data: unknown
  try {
    data = parseYaml(raw.replace(/\r\n/g, '\n'))
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`config/categories.yml 解析失败：${reason}`)
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error('config/categories.yml 顶层必须是对象。')
  }
  const record = data as Record<string, unknown>
  const list = Array.isArray(record.categories) ? record.categories : []
  const categories: CategoryEntry[] = []
  for (const item of list) {
    if (typeof item !== 'object' || item === null) continue
    const entry = item as Record<string, unknown>
    const id = typeof entry.id === 'string' ? entry.id.trim() : ''
    if (id === '') continue
    const subcategories = new Map<string, SubcategoryEntry>()
    if (typeof entry.subcategories === 'object' && entry.subcategories !== null) {
      for (const [key, value] of Object.entries(entry.subcategories as Record<string, unknown>)) {
        subcategories.set(key, { label: scalar(String(value ?? '')) })
      }
    }
    categories.push({
      id,
      label: typeof entry.label === 'string' ? entry.label : null,
      order: typeof entry.order === 'number' ? entry.order : Number.MAX_SAFE_INTEGER,
      subcategories,
    })
  }
  if (categories.length === 0) throw new Error('config/categories.yml 没有声明任何分类。')
  categories.sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : 1))
  return {
    version: typeof record.version === 'number' ? record.version : 1,
    categories,
    byId: new Map(categories.map((entry) => [entry.id, entry])),
  }
}

/**
 * Facet counts, sorted by count desc then name asc (locale aware, so CJK sorts
 * the way a Chinese UI expects). Duplicated from `src/lib/search.ts` on
 * purpose: the build pipeline must not depend on the browser search engine.
 */
export function countFacets(
  cards: IndexedCard[],
  pick: (card: IndexedCard) => (string | null)[],
): { name: string; count: number }[] {
  const collator = new Intl.Collator('zh-Hans-CN', { numeric: true, sensitivity: 'base' })
  const counts = new Map<string, number>()
  for (const card of cards) {
    for (const name of pick(card)) {
      if (typeof name !== 'string') continue
      const key = name.trim()
      if (key === '') continue
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => (b.count !== a.count ? b.count - a.count : collator.compare(a.name, b.name)))
}
