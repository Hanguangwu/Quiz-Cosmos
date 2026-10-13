/**
 * Knowledge data context.
 *
 * Card data is fetched once from the D1-backed API (`/api/cards`, public) and
 * adapted into the app's `KnowledgeIndex` shape. This provider exposes a slug
 * lookup table and — crucially — never throws. A missing or broken index must
 * degrade to a readable error panel, not a blank screen (the app must not
 * assume it is online).
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { loadIndex, resetIndex } from './content'
import type { IndexedCard, KnowledgeIndex } from '../types'

export interface KnowledgeValue {
  index: KnowledgeIndex | null
  cards: IndexedCard[]
  /** Lower-cased slug and id -> card, for routing and cross links. */
  bySlug: Map<string, IndexedCard>
  loading: boolean
  error: string | null
  reload: () => void
}

const EMPTY_CARDS: IndexedCard[] = []

const KnowledgeContext = createContext<KnowledgeValue | null>(null)

export interface KnowledgeProviderProps {
  children: ReactNode
  /** Rendered instead of `children` while the index is loading. */
  fallback?: ReactNode
  /** Rendered instead of `children` when the index cannot be loaded. */
  errorFallback?: (message: string, reload: () => void) => ReactNode
}

function DefaultFallback() {
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }} role="status">
      正在加载知识索引…
    </div>
  )
}

function DefaultError({ message, reload }: { message: string; reload: () => void }) {
  return (
    <div role="alert" style={{ padding: '2rem', textAlign: 'center', lineHeight: '1.8' }}>
      <p style={{ fontWeight: 600 }}>知识索引加载失败</p>
      <p>{message}</p>
      <p>
        请确认站点已部署 Cloudflare Pages Functions（/api/cards 可达），然后重试。
      </p>
      <button type="button" onClick={reload}>
        重新加载
      </button>
    </div>
  )
}

export function KnowledgeProvider({ children, fallback, errorFallback }: KnowledgeProviderProps) {
  const [index, setIndex] = useState<KnowledgeIndex | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    loadIndex()
      .then((loaded) => {
        if (cancelled) return
        setIndex(loaded)
        setLoading(false)
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        setIndex(null)
        setError(cause instanceof Error ? cause.message : '加载知识索引失败。')
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [attempt])

  const reload = useCallback(() => {
    resetIndex()
    setAttempt((value) => value + 1)
  }, [])

  const value = useMemo<KnowledgeValue>(() => {
    const cards = index?.cards ?? EMPTY_CARDS
    const bySlug = new Map<string, IndexedCard>()
    for (const card of cards) {
      bySlug.set(card.slug.toLowerCase(), card)
      bySlug.set(card.id.toLowerCase(), card)
    }
    return { index, cards, bySlug, loading, error, reload }
  }, [index, loading, error, reload])

  let content: ReactNode = children
  if (loading) {
    content = fallback ?? <DefaultFallback />
  } else if (error || !index) {
    const message = error ?? '知识索引为空。'
    content = errorFallback ? errorFallback(message, reload) : <DefaultError message={message} reload={reload} />
  }

  return <KnowledgeContext.Provider value={value}>{content}</KnowledgeContext.Provider>
}

export function useKnowledge(): KnowledgeValue {
  const value = useContext(KnowledgeContext)
  if (!value) {
    throw new Error('useKnowledge 必须在 <KnowledgeProvider> 内部使用。')
  }
  return value
}
