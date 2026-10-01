/**
 * Runtime data access.
 *
 * `public/index.json` is generated at build time by `scripts/build-index.ts`
 * and is the app's ONLY runtime data source (AGENTS.md §16): no API, no
 * per-card fetch, works offline. Everything here is therefore a thin, typed
 * wrapper around one `fetch`.
 *
 * Base URL: the app may be deployed under a sub-path (GitHub Pages), so every
 * request goes through `import.meta.env.BASE_URL`.
 */

import { CARD_STATUSES, DIFFICULTIES } from '../types'
import type { CardStatus, Difficulty, IndexedCard, KnowledgeIndex } from '../types'

const INDEX_FILENAME = 'index.json'

/** Thrown for every index failure, always with a Chinese, user-readable message. */
export class ContentIndexError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message)
    this.name = 'ContentIndexError'
    if (options && 'cause' in options) this.cause = options.cause
  }
}

let pending: Promise<KnowledgeIndex> | null = null
let cached: KnowledgeIndex | null = null
let lookup: Map<string, IndexedCard> | null = null

/** `<base>/index.json`, always with exactly one slash between parts. */
export function indexUrl(): string {
  const env = import.meta.env as { BASE_URL?: string } | undefined
  const base = env?.BASE_URL ?? '/'
  return `${base.endsWith('/') ? base : `${base}/`}${INDEX_FILENAME}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * `difficulty` and `status` are closed unions, so an unrecognised string is a
 * corrupt index rather than a passthrough. Coerce to the documented fallback
 * instead of casting: `STATUS_LABELS[card.status]` would otherwise render
 * `undefined` and take the whole filter rail down with it.
 */
function toDifficulty(value: unknown): Difficulty | null {
  return DIFFICULTIES.find((item) => item === value) ?? null
}

function toStatus(value: unknown): CardStatus {
  return CARD_STATUSES.find((item) => item === value) ?? 'draft'
}

function facetList(value: unknown): KnowledgeIndex['categories'] {
  if (!Array.isArray(value)) return []
  const out: { name: string; count: number }[] = []
  for (const item of value) {
    if (!isRecord(item)) continue
    const { name, count } = item
    if (typeof name === 'string' && typeof count === 'number') out.push({ name, count })
  }
  return out
}

/** Structural validation: an index that does not match `KnowledgeIndex` is fatal. */
export function assertKnowledgeIndex(value: unknown): KnowledgeIndex {
  if (!isRecord(value)) throw new ContentIndexError('index.json 格式错误：根节点必须是对象。')
  if (value.version !== 1) {
    throw new ContentIndexError(`index.json 版本不受支持：期望 1，实际为 ${String(value.version)}。`)
  }
  if (typeof value.generatedAt !== 'string' || value.generatedAt === '') {
    throw new ContentIndexError('index.json 缺少 generatedAt 字段。')
  }
  if (!Array.isArray(value.cards)) {
    throw new ContentIndexError('index.json 缺少 cards 数组。')
  }
  const cards: IndexedCard[] = []
  for (const raw of value.cards) {
    if (!isRecord(raw)) throw new ContentIndexError('index.json 中存在非对象的卡片条目。')
    const { id, slug, title } = raw
    if (typeof id !== 'string' || id === '') throw new ContentIndexError('index.json 中存在缺少 id 的卡片。')
    if (typeof slug !== 'string' || slug === '') {
      throw new ContentIndexError(`卡片 ${id} 缺少 slug，无法生成访问链接。`)
    }
    if (typeof title !== 'string') throw new ContentIndexError(`卡片 ${id} 的 title 不是字符串。`)
    const question = typeof raw.question === 'string' ? raw.question : ''
    const answer = typeof raw.answer === 'string' ? raw.answer : ''
    cards.push({
      schemaVersion: 1,
      id,
      slug,
      type: 'qa',
      title,
      category: typeof raw.category === 'string' ? raw.category : '',
      subcategory: typeof raw.subcategory === 'string' ? raw.subcategory : null,
      tags: Array.isArray(raw.tags) ? raw.tags.filter((tag): tag is string => typeof tag === 'string') : [],
      difficulty: toDifficulty(raw.difficulty),
      status: toStatus(raw.status),
      theme: typeof raw.theme === 'string' ? raw.theme : null,
      aliases: Array.isArray(raw.aliases)
        ? raw.aliases.filter((a): a is string => typeof a === 'string')
        : [],
      related: Array.isArray(raw.related)
        ? raw.related.filter((r): r is string => typeof r === 'string')
        : [],
      created: typeof raw.created === 'string' ? raw.created : null,
      updated: typeof raw.updated === 'string' ? raw.updated : null,
      // Verbatim body, front matter stripped (mirrors `scripts/build-index.ts`).
      // An index built before `body` existed still loads: the editor falls back
      // to `question` + flip marker + `answer` when this is empty.
      body: typeof raw.body === 'string' ? raw.body : '',
      question,
      answer,
      text: typeof raw.text === 'string' ? raw.text : '',
      length: typeof raw.length === 'number' ? raw.length : 0,
      hasAnswer: raw.hasAnswer === true,
    })
  }
  if (typeof value.total === 'number' && value.total !== cards.length) {
    throw new ContentIndexError(
      `index.json 的 total（${value.total}）与 cards 数量（${cards.length}）不一致，请重新构建索引。`,
    )
  }
  return {
    version: 1,
    generatedAt: value.generatedAt,
    total: typeof value.total === 'number' ? value.total : cards.length,
    cards,
    categories: facetList(value.categories),
    tags: facetList(value.tags),
    difficulties: facetList(value.difficulties),
    statuses: facetList(value.statuses),
    themes: facetList(value.themes),
  }
}

function buildLookup(index: KnowledgeIndex): Map<string, IndexedCard> {
  const map = new Map<string, IndexedCard>()
  for (const card of index.cards) {
    map.set(card.slug.toLowerCase(), card)
    map.set(card.id.toLowerCase(), card)
  }
  return map
}

async function fetchIndex(): Promise<KnowledgeIndex> {
  const url = indexUrl()
  let response: Response
  try {
    response = await fetch(url, { cache: 'no-cache' })
  } catch (error) {
    throw new ContentIndexError(`无法加载 ${url}：网络请求失败，请检查网络后重试。`, {
      cause: error,
    })
  }
  if (!response.ok) {
    throw new ContentIndexError(`无法加载 ${url}：HTTP ${response.status} ${response.statusText}。`)
  }
  let payload: unknown
  try {
    payload = await response.json()
  } catch (error) {
    throw new ContentIndexError(`${url} 不是合法的 JSON，请重新执行 pnpm run build:index。`, {
      cause: error,
    })
  }
  const index = assertKnowledgeIndex(payload)
  cached = index
  lookup = buildLookup(index)
  return index
}

/**
 * Load (and memoise) the index. Concurrent callers share one request; a failed
 * request is not memoised so a retry is possible.
 */
export function loadIndex(): Promise<KnowledgeIndex> {
  if (cached) return Promise.resolve(cached)
  if (!pending) {
    pending = fetchIndex().catch((error: unknown) => {
      pending = null
      throw error instanceof ContentIndexError
        ? error
        : new ContentIndexError('加载知识索引失败，请稍后重试。', { cause: error })
    })
  }
  return pending
}

/**
 * Startup warm-up. Never rejects, so it is safe to call without `await`
 * (e.g. from `main.tsx` before the first render).
 */
export function preloadIndex(): Promise<KnowledgeIndex | null> {
  return loadIndex().catch(() => null)
}

/** Last successfully loaded index, or `null` before the first load. */
export function getIndexSync(): KnowledgeIndex | null {
  return cached
}

/** Drop the memoised index (used by the error state's "retry" button). */
export function resetIndex(): void {
  pending = null
  cached = null
  lookup = null
}

/**
 * Find a card by slug first, then by exact id, case-insensitively.
 * Returns `null` when the index has not been loaded or nothing matches.
 */
export function resolveCard(slugOrId: string, index?: KnowledgeIndex): IndexedCard | null {
  const source = index ?? cached
  if (!source) return null
  const map = index || !lookup || lookup.size !== source.cards.length ? buildLookup(source) : lookup
  if (!index) lookup = map
  const key = slugOrId.trim().toLowerCase()
  if (key === '') return null
  return map.get(key) ?? null
}

/* -------------------------------------------------------------------------- */
/* front matter editing helpers (CodeMirror / textarea)                        */
/* -------------------------------------------------------------------------- */

const FRONT_MATTER_RE = /^---[ \t]*\n([\s\S]*?)\n?---[ \t]*(?:\n|$)/

/** Raw front matter block (without the `---` fences), or `''` when absent. */
export function sliceFrontMatter(markdown: string): string {
  if (typeof markdown !== 'string') return ''
  const match = FRONT_MATTER_RE.exec(markdown.replace(/\r\n/g, '\n'))
  return match?.[1] ?? ''
}

/** Replace (or prepend) the front matter block, keeping the body untouched. */
export function replaceFrontMatter(markdown: string, frontMatter: string): string {
  const source = typeof markdown === 'string' ? markdown.replace(/\r\n/g, '\n') : ''
  const block = String(frontMatter ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/^---[ \t]*\n?/, '')
    .replace(/\n?---[ \t]*$/, '')
    .replace(/^\n+|\n+$/g, '')
  const next = `---\n${block}\n---\n`
  const match = FRONT_MATTER_RE.exec(source)
  if (!match) {
    const body = source.replace(/^\n+/, '')
    return body === '' ? next : `${next}\n${body}`
  }
  const body = source.slice(match[0].length).replace(/^\n+/, '')
  return body === '' ? next : `${next}\n${body}`
}
