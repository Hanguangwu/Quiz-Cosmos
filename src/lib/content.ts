/**
 * Runtime data access.
 *
 * Data now lives in Cloudflare D1 and is read through the Pages Function API
 * (`functions/api/[[proxy]].js`). Reading is public, so a plain `GET /api/cards`
 * is enough — the response is adapted back into the app's existing
 * `KnowledgeIndex` shape (facets included) so every page keeps working
 * unchanged. There is no per-card fetch and no server-side search request.
 *
 * Base URL: the app may be deployed under a sub-path, so the API client
 * (`src/lib/api.ts`) routes everything through `import.meta.env.BASE_URL`.
 */

import { CARD_STATUSES, DIFFICULTIES, FLIP_MARKER } from '../types'
import type { ApiCard } from './api'
import { ApiError, listCards } from './api'
import { slugify, stripMarkdown } from './parser'
import type { FacetCount, IndexedCard, KnowledgeIndex } from '../types'

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

function countFacets(
  cards: IndexedCard[],
  pick: (card: IndexedCard) => (string | null)[],
): FacetCount[] {
  const counts = new Map<string, number>()
  for (const card of cards) {
    for (const name of pick(card)) {
      if (name === null || name === undefined || name === '') continue
      counts.set(name, (counts.get(name) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
}

/** Adapt one API card to the index card shape the UI already consumes. */
function toIndexedCard(card: ApiCard): IndexedCard {
  const question = typeof card.question === 'string' ? card.question : ''
  const answer = typeof card.answer === 'string' ? card.answer : ''
  const trimmedQ = question.trim()
  const trimmedA = answer.trim()
  // The API stores the two sides separately; the editor round-trips a single
  // Markdown document, so rebuild the body around the canonical flip marker.
  const body =
    trimmedQ === '' && trimmedA === ''
      ? ''
      : [trimmedQ, '', FLIP_MARKER, '', trimmedA].join('\n')

  return {
    schemaVersion: 1,
    id: card.id,
    slug: slugify(card.id),
    type: 'qa',
    title: typeof card.title === 'string' ? card.title : '',
    category: typeof card.category === 'string' ? card.category : '',
    subcategory: card.subcategory ?? null,
    tags: Array.isArray(card.tags) ? card.tags.filter((tag) => typeof tag === 'string') : [],
    difficulty: DIFFICULTIES.find((item) => item === card.difficulty) ?? null,
    status: CARD_STATUSES.find((item) => item === card.status) ?? 'draft',
    theme: card.theme ?? null,
    aliases: Array.isArray(card.aliases)
      ? card.aliases.filter((item) => typeof item === 'string')
      : [],
    related: Array.isArray(card.related)
      ? card.related.filter((item) => typeof item === 'string')
      : [],
    created: typeof card.created_at === 'string' ? card.created_at.slice(0, 10) : null,
    updated: typeof card.updated_at === 'string' ? card.updated_at.slice(0, 10) : null,
    body,
    question,
    answer,
    text: stripMarkdown(`${question}\n${answer}`),
    length: question.length + answer.length,
    hasAnswer: trimmedA !== '',
  }
}

function buildIndex(apiCards: ApiCard[]): KnowledgeIndex {
  const cards = apiCards.map(toIndexedCard)
  const published = cards.filter((card) => card.status === 'published')
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    total: cards.length,
    cards,
    // `categories` drives the public browser, so it counts published cards only
    // (the public browse surfaces default to `status: published`); the rest of
    // the facets cover the whole library.
    categories: countFacets(published, (card) => [card.category]),
    tags: countFacets(cards, (card) => card.tags),
    difficulties: countFacets(cards, (card) => [card.difficulty]),
    statuses: countFacets(cards, (card) => [card.status]),
    themes: countFacets(cards, (card) => [card.theme]),
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
  let payload: { cards?: unknown }
  try {
    payload = await listCards()
  } catch (error) {
    if (error instanceof ApiError) {
      throw new ContentIndexError(`无法加载卡片：${error.message}`, { cause: error })
    }
    throw new ContentIndexError('加载知识索引失败，请稍后重试。', { cause: error })
  }
  const apiCards = Array.isArray(payload?.cards) ? (payload.cards as ApiCard[]) : []
  const index = buildIndex(apiCards)
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
