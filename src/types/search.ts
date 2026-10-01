/**
 * Build-time search index contracts.
 *
 * `public/index.json` is produced by `scripts/build-index.ts` from every
 * Markdown file under `content/` and is the app's only runtime data source. Card
 * markdown is embedded in the index so the app is fully static and offline
 * capable (no per-card network fetch, no runtime API).
 */

import type { CardFrontMatter, CardStatus, Difficulty } from './card'

/** A card as embedded in the index: metadata + markdown for both sides. */
export interface IndexedCard extends CardFrontMatter {
  /** URL-safe form of `id`, used for `/card/:slug` and asset paths. */
  slug: string
  /**
   * The card body verbatim, front matter stripped.
   *
   * Kept so the in-browser editor can round-trip a file without reformatting
   * it — `question` + `answer` alone would force a split body back into a
   * canonical shape, quietly rewriting the author's Markdown.
   */
  body: string
  question: string
  answer: string
  /** Concatenated plain text (question + answer, markdown stripped) for FTS. */
  text: string
  /** Character count of `question + answer` markdown. */
  length: number
  hasAnswer: boolean
}

export interface FacetCount {
  name: string
  count: number
}

export interface KnowledgeIndex {
  version: 1
  generatedAt: string
  /** Number of cards in `cards`. */
  total: number
  cards: IndexedCard[]
  /** Only cards with `status: published` appear here. */
  categories: FacetCount[]
  tags: FacetCount[]
  difficulties: FacetCount[]
  statuses: FacetCount[]
  /** Theme ids referenced by cards, with usage counts. */
  themes: FacetCount[]
}

export const SEARCH_FIELDS = [
  'id',
  'title',
  'aliases',
  'tags',
  'category',
  'subcategory',
  'question',
  'answer',
  'text',
] as const
export type SearchField = (typeof SEARCH_FIELDS)[number]

export interface SearchFilters {
  query: string
  category: string | null
  tag: string | null
  difficulty: Difficulty | null
  status: CardStatus | null
}

export const EMPTY_FILTERS: SearchFilters = {
  query: '',
  category: null,
  tag: null,
  difficulty: null,
  status: null,
}

export interface SearchHit {
  card: IndexedCard
  /** 0 = perfect, 1 = worst. Only meaningful when a query is present. */
  score: number
  matched: SearchField[]
}

export interface SearchResult {
  hits: SearchHit[]
  total: number
  tookMs: number
}

/** Default status filter for public browsing: published only. */
export const PUBLIC_STATUS: CardStatus = 'published'

export const ALL_STATUSES: CardStatus[] = ['published', 'review', 'draft', 'archived']
