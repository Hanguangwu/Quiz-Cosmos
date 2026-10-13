import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, ChevronLeft, ChevronRight, PlayCircle, RotateCcw, XCircle } from 'lucide-react'
import { PageHeader } from '@/shell/AppShell'
import { KnowledgeCard } from '@/features/cards'
import { Button, EmptyState, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton } from '@/ui'
import { useKnowledge } from '@/lib/knowledge-context'
import { useAuth } from '@/lib/auth'
import { recordReview } from '@/lib/api'
import { useCardThemePreference } from '@/shell/preferences'
import type { IndexedCard } from '@/types'
import { cn } from '@/lib/cn'

/**
 * Review mode (AGENTS.md §12).
 *
 * Deliberately a *visual* Anki: flip through cards and mark 记得 / 忘了. No
 * spaced-repetition scheduler in v1 (AGENTS.md §23) — the store is a
 * plain local record, not a learning algorithm.
 */

type Verdict = 'known' | 'unknown'

interface ReviewRecord {
  known: string[]
  unknown: string[]
  updatedAt: string
}

const REVIEW_KEY = 'kc:review'

function loadRecord(): ReviewRecord {
  if (typeof window === 'undefined') return { known: [], unknown: [], updatedAt: '' }
  try {
    const raw = window.localStorage.getItem(REVIEW_KEY)
    if (!raw) return { known: [], unknown: [], updatedAt: '' }
    const parsed = JSON.parse(raw) as Partial<ReviewRecord>
    return {
      known: Array.isArray(parsed.known) ? parsed.known : [],
      unknown: Array.isArray(parsed.unknown) ? parsed.unknown : [],
      updatedAt: parsed.updatedAt ?? '',
    }
  } catch {
    return { known: [], unknown: [], updatedAt: '' }
  }
}

function saveRecord(record: ReviewRecord): void {
  try {
    window.localStorage.setItem(
      REVIEW_KEY,
      JSON.stringify({ ...record, updatedAt: new Date().toISOString() }),
    )
  } catch {
    /* ignore */
  }
}

export default function ReviewPage() {
  const { index, loading } = useKnowledge()
  const { token } = useAuth()
  const [themeId] = useCardThemePreference()
  const [scope, setScope] = useState<'all' | 'due'>('all')
  const [cursor, setCursor] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [record, setRecord] = useState<ReviewRecord>({ known: [], unknown: [], updatedAt: '' })

  useEffect(() => {
    setRecord(loadRecord())
  }, [])

  const deck = useMemo<IndexedCard[]>(() => {
    if (!index) return []
    const published = index.cards.filter(
      (card) => card.status === 'published' && card.hasAnswer,
    )
    if (scope === 'due') {
      return published.filter((card) => record.unknown.includes(card.id))
    }
    return published
  }, [index, scope, record.unknown])

  const current = deck[cursor]

  const reset = useCallback(() => {
    setCursor(0)
    setFlipped(false)
  }, [])

  const advance = useCallback(
    (delta: number) => {
      setFlipped(false)
      setCursor((prev) => {
        const next = prev + delta
        if (next < 0) return 0
        if (next >= deck.length) return deck.length - 1
        return next
      })
    },
    [deck.length],
  )

  const mark = useCallback(
    (verdict: Verdict) => {
      if (!current) return
      setRecord((prev) => {
        const next: ReviewRecord = {
          known: prev.known.filter((id) => id !== current.id),
          unknown: prev.unknown.filter((id) => id !== current.id),
          updatedAt: new Date().toISOString(),
        }
        if (verdict === 'known') next.known.push(current.id)
        else next.unknown.push(current.id)
        saveRecord(next)
        return next
      })
      // Persist to D1 when signed in; localStorage stays as the offline record.
      if (token) {
        void recordReview(current.id, verdict, token).catch(() => {
          /* best effort — local record already updated */
        })
      }
      advance(1)
    },
    [advance, current, token],
  )

  // Keyboard: space flips, arrows navigate, 1/2 record a verdict.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!current) return
      const target = event.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault()
        setFlipped((f) => !f)
      } else if (event.key === 'ArrowRight') {
        advance(1)
      } else if (event.key === 'ArrowLeft') {
        advance(-1)
      } else if (event.key === '1') {
        mark('known')
      } else if (event.key === '2') {
        mark('unknown')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [advance, current, mark])

  if (loading) return <Skeleton className="h-96" />

  // `cursor` can point past the end of `deck` — marking a card in the `due`
  // scope removes it from the deck while the cursor stays put — so treat a
  // missing `current` as "nothing to review" instead of rendering `undefined`.
  if (!index || deck.length === 0 || !current) {
    return (
      <div>
        <PageHeader title="复习" description="翻面回忆，比连续重读更有效。" />
        <EmptyState
          icon={<PlayCircle className="size-8" />}
          title={scope === 'due' ? '没有待复习的卡片' : '暂无可复习的卡片'}
          description={
            scope === 'due'
              ? '所有标记为“忘了”的卡片都已复习完。'
              : '只有同时带有答案的已发布卡片才能进入复习。'
          }
          action={
            <Button asChild variant="outline" size="sm">
              <Link to="/cards">浏览全部卡片</Link>
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="复习"
        description={`第 ${cursor + 1} / ${deck.length} 张 · 空格翻面，← → 切换，1 记得，2 忘了`}
        actions={
          <>
            <Select value={scope} onValueChange={(value) => { setScope(value as 'all' | 'due'); reset() }}>
              <SelectTrigger className="h-8 w-auto text-[0.8125rem]" aria-label="复习范围">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部卡片</SelectItem>
                <SelectItem value="due">待复习（{record.unknown.length}）</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={reset}>
              <RotateCcw />
              重来
            </Button>
          </>
        }
      />

      <div className="mx-auto max-w-2xl">
        <KnowledgeCard
          key={current.id}
          card={current}
          size="lg"
          themeId={themeId}
          showDetailLink={false}
          defaultFlipped={false}
          onFlippedChange={setFlipped}
        />

        <div
          className={cn(
            'mt-5 flex items-center justify-center gap-3 transition-opacity',
            flipped ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
        >
          <Button variant="outline" size="lg" onClick={() => mark('unknown')}>
            <XCircle />
            忘了
          </Button>
          <Button variant="primary" size="lg" onClick={() => mark('known')}>
            <CheckCircle2 />
            记得
          </Button>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => advance(-1)} disabled={cursor === 0}>
            <ChevronLeft />
            上一张
          </Button>
          <div className="flex gap-1" role="progressbar" aria-valuenow={cursor + 1} aria-valuemin={1} aria-valuemax={deck.length}>
            {deck.slice(0, 40).map((card, i) => (
              <span
                key={card.id}
                className={cn(
                  'h-1.5 w-1.5 rounded-full transition-colors',
                  i === cursor
                    ? 'bg-[var(--color-accent)]'
                    : record.unknown.includes(card.id)
                      ? 'bg-[var(--color-danger)]/70'
                      : record.known.includes(card.id)
                        ? 'bg-[var(--color-ok)]/70'
                        : 'bg-[var(--color-line)]',
                )}
              />
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => advance(1)}
            disabled={cursor >= deck.length - 1}
          >
            下一张
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  )
}
