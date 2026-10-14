import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, ChevronDown, Loader2, Pencil, Search, Trash2, X } from 'lucide-react'
import { PageHeader } from '@/shell/AppShell'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from '@/ui'
import { useAuth } from '@/lib/auth'
import { bulkCards, getManagedCards, updateCard, type CardInput } from '@/lib/api'
import type { ReviewCard } from '@/lib/api'
import { STATUS_LABELS } from '@/types'
import { compareFacetNames } from '@/lib/search'
import { slugify } from '@/lib/parser'
import { formatRelative } from '@/lib/duration'
import { cn } from '@/lib/cn'

/**
 * 闪卡管理器（/manage）。
 *
 * 「一张表看住整个库」：搜索、按分类与掌握度筛选、排序、行内编辑、批量删除。
 *
 * 全部规则都遵守项目既有约定：
 *   · 不复制卡片组件，这里只做元数据表格（可读性 > 装饰）。
 *   · 删除走软删除 + 批量接口（AGENTS.md §16），卡片不真正消失。
 *   · 行内编辑即 PUT /api/cards/:id 整卡替换，与编辑器保存走同一条路。
 *   · 列表数据来自登录态的 GET /api/review/manage；公开浏览零门槛不受影响。
 */

type Mastery = 'all' | 'new' | 'overdue' | 'learning' | 'review' | 'ahead'
type SortKey = 'due' | 'title' | 'category' | 'stability' | 'difficulty' | 'updated'

const MASTERY_OPTIONS: { value: Mastery; label: string }[] = [
  { value: 'all', label: '全部状态' },
  { value: 'new', label: '未学' },
  { value: 'overdue', label: '已到期' },
  { value: 'learning', label: '学习中' },
  { value: 'review', label: '复习中' },
  { value: 'ahead', label: '未到期' },
]

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'due', label: '按到期时间' },
  { value: 'title', label: '按标题' },
  { value: 'category', label: '按分类' },
  { value: 'stability', label: '按记忆稳定性' },
  { value: 'difficulty', label: '按难度' },
  { value: 'updated', label: '按更新时间' },
]

const EDITABLE_STATUS = ['draft', 'review', 'published', 'archived'] as const

/** 掌握度判定：与 DashboardPage 的 STATE_LABEL 保持一致。 */
function masteryOf(card: ReviewCard): Mastery {
  if (!card.schedule) return 'new'
  if (card.overdue) return 'overdue'
  return card.schedule.state === 2 ? 'ahead' : 'learning'
}

export default function FlashcardManagerPage() {
  const { token, isAuthed } = useAuth()
  const [cards, setCards] = useState<ReviewCard[]>([])
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'ready'>('idle')
  const [error, setError] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [mastery, setMastery] = useState<Mastery>('all')
  const [sort, setSort] = useState<SortKey>('due')

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const reloadRef = useRef<(() => void) | null>(null)

  const load = useCallback(async () => {
    if (!token) return
    setLoadState('loading')
    setError(null)
    try {
      const payload = await getManagedCards(token)
      setCards(payload.cards)
      // 上次的选择可能在这次数据里已经不存在，清掉避免误删。
      setSelected(new Set())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '卡片加载失败。')
    } finally {
      setLoadState('ready')
    }
  }, [token])
  reloadRef.current = load

  useEffect(() => {
    void load()
  }, [load])

  const categories = useMemo(() => {
    const names = new Set(cards.map((card) => card.category).filter(Boolean))
    return [...names].sort(compareFacetNames)
  }, [cards])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const rows = cards.filter((card) => {
      if (category !== 'all' && card.category !== category) return false
      if (mastery !== 'all' && masteryOf(card) !== mastery) return false
      if (needle === '') return true
      const haystack = [card.id, card.title, card.category, card.tags.join(' ')].join(' ').toLowerCase()
      return haystack.includes(needle)
    })
    return rows.sort(compareCards(sort))
  }, [cards, category, mastery, query, sort])

  const allSelected = visible.length > 0 && visible.every((card) => selected.has(card.id))

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allSelected) for (const card of visible) next.delete(card.id)
      else for (const card of visible) next.add(card.id)
      return next
    })
  }

  const runBulkDelete = async () => {
    if (!token || selected.size === 0) return
    setSubmitting(true)
    try {
      const { deleted } = await bulkCards([...selected], 'delete', token)
      setMessage(`已删除 ${deleted} 张卡片（软删除，可恢复）。`)
      setConfirmOpen(false)
      setExpanded(null)
      await (reloadRef.current ?? load)()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '批量删除失败。')
      setConfirmOpen(false)
    } finally {
      setSubmitting(false)
    }
  }

  // isAuthed 为真时 token 必然非空；这里一并收窄，下面的 JSX 就不用到处 `!`。
  if (!isAuthed || !token) {
    return (
      <div>
        <PageHeader title="闪卡管理器" description="管理整个卡片库的调度与元数据。" />
        <EmptyState
          icon={<Search className="size-8" />}
          title="登录后管理卡片"
          description="卡片管理需要编辑权限（登录）。浏览与复习记录相同条件。"
          action={
            <Button asChild variant="primary" size="sm">
              <Link to="/login">去登录</Link>
            </Button>
          }
        />
      </div>
    )
  }

  if (loadState === 'loading' || loadState === 'idle') {
    return (
      <div className="py-8">
        <PageHeader title="闪卡管理器" description="正在加载卡片…" />
        <Skeleton className="h-72" />
      </div>
    )
  }

  if (error && cards.length === 0) {
    return (
      <div>
        <PageHeader title="闪卡管理器" />
        <EmptyState
          icon={<Search className="size-8" />}
          title="卡片加载失败"
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

  return (
    <div>
      <PageHeader
        title="闪卡管理器"
        description={`${visible.length} / ${cards.length} 张卡片 · 搜索、筛选、排序、行内编辑、批量删除`}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/dashboard">成长看板</Link>
          </Button>
        }
      />

      {/* 工具行：搜索 + 分类 + 掌握度 + 排序 */}
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <Field label="搜索" className="min-w-[12rem] flex-1">
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-ink-3)]"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="标题、ID、标签…"
              aria-label="搜索卡片"
              className="pl-9"
            />
          </div>
        </Field>

        <Field label="分类">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-[10rem]" aria-label="按分类筛选">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部分类</SelectItem>
              {categories.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="掌握度">
          <Select value={mastery} onValueChange={(value) => setMastery(value as Mastery)}>
            <SelectTrigger className="w-[9rem]" aria-label="按掌握度筛选">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MASTERY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="排序">
          <Select value={sort} onValueChange={(value) => setSort(value as SortKey)}>
            <SelectTrigger className="w-[10rem]" aria-label="排序方式">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      {message ? (
        <p className="mb-3 flex items-center gap-1.5 rounded-[var(--radius-panel)] border border-[var(--color-ok)]/40 bg-[var(--color-ok)]/8 px-3 py-2 text-xs text-[var(--color-ink-2)]">
          <CheckCircle2 aria-hidden className="size-3.5 text-[var(--color-ok)]" />
          {message}
        </p>
      ) : null}

      {visible.length === 0 ? (
        <EmptyState
          icon={<Search className="size-8" />}
          title="没有匹配的卡片"
          description="调整筛选条件，或清掉搜索词。"
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setQuery('')
                setCategory('all')
                setMastery('all')
              }}
            >
              重置筛选
            </Button>
          }
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-line)]">
            {/* 表头 */}
            <div className="flex items-center gap-3 border-b border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                aria-label="全选当前列表"
                className="size-3.5 accent-[var(--color-accent)]"
              />
              <span className="flex-1 text-xs text-[var(--color-ink-3)]">
                {selected.size > 0 ? `已选 ${selected.size} 张` : '卡片'}
              </span>
              <span className="hidden text-xs text-[var(--color-ink-3)] sm:block">掌握度</span>
              <span className="hidden w-24 text-right text-xs text-[var(--color-ink-3)] lg:block">下次</span>
            </div>

            <ul className="divide-y divide-[var(--color-line)]">
              {visible.map((card) => (
                <li key={card.id}>
                  <div className="flex items-start gap-3 px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={selected.has(card.id)}
                      onChange={(event) =>
                        setSelected((prev) => {
                          const next = new Set(prev)
                          if (event.target.checked) next.add(card.id)
                          else next.delete(card.id)
                          return next
                        })
                      }
                      aria-label={`选择 ${card.title}`}
                      className="mt-1 size-3.5 shrink-0 accent-[var(--color-accent)]"
                    />

                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/card/${slugify(card.id)}`}
                        className="line-clamp-2 text-sm text-[var(--color-ink)] hover:text-[var(--color-accent)]"
                      >
                        {card.title}
                      </Link>
                      <p className="mt-0.5 truncate text-[0.6875rem] text-[var(--color-ink-3)]">
                        {card.id} · {card.category} · {STATUS_LABELS[card.status]}
                        {card.tags.length > 0 ? ` · ${card.tags.join(' / ')}` : ''}
                      </p>
                    </div>

                    <span className="shrink-0 text-[0.6875rem] text-[var(--color-ink-2)]">
                      {card.schedule ? (
                        <span title={`记忆稳定性 ${card.schedule.stability.toFixed(2)}`}>
                          {card.overdue ? '到期' : '已掌握'}
                        </span>
                      ) : (
                        '未学'
                      )}
                    </span>

                    <span className="hidden w-24 shrink-0 text-right text-[0.6875rem] tabular-nums text-[var(--color-ink-3)] lg:block">
                      {card.due ? formatRelative(card.due) : '—'}
                    </span>

                    {/* 行内编辑入口 */}
                    <button
                      type="button"
                      aria-label={`编辑 ${card.title}`}
                      aria-expanded={expanded === card.id}
                      onClick={() => setExpanded((prev) => (prev === card.id ? null : card.id))}
                      className="shrink-0 rounded-[var(--radius-pill)] p-1 text-[var(--color-ink-3)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]"
                    >
                      <ChevronDown
                        className={cn(
                          'size-4 transition-transform',
                          expanded === card.id && 'rotate-180',
                        )}
                      />
                    </button>
                  </div>

                  {expanded === card.id ? (
                    <InlineEditor
                      card={card}
                      token={token}
                      onDone={async (note) => {
                        setMessage(note)
                        setExpanded(null)
                        await (reloadRef.current ?? load)()
                      }}
                      disabled={submitting}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-3 text-xs text-[var(--color-ink-3)]">
            小提示：只显示已发布卡片；草稿/归档请在编辑器里调整状态。「记忆稳定性」越高表示这张卡越难忘记。
          </p>
        </>
      )}

      {/* 批量操作条 */}
      {selected.size > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-30 mx-auto flex w-full max-w-md items-center justify-between gap-2 border-t border-[var(--color-line)] bg-[var(--color-surface)]/95 px-4 py-2.5 backdrop-blur lg:absolute lg:right-0 lg:left-auto lg:w-auto lg:rounded-[var(--radius-panel)] lg:border">
          <span className="text-xs text-[var(--color-ink-2)]">已选 {selected.size} 张</span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              <X />
              取消
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfirmOpen(true)}>
              <Trash2 />
              删除
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除 {selected.size} 张卡片？</DialogTitle>
            <DialogDescription>
              删除是软删除（deleted_at），卡片会从所有公开列表消失，但数据库里仍在。
              这也会一并移除这些卡片的复习调度记录。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(false)} disabled={submitting}>
              取消
            </Button>
            <Button variant="primary" size="sm" onClick={() => void runBulkDelete()} disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" /> : <Trash2 />}
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* 行内编辑                                                                    */
/* -------------------------------------------------------------------------- */

function InlineEditor({
  card,
  token,
  onDone,
  disabled,
}: {
  card: ReviewCard
  token: string
  onDone: (note: string) => Promise<void>
  disabled: boolean
}) {
  const [title, setTitle] = useState(card.title)
  const [category, setCategory] = useState(card.category)
  const [status, setStatus] = useState<string>(card.status)
  const [tags, setTags] = useState(card.tags.join(', '))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    const trimmedTitle = title.trim()
    const trimmedCategory = category.trim()
    if (trimmedTitle === '' || trimmedCategory === '') {
      setError('标题与分类不能为空。')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const input: CardInput = {
        title: trimmedTitle,
        question: card.question,
        answer: card.answer,
        category: trimmedCategory,
        subcategory: card.subcategory,
        difficulty: card.difficulty,
        status: status as CardInput['status'],
        theme: card.theme,
        tags: tags
          .split(/[,，]/)
          .map((tag) => tag.trim())
          .filter(Boolean),
        aliases: card.aliases,
        related: card.related,
      }
      await updateCard(card.id, input, token!)
      await onDone(`已更新《${trimmedTitle}》`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存失败。')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border-t border-[var(--color-line)] bg-[var(--color-surface-2)]/60 px-3 py-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="标题">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} />
        </Field>
        <Field label="分类">
          <Input value={category} onChange={(event) => setCategory(event.target.value)} />
        </Field>
        <Field label="标签（逗号分隔）">
          <Input value={tags} onChange={(event) => setTags(event.target.value)} />
        </Field>
        <Field label="状态">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full" aria-label="卡片状态">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EDITABLE_STATUS.map((value) => (
                <SelectItem key={value} value={value}>
                  {STATUS_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      {error ? <p className="mt-2 text-xs text-[var(--color-danger)]">{error}</p> : null}

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-[0.6875rem] text-[var(--color-ink-3)]">
          {card.schedule
            ? `稳定性 ${card.schedule.stability.toFixed(2)} · 难度 ${card.schedule.difficulty.toFixed(2)} · 复习 ${card.schedule.reps} 次`
            : '还没复习过'}
        </span>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to={`/editor/${slugify(card.id)}`}>
              <Pencil />
              去编辑器
            </Link>
          </Button>
          <Button variant="primary" size="sm" disabled={saving || disabled} onClick={() => void save()}>
            {saving ? <Loader2 className="animate-spin" /> : <Pencil />}
            保存
          </Button>
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* 排序                                                                        */
/* -------------------------------------------------------------------------- */

/** 先按到期时间（未到期的排在最后），再按次级键稳定输出。 */
function compareCards(sort: SortKey) {
  return (a: ReviewCard, b: ReviewCard) => {
    const time = (card: ReviewCard) => (card.due ? new Date(card.due).getTime() : Number.MAX_SAFE_INTEGER)
    switch (sort) {
      case 'due':
        return time(a) - time(b)
      case 'title':
        return compareFacetNames(a.title, b.title)
      case 'category':
        return compareFacetNames(a.category, b.category) || compareFacetNames(a.title, b.title)
      case 'stability':
        return (a.schedule?.stability ?? -1) - (b.schedule?.stability ?? -1)
      case 'difficulty':
        return (b.schedule?.difficulty ?? -1) - (a.schedule?.difficulty ?? -1)
      case 'updated':
        return (b.updated_at ?? '').localeCompare(a.updated_at ?? '')
      default:
        return 0
    }
  }
}
