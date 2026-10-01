/**
 * Client-side search over `public/index.json` (AGENTS.md §15).
 *
 * Fuse.js does the fuzzy text matching; facet filters are applied afterwards as
 * exact predicates, so `category / tag / difficulty / status` combine with AND
 * and never change the relevance order produced by Fuse.
 *
 * Weights mirror user intent: a hit in the title is worth more than a hit in
 * the body text, and the id is searchable (people paste ids) with a high weight
 * so `os-001` jumps to the top.
 */

import Fuse from 'fuse.js'
import type { IFuseOptions } from 'fuse.js'
import { SEARCH_FIELDS } from '../types'
import type { FacetCount, IndexedCard, KnowledgeIndex, SearchField, SearchFilters, SearchResult } from '../types'

export type IndexFacets = Pick<KnowledgeIndex, 'categories' | 'tags' | 'difficulties' | 'statuses' | 'themes'>

export interface SearchEngine {
  /** The index this engine was built from. */
  readonly index: KnowledgeIndex
  /** All cards, in index order. */
  readonly cards: IndexedCard[]
  /** Pre-computed facet counts for the whole library. */
  readonly facets: IndexFacets
  /** Number of cards. */
  readonly size: number
  search(filters: SearchFilters): SearchResult
}

/** Relative importance of each searchable field. Higher = better match. */
export const SEARCH_WEIGHTS: Record<SearchField, number> = {
  title: 1,
  id: 0.9,
  aliases: 0.65,
  tags: 0.6,
  category: 0.45,
  subcategory: 0.4,
  question: 0.35,
  answer: 0.25,
  text: 0.15,
}

const FUSE_OPTIONS: IFuseOptions<IndexedCard> = {
  keys: SEARCH_FIELDS.map((field) => ({ name: field, weight: SEARCH_WEIGHTS[field] })),
  includeMatches: true,
  includeScore: true,
  // Chinese text has no useful word boundaries and titles are short, so
  // location-based scoring only hurts.
  ignoreLocation: true,
  threshold: 0.35,
  minMatchCharLength: 1,
  shouldSort: true,
  findAllMatches: false,
}

/** Locale-aware comparator: CJK sorts by pinyin/笔画, latin case-insensitively. */
const COLLATOR = new Intl.Collator('zh-Hans-CN', { numeric: true, sensitivity: 'base' })

export function compareFacetNames(a: string, b: string): number {
  return COLLATOR.compare(a, b)
}

/**
 * Facet counts for a card list: sorted by count desc, then name asc.
 * Cards contribute only non-empty values; `theme` uses the theme id.
 */
export function buildFacets(cards: IndexedCard[]): IndexFacets {
  const source = Array.isArray(cards) ? cards : []

  const tally = (values: (string | null)[]): FacetCount[] => {
    const counts = new Map<string, number>()
    for (const value of values) {
      if (typeof value !== 'string') continue
      const name = value.trim()
      if (name === '') continue
      counts.set(name, (counts.get(name) ?? 0) + 1)
    }
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => (b.count !== a.count ? b.count - a.count : compareFacetNames(a.name, b.name)))
  }

  const flat = (lists: string[][]): string[] => lists.flat()

  return {
    categories: tally(source.map((card) => card.category)),
    tags: tally(flat(source.map((card) => card.tags ?? []))),
    difficulties: tally(source.map((card) => card.difficulty)),
    statuses: tally(source.map((card) => card.status)),
    themes: tally(source.map((card) => card.theme)),
  }
}

function matchesFilters(card: IndexedCard, filters: SearchFilters): boolean {
  if (filters.category && card.category !== filters.category) return false
  if (filters.difficulty && card.difficulty !== filters.difficulty) return false
  if (filters.status && card.status !== filters.status) return false
  if (filters.tag) {
    const tags = card.tags ?? []
    if (!tags.includes(filters.tag)) return false
  }
  return true
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

/** Build a memoised search engine for one index. */
export function createSearchEngine(index: KnowledgeIndex): SearchEngine {
  const cards = index.cards
  const facets = buildFacets(cards)
  const fuse = new Fuse(cards, FUSE_OPTIONS)

  const search = (filters: SearchFilters): SearchResult => {
    const started = now()
    const query = (filters?.query ?? '').trim()
    const allowed = new Set(SEARCH_FIELDS as readonly string[])

    if (query === '') {
      // No text query: keep the (deterministic) index order, score 0.
      const hits = cards
        .filter((card) => matchesFilters(card, filters))
        .map((card) => ({ card, score: 0, matched: [] as SearchField[] }))
      return { hits, total: hits.length, tookMs: round(now() - started) }
    }

    const hits = fuse
      .search(query)
      .filter((result) => matchesFilters(result.item, filters))
      .map((result) => ({
        card: result.item,
        score: round(result.score ?? 1),
        matched: (result.matches ?? [])
          .map((match) => (typeof match.key === 'string' ? match.key : ''))
          .filter((key) => allowed.has(key)) as SearchField[],
      }))

    return { hits, total: hits.length, tookMs: round(now() - started) }
  }

  return { index, cards, facets, size: cards.length, search }
}
