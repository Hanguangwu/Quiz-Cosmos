/**
 * Local edit drafts — IndexedDB, and NOTHING else.
 *
 * Hard rule (AGENTS.md §3): Markdown in Git is the only source of truth. This
 * module is a scratchpad for the editor so a reload does not lose typing. A
 * draft is never authoritative: `isStaleDraft` exists precisely so the UI can
 * tell the user "you have local changes that differ from the published card".
 *
 * `isStaleDraft` is synchronous by contract, so drafts are mirrored in an
 * in-memory cache; call `refreshDrafts()` (or any `loadDraft`) to prime it.
 */

import { createStore, del, entries, get, set } from 'idb-keyval'
import { getIndexSync } from './content'
import { parseCard, stripMarkdown } from './parser'
import type { IndexedCard, KnowledgeIndex } from '../types'

const DB_NAME = 'knowledge-cards'
const STORE_NAME = 'drafts'
const KEY_PREFIX = 'draft:'

interface DraftRecord {
  markdown: string
  updatedAt: number
}

const store = createStore(DB_NAME, STORE_NAME)

/** key -> record mirror, keeps the sync API honest without a second read. */
const cache = new Map<string, DraftRecord>()

export class DraftStoreError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message)
    this.name = 'DraftStoreError'
    if (options && 'cause' in options) this.cause = options.cause
  }
}

function assertIndexedDb(): void {
  if (typeof indexedDB === 'undefined') {
    throw new DraftStoreError('当前环境不支持 IndexedDB，无法保存本地草稿。')
  }
}

function keyFor(slugOrId: string): string {
  return `${KEY_PREFIX}${String(slugOrId ?? '').trim()}`
}

function byteLength(markdown: string): number {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(markdown).length
  return markdown.length
}

function isDraftRecord(value: unknown): value is DraftRecord {
  if (typeof value !== 'object' || value === null) return false
  // `in` narrows `object` to a record with a known key, so the field probes
  // below stay type-safe without asserting the value is already a draft.
  return (
    'markdown' in value &&
    typeof value.markdown === 'string' &&
    'updatedAt' in value &&
    typeof value.updatedAt === 'number'
  )
}

async function readRecord(slugOrId: string): Promise<DraftRecord | null> {
  const key = keyFor(slugOrId)
  const cached = cache.get(key)
  if (cached) return cached
  const raw = await get<DraftRecord>(key, store)
  if (!isDraftRecord(raw)) return null
  cache.set(key, raw)
  return raw
}

/** Persist a draft. Fire-and-forget friendly: rejects with a Chinese error. */
export async function saveDraft(slugOrId: string, markdown: string): Promise<void> {
  assertIndexedDb()
  const key = keyFor(slugOrId)
  const record: DraftRecord = { markdown: String(markdown ?? ''), updatedAt: Date.now() }
  cache.set(key, record)
  try {
    await set(key, record, store)
  } catch (error) {
    cache.delete(key)
    throw new DraftStoreError('保存草稿失败：浏览器拒绝了 IndexedDB 写入。', { cause: error })
  }
}

export async function loadDraft(slugOrId: string): Promise<string | null> {
  assertIndexedDb()
  try {
    const record = await readRecord(slugOrId)
    return record ? record.markdown : null
  } catch (error) {
    throw new DraftStoreError('读取草稿失败。', { cause: error })
  }
}

export async function deleteDraft(slugOrId: string): Promise<void> {
  assertIndexedDb()
  const key = keyFor(slugOrId)
  cache.delete(key)
  try {
    await del(key, store)
  } catch (error) {
    throw new DraftStoreError('删除草稿失败。', { cause: error })
  }
}

export interface DraftSummary {
  key: string
  updatedAt: number
  bytes: number
}

/** All drafts, newest first. `key` is the slug/id the draft belongs to. */
export async function listDrafts(): Promise<DraftSummary[]> {
  assertIndexedDb()
  // `entries()` yields `[IDBValidKey, unknown]`; this store only ever holds the
  // string keys `keyFor` writes, so narrow the key before using it as one.
  let all: [IDBValidKey, unknown][]
  try {
    all = await entries<string, unknown>(store)
  } catch (error) {
    throw new DraftStoreError('枚举草稿失败。', { cause: error })
  }
  const out: DraftSummary[] = []
  for (const [rawKey, value] of all) {
    if (typeof rawKey !== 'string') continue
    if (!rawKey.startsWith(KEY_PREFIX) || !isDraftRecord(value)) continue
    const key = rawKey
    cache.set(key, value)
    out.push({
      key: key.slice(KEY_PREFIX.length),
      updatedAt: value.updatedAt,
      bytes: byteLength(value.markdown),
    })
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt || compare(a.key, b.key))
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** Prime the in-memory draft mirror (used by the editor on mount). */
export async function refreshDrafts(): Promise<DraftSummary[]> {
  return listDrafts()
}

function findCard(slugOrId: string, index?: KnowledgeIndex | null): IndexedCard | null {
  const source = index ?? getIndexSync()
  if (!source) return null
  const key = String(slugOrId ?? '').trim().toLowerCase()
  if (key === '') return null
  for (const card of source.cards) {
    if (card.slug.toLowerCase() === key || card.id.toLowerCase() === key) return card
  }
  return null
}

/** Text signature of a card as published in the index. */
function signatureOfCard(card: IndexedCard): string {
  return [
    card.title.trim(),
    card.tags.join(' '),
    card.status,
    stripMarkdown(`${card.question}\n${card.answer}`),
  ].join('\n')
}

/** Text signature of a draft, parsed with the same parser as the build. */
function signatureOfDraft(markdown: string): string | null {
  const parsed = parseCard(markdown, 'draft')
  if (!parsed.ok) return null
  const { card } = parsed
  return [
    card.title.trim(),
    card.tags.join(' '),
    card.status,
    stripMarkdown(`${card.question}\n${card.answer}`),
  ].join('\n')
}

/**
 * True when a local draft exists whose content differs from the indexed card.
 *
 * Synchronous: reads the in-memory draft mirror. A draft that no longer parses
 * counts as stale (it would be rejected by the build), and a draft whose card is
 * missing from the index counts as stale too (it can only be resolved by hand).
 */
export function isStaleDraft(slugOrId: string, index?: KnowledgeIndex | null): boolean {
  const key = keyFor(slugOrId)
  const record = cache.get(key)
  if (!record) return false
  const card = findCard(slugOrId, index ?? null)
  if (!card) return true
  const draftSignature = signatureOfDraft(record.markdown)
  if (draftSignature === null) return true
  return draftSignature !== signatureOfCard(card)
}
