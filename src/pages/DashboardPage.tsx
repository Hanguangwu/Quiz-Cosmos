import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, CalendarCheck, Flame, Sparkles, Target } from 'lucide-react'
import { PageHeader } from '@/shell/AppShell'
import { Button, EmptyState, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton } from '@/ui'
import { useAuth } from '@/lib/auth'
import { getReviewStats } from '@/lib/api'
import type { ReviewStats, ScheduleState } from '@/lib/api'
import { StudyPet } from '@/features/pet/StudyPet'
import { cn } from '@/lib/cn'

/**
 * 成长看板（/dashboard）。
 *
 * 所有数字都由 review_log / card_schedule 现算，前端不保存任何聚合值。
 * 全年热力图 + 未来 30 天到期预测 + 状态分布 + 连击 + 记忆留存，
 * 复习提醒就是「今天还有 N 张到期」这个数字本身。
 */

const STATE_LABEL: Record<ScheduleState, string> = {
  new: '未学',
  learning: '学习中',
  review: '复习中',
  relearning: '重学中',
}

type Range = '30' | '180' | '365'

const RANGE_DAYS: Record<Range, number> = { '30': 30, '180': 180, '365': 365 }

/** 热力图配色：按次数分档，复用主题已有的语义色而不是自定义色板。 */
function level(count: number): number {
  if (count <= 0) return 0
  if (count <= 4) return 1
  if (count <= 9) return 2
  if (count <= 19) return 3
  return 4
}

const LEVEL_CLASS = [
  'bg-[var(--color-surface-3)]',
  'bg-[var(--color-ok)]/25',
  'bg-[var(--color-ok)]/45',
  'bg-[var(--color-ok)]/70',
  'bg-[var(--color-ok)]',
]

function StatCard({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: typeof Flame
  label: string
  value: string
  note?: string
}) {
  return (
    <div className="rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
      <div className="flex items-center gap-2 text-[var(--color-ink-3)]">
        <Icon aria-hidden className="size-3.5" />
        <span className="text-xs">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--color-ink)]">{value}</p>
      {note ? <p className="mt-1 text-xs text-[var(--color-ink-3)]">{note}</p> : null}
    </div>
  )
}

export default function DashboardPage() {
  const { token, isAuthed } = useAuth()
  const [stats, setStats] = useState<ReviewStats | null>(null)
  const [range, setRange] = useState<Range>('365')
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'ready'>('idle')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token) return
    setLoadState('loading')
    setError(null)
    try {
      setStats(await getReviewStats(token))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '统计数据加载失败。')
    } finally {
      setLoadState('ready')
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  /** 热力图只渲染所选区间，避免 365 列把窄屏挤爆。 */
  const heatmap = useMemo(() => stats?.heatmap.slice(-RANGE_DAYS[range]) ?? [], [stats, range])
  const heatmapColumns = useMemo(() => Math.min(heatmap.length, 53), [heatmap.length])
  const maxForecast = useMemo(
    () => Math.max(1, ...(stats?.forecast ?? []).map((bucket) => bucket.count)),
    [stats],
  )

  if (!isAuthed) {
    return (
      <div>
        <PageHeader title="成长看板" description="复习统计、全年热力图与每日提醒。" />
        <EmptyState
          icon={<BarChart3 className="size-8" />}
          title="登录后查看成长看板"
          description="复习统计属于个人进度，需要登录后从 D1 读取。"
          action={
            <Button asChild variant="primary" size="sm">
              <Link to="/login">去登录</Link>
            </Button>
          }
        />
      </div>
    )
  }

  if (loadState === 'loading' || !stats) {
    return (
      <div className="py-8">
        <PageHeader title="成长看板" description="正在统计…" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <PageHeader title="成长看板" />
        <EmptyState
          icon={<BarChart3 className="size-8" />}
          title="统计数据加载失败"
          description={error}
          action={
            <Button variant="outline" size="sm" onClick={() => void load()}>
              重试
            </Button>
          }
        />
      </div>
    )
  }

  const dueToday = stats.forecast[0]?.count ?? 0

  return (
    <div>
      <PageHeader
        title="成长看板"
        description="全年学习热力图、复习统计与每日提醒。"
        actions={
          <Button variant="ghost" size="sm" onClick={() => void load()}>
            刷新
          </Button>
        }
      />

      {/* 每日复习提醒：今天到期的张数是最重要的那个数字 */}
      <div
        className={cn(
          'mb-5 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-panel)] border p-4',
          dueToday > 0
            ? 'border-[var(--color-accent)]/40 bg-[var(--color-accent)]/8'
            : 'border-[var(--color-ok)]/40 bg-[var(--color-ok)]/8',
        )}
      >
        <div className="flex items-center gap-3">
          <CalendarCheck aria-hidden className="size-5 text-[var(--color-ink-2)]" />
          <div>
            <p className="text-sm font-medium text-[var(--color-ink)]">
              {dueToday > 0 ? `今天还有 ${dueToday} 张到期` : '今天已清空，休息一下 🎉'}
            </p>
            <p className="mt-0.5 text-xs text-[var(--color-ink-3)]">
              FSRS 按你的表现为每张卡单独排期，到期才会出现在复习队列里。
            </p>
          </div>
        </div>
        <Button asChild variant="primary" size="sm" disabled={dueToday === 0}>
          <Link to="/review">开始复习</Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Flame} label="连续复习" value={`${stats.streak} 天`} note="昨天断掉会归零" />
        <StatCard icon={Target} label="今日完成" value={`${stats.today} 次`} note={`本周 ${stats.week} 次`} />
        <StatCard
          icon={Sparkles}
          label="记忆留存"
          value={`${Math.round(stats.retention * 100)}%`}
          note="已学卡的平均可回忆概率"
        />
        <StatCard
          icon={BarChart3}
          label="累计复习"
          value={`${stats.total} 次`}
          note={`有效率 ${Math.round(stats.accuracy * 100)}%`}
        />
      </div>

      {/* 学习宠物：进度完全由上面的统计派生，不引入额外存储 */}
      <StudyPet
        totalReviews={stats.total}
        streak={stats.streak}
        today={stats.today}
        retention={stats.retention}
        className="mt-5"
      />

      <section className="mt-5 rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-[var(--color-ink)]">全年学习热力图</h2>
          <Select value={range} onValueChange={(value) => setRange(value as Range)}>
            <SelectTrigger className="h-7 w-auto text-xs" aria-label="热力图区间">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">近 30 天</SelectItem>
              <SelectItem value="180">近 180 天</SelectItem>
              <SelectItem value="365">近 365 天</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <div
            className="grid gap-1"
            style={{ gridTemplateColumns: `repeat(${heatmapColumns}, minmax(0, 1fr))` }}
          >
            {heatmap.map((bucket) => (
              <div
                key={bucket.date}
                className={cn('aspect-square min-w-[8px] rounded-[3px]', LEVEL_CLASS[level(bucket.count)])}
                title={`${bucket.date} · ${bucket.count} 次复习`}
              />
            ))}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between text-[0.6875rem] text-[var(--color-ink-3)]">
          <span>{heatmap[0]?.date ?? ''}</span>
          <span className="flex items-center gap-1">
            少
            {LEVEL_CLASS.map((className) => (
              <span key={className} className={cn('size-2.5 rounded-[3px]', className)} />
            ))}
            多
          </span>
          <span>今天</span>
        </div>
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
          <h2 className="mb-3 text-sm font-medium text-[var(--color-ink)]">未来 30 天到期预测</h2>
          <div className="flex h-24 items-end gap-0.5">
            {stats.forecast.map((bucket) => (
              <div key={bucket.date} className="group flex min-w-0 flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t-[2px] bg-[var(--color-accent)]/70 transition-colors group-hover:bg-[var(--color-accent)]"
                  style={{ height: `${(bucket.count / maxForecast) * 100}%` }}
                  title={`${bucket.date} · ${bucket.count} 张到期`}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[0.6875rem] text-[var(--color-ink-3)]">
            <span>今天</span>
            <span>30 天后</span>
          </div>
          <p className="mt-2 text-xs text-[var(--color-ink-3)]">
            平均每天 {Math.round(stats.forecast.reduce((sum, b) => sum + b.count, 0) / 30)} 张到期。
          </p>
        </div>

        <div className="rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
          <h2 className="mb-3 text-sm font-medium text-[var(--color-ink)]">卡片掌握度</h2>
          <dl className="space-y-2">
            {(['new', 'learning', 'review', 'relearning'] as ScheduleState[]).map((state) => {
              const count = stats.states[state]
              const total = Math.max(1, stats.published)
              return (
                <div key={state}>
                  <div className="flex items-baseline justify-between text-xs">
                    <dt className="text-[var(--color-ink-2)]">{STATE_LABEL[state]}</dt>
                    <dd className="tabular-nums text-[var(--color-ink-3)]">{count} 张</dd>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-[var(--radius-pill)] bg-[var(--color-surface-3)]">
                    <div
                      className="h-full rounded-[var(--radius-pill)] bg-[var(--color-accent)]/70"
                      style={{ width: `${(count / total) * 100}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </dl>
          <p className="mt-3 text-xs text-[var(--color-ink-3)]">
            已发布 {stats.published} 张 · 首次复习即进入「学习中」，稳定后转为「复习中」。
          </p>
        </div>
      </section>

      <p className="mt-5 text-center text-xs text-[var(--color-ink-3)]">
        近一年有记录 {stats.heatmap.filter((bucket) => bucket.count > 0).length} 天 · 平均每天{' '}
        {Math.round(stats.total / 365)} 次复习
      </p>
    </div>
  )
}
