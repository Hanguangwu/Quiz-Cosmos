import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, PartyPopper, PlayCircle, Volume2, VolumeX } from 'lucide-react'
import { PageHeader } from '@/shell/AppShell'
import { KnowledgeCard } from '@/features/cards'
import { Button, EmptyState, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton } from '@/ui'
import { useKnowledge } from '@/lib/knowledge-context'
import { useAuth } from '@/lib/auth'
import { getReviewSession, reviewCard } from '@/lib/api'
import type { ReviewCard, ReviewRating } from '@/lib/api'
import { useCardThemePreference } from '@/shell/preferences'
import { formatInterval, formatRelative } from '@/lib/duration'
import { useReviewSound, useSoundPreference } from '@/features/review/useReviewSound'
import { resolveCard } from '@/lib/content'
import { cn } from '@/lib/cn'

/**
 * 间隔复习会话（/review）。
 *
 * 队列由服务端决定（`GET /api/review/session`）：到期的卡按到期时间升序排在最
 * 前，其后是没复习过的新卡，未到期的卡今天不出现。评分提交后服务端用 FSRS 算
 * 下一档间隔并落库，本地只负责把这张卡移出队列 —— 前端永远不自己算调度。
 *
 * 快捷键：空格/回车翻面，Again/Hard/Good/Easy 对应 1 2 3 4，快捷键只在当前
 * 卡已翻面时生效，避免误评。
 */

interface GradeButton {
  rating: ReviewRating
  key: string
  label: string
  hint: string
  className: string
}

const GRADES: GradeButton[] = [
  {
    rating: 'again',
    key: '1',
    label: '忘了',
    hint: '重新学',
    className: 'border-[var(--color-danger)]/40 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10',
  },
  {
    rating: 'hard',
    key: '2',
    label: '模糊',
    hint: '想了一会',
    className: 'border-[var(--color-warn)]/40 text-[var(--color-warn)] hover:bg-[var(--color-warn)]/10',
  },
  {
    rating: 'good',
    key: '3',
    label: '记得',
    hint: '顺利想起',
    className: 'border-[var(--color-ok)]/40 text-[var(--color-ok)] hover:bg-[var(--color-ok)]/10',
  },
  {
    rating: 'easy',
    key: '4',
    label: '太简单',
    hint: '秒答',
    className: 'border-[var(--color-accent)]/40 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10',
  },
]

type Scope = 'due' | 'all'

export default function ReviewPage() {
  const { index, loading: indexLoading } = useKnowledge()
  const { token, isAuthed } = useAuth()
  const [themeId] = useCardThemePreference()
  const [soundMuted, setSoundMuted] = useSoundPreference()
  const play = useReviewSound(!soundMuted)

  const [session, setSession] = useState<ReviewCard[]>([])
  const [scope, setScope] = useState<Scope>('due')
  const [cursor, setCursor] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'ready'>('idle')
  const [done, setDone] = useState(false)
  const loadedOnce = useRef(false)

  /** 拉取队列。`refresh` 为 false 时只做首次加载。 */
  const load = useCallback(
    async (target: Scope) => {
      if (!token) return
      setLoadState('loading')
      setError(null)
      try {
        const payload = await getReviewSession(token)
        const cards = payload.cards
        const queue = target === 'due' ? cards.filter((card) => card.overdue || card.schedule === null) : cards
        setSession(target === 'due' ? cards : queue)
        setCursor(0)
        setFlipped(false)
        setDone(target === 'due' ? queue.length === 0 : false)
        loadedOnce.current = true
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : '复习队列加载失败。')
      } finally {
        setLoadState('ready')
      }
    },
    [token],
  )

  useEffect(() => {
    if (loadedOnce.current) return
    loadedOnce.current = true
    void load('due')
  }, [load])

  // 'all' 模式下把未到期的卡也加进来；先从全量会话里切出来，避免多一次请求。
  const deck = useMemo(() => {
    if (scope === 'all') return session
    return session.filter((card) => card.schedule === null || card.overdue)
  }, [scope, session])

  const current = deck[cursor]

  /**
   * `KnowledgeCard` 吃 `IndexedCard`，而队列项是 API 卡片。卡片是已发布的，
   * 所以索引里必然有同一张 —— 直接用索引里的那份，别再复制一份形状。
   */
  const active = useMemo(
    () => (index && current ? resolveCard(current.id, index) : null),
    [index, current],
  )

  /** 本地移除已评分的卡片：队列立即变短，不等下一次请求。 */
  const grade = useCallback(
    async (rating: ReviewRating) => {
      if (!current || busy) return
      setBusy(true)
      play(rating)
      try {
        await reviewCard(current.id, rating, token!)
        setSession((prev) => prev.filter((card) => card.id !== current.id))
        setFlipped(false)
        if (deck.length - 1 <= cursor) setDone(true)
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : '提交评分失败。')
      } finally {
        setBusy(false)
      }
    },
    [busy, current, cursor, deck.length, play, token],
  )
  /** 翻面：进入背面播一次音，回到正面不播。 */
  const toggleFlip = useCallback(() => {
    setFlipped((previous) => {
      const next = !previous
      if (next) play('flip')
      return next
    })
  }, [play])

  const advance = useCallback(
    (delta: number) => {
      setFlipped(false)
      setCursor((prev) => Math.min(Math.max(prev + delta, 0), Math.max(deck.length - 1, 0)))
    },
    [deck.length],
  )

  // 键盘：空格翻面，1-4 评分（需已翻面），左右切换。
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
      if (event.key === ' ' || event.key === 'Enter') {
        if (!current) return
        event.preventDefault()
        toggleFlip()
        return
      }
      if (event.key === 'ArrowRight') return advance(1)
      if (event.key === 'ArrowLeft') return advance(-1)
      // 只有看到答案后才允许评分。
      if (!current || !flipped) return
      const match = GRADES.find((button) => button.key === event.key)
      if (match) {
        event.preventDefault()
        void grade(match.rating)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [advance, current, flipped, grade, toggleFlip])

  if (!isAuthed) {
    return (
      <div>
        <PageHeader title="间隔复习" description="FSRS 调度：学过的都记住。" />
        <EmptyState
          icon={<PlayCircle className="size-8" />}
          title="登录后开始复习"
          description="复习记录需要登录（编辑密码）后写入 D1，调度进度才会被记住。公开浏览无需登录。"
          action={
            <Button asChild variant="primary" size="sm">
              <Link to="/login">去登录</Link>
            </Button>
          }
        />
      </div>
    )
  }

  if (indexLoading || loadState === 'loading' || !index) {
    return (
      <div className="py-8">
        <PageHeader title="间隔复习" description="正在准备今天的队列…" />
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <PageHeader title="间隔复习" />
        <EmptyState
          icon={<PlayCircle className="size-8" />}
          title="复习队列加载失败"
          description={error}
          action={
            <Button variant="outline" size="sm" onClick={() => void load(scope)}>
              重试
            </Button>
          }
        />
      </div>
    )
  }

  if (done || !current) {
    return (
      <div>
        <PageHeader title="间隔复习" description={done ? '今天完成了 ✅' : '队列已清空'} />
        <EmptyState
          icon={<PartyPopper className="size-8" />}
          title={done ? '今天的复习已完成' : '没有待复习的卡片'}
          description={
            done
              ? 'FSRS 会按你的表现为每张卡安排下一次出现的时间，明天见。'
              : '只有已发布且带答案的卡片会进入复习队列。'
          }
          action={
            <div className="flex items-center gap-2">
              <Button asChild variant="primary" size="sm">
                <Link to="/dashboard">去看成长看板</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/cards">浏览卡片</Link>
              </Button>
            </div>
          }
        />
      </div>
    )
  }

  const seen = deck.length - deck.filter((card) => card.schedule === null).length
  const future = session.length - deck.length

  // 索引里找不到就跳过这张（理论上不会：队列里全是已发布卡）。
  if (!active) return <Skeleton className="h-96" />

  return (
    <div>
      <PageHeader
        title="间隔复习"
        description={`第 ${cursor + 1} / ${deck.length} 张 · 空格翻面，1-4 评分 · ${
          current.overdue ? '已复习过' : '新卡'
        } · 下次 ${formatRelative(current.due)}`}
        actions={
          <>
            <Select
              value={scope}
              onValueChange={(value) => {
                setScope(value as Scope)
                setCursor(0)
                setFlipped(false)
                if (value === 'due') setDone(deck.length === 0)
              }}
            >
              <SelectTrigger className="h-8 w-auto text-[0.8125rem]" aria-label="复习范围">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="due">仅到期（{deck.length}）</SelectItem>
                <SelectItem value="all">提前复习全部（{session.length}）</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="sm"
              aria-label={soundMuted ? '开启音效' : '关闭音效'}
              onClick={() => setSoundMuted(!soundMuted)}
            >
              {soundMuted ? <VolumeX /> : <Volume2 />}
              {soundMuted ? '音效关' : '音效开'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void load(scope)}>
              刷新队列
            </Button>
          </>
        }
      />

      <div className="mx-auto max-w-2xl">
        {/* key 让翻卡成为新文档：换卡即重置内部动画。 */}
        <KnowledgeCard
          key={current.id}
          card={active}
          size="lg"
          themeId={themeId}
          showDetailLink={false}
          defaultFlipped={false}
          onFlippedChange={setFlipped}
        />

        {/* 卡片自身的「显示答案」按钮不重复一个翻面入口，这里只呈现大按钮。 */}
        <button
          type="button"
          onClick={toggleFlip}
          aria-label={flipped ? '返回问题' : '显示答案'}
          className={cn(
            'mt-4 w-full rounded-[var(--radius-panel)] border border-dashed border-[var(--color-line-strong)]',
            'py-2 text-xs text-[var(--color-ink-3)] transition-colors',
            'hover:border-[var(--color-accent)]/60 hover:text-[var(--color-ink-2)]',
            flipped ? 'opacity-0 pointer-events-none' : 'opacity-100',
          )}
        >
          空格 / 回车翻面
        </button>

        {current.intervals ? (
          <div
            className={cn(
              'mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4',
              'transition-opacity duration-200',
              flipped ? 'opacity-100' : 'pointer-events-none opacity-0',
            )}
          >
            {GRADES.map((button) => (
              <button
                key={button.rating}
                type="button"
                disabled={busy}
                onClick={() => void grade(button.rating)}
                className={cn(
                  'flex flex-col items-center gap-0.5 rounded-[var(--radius-panel)] border bg-[var(--color-surface)] px-2 py-2.5',
                  'text-sm font-medium transition-all disabled:opacity-50',
                  'hover:-translate-y-px active:translate-y-0',
                  button.className,
                )}
              >
                <span className="flex items-center gap-1.5">
                  {button.rating === 'again' ? null : <CheckCircle2 className="size-3.5" aria-hidden />}
                  {button.label}
                </span>
                <span className="text-[0.6875rem] font-normal text-[var(--color-ink-3)]">
                  {formatInterval(current.intervals?.[button.rating] ?? 0)}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-center text-xs text-[var(--color-ink-3)]">
            新卡第一次评分后，这里会显示四档间隔预览。
          </p>
        )}

        <div className="mt-6 space-y-2">
          <div className="h-1.5 overflow-hidden rounded-[var(--radius-pill)] bg-[var(--color-line)]">
            <div
              className="h-full rounded-[var(--radius-pill)] bg-[var(--color-accent)] transition-[width] duration-300"
              style={{ width: `${deck.length ? ((cursor + 1) / deck.length) * 100 : 0}%` }}
              role="progressbar"
              aria-valuenow={cursor + 1}
              aria-valuemin={1}
              aria-valuemax={deck.length}
            />
          </div>
          <p className="text-center text-xs text-[var(--color-ink-3)]">
            已学过 {seen} 张{scope === 'all' && future > 0 ? ` · 未到期 ${future} 张（提前复习）` : ''}
          </p>
        </div>
      </div>
    </div>
  )
}
