import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Filter, X } from 'lucide-react'
import { Button } from '@/ui'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui'
import {
  ALL_STATUSES,
  CARD_STATUSES,
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  STATUS_LABELS,
  type CardStatus,
  type Difficulty,
  type IndexedCard,
} from '@/types'
import { cn } from '@/lib/cn'

/**
 * Shared filter bar for the browse surfaces. State lives in the URL query
 * string so a filtered view is shareable and survives a refresh.
 */

const SORTS = [
  { value: 'updated', label: '最近更新' },
  { value: 'created', label: '最近创建' },
  { value: 'title', label: '标题' },
  { value: 'length', label: '长度' },
] as const

export type SortKey = (typeof SORTS)[number]['value']

export interface CardFilters {
  category: string | null
  tag: string | null
  difficulty: Difficulty | null
  status: CardStatus | null
  sort: SortKey
}

export function readFilters(params: URLSearchParams): CardFilters {
  const rawDifficulty = params.get('difficulty')
  const rawStatus = params.get('status')
  return {
    category: params.get('category'),
    tag: params.get('tag'),
    difficulty: DIFFICULTIES.includes(rawDifficulty as Difficulty)
      ? (rawDifficulty as Difficulty)
      : null,
    status: CARD_STATUSES.includes(rawStatus as CardStatus)
      ? (rawStatus as CardStatus)
      : null,
    sort: SORTS.find((s) => s.value === params.get('sort'))?.value ?? 'updated',
  }
}

/** Apply the non-status facets in memory; search handles text + status. */
export function filterCards(cards: IndexedCard[], filters: CardFilters): IndexedCard[] {
  const out = cards.filter((card) => {
    if (filters.category && card.category !== filters.category) return false
    if (filters.tag && !card.tags.includes(filters.tag)) return false
    if (filters.difficulty && card.difficulty !== filters.difficulty) return false
    return true
  })

  const byName = (a: IndexedCard, b: IndexedCard) => a.title.localeCompare(b.title, 'zh-CN')
  switch (filters.sort) {
    case 'title':
      return out.sort(byName)
    case 'length':
      return out.sort((a, b) => a.length - b.length)
    case 'created':
      return out.sort((a, b) => (b.created ?? '').localeCompare(a.created ?? ''))
    case 'updated':
    default:
      return out.sort((a, b) =>
        (b.updated ?? b.created ?? '').localeCompare(a.updated ?? a.created ?? ''),
      )
  }
}

export function FilterBar({
  filters,
  categories,
  tags,
  showStatus = false,
  className,
}: {
  filters: CardFilters
  categories: { name: string; count: number }[]
  tags: { name: string; count: number }[]
  showStatus?: boolean
  className?: string
}) {
  const [, setParams] = useSearchParams()

  const update = (key: keyof CardFilters, value: string | null) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value === null || value === '') next.delete(key)
        else next.set(key, value)
        return next
      },
      { replace: true },
    )
  }

  const activeCount =
    (filters.category ? 1 : 0) +
    (filters.tag ? 1 : 0) +
    (filters.difficulty ? 1 : 0) +
    (filters.status ? 1 : 0)

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-ink-3)]">
        <Filter aria-hidden className="size-3.5" />
        筛选
        {activeCount > 0 ? (
          <span className="rounded-[var(--radius-pill)] bg-[var(--color-accent)]/15 px-1.5 text-[var(--color-accent)]">
            {activeCount}
          </span>
        ) : null}
      </span>

      <Select
        value={filters.category ?? '__all'}
        onValueChange={(value) => update('category', value === '__all' ? null : value)}
      >
        <SelectTrigger className="h-8 w-auto min-w-28 text-[0.8125rem]" aria-label="按分类筛选">
          <SelectValue placeholder="分类" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all">全部分类</SelectItem>
          {categories.map((category) => (
            <SelectItem key={category.name} value={category.name}>
              {category.name} · {category.count}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.tag ?? '__all'}
        onValueChange={(value) => update('tag', value === '__all' ? null : value)}
      >
        <SelectTrigger className="h-8 w-auto min-w-28 text-[0.8125rem]" aria-label="按标签筛选">
          <SelectValue placeholder="标签" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all">全部标签</SelectItem>
          {tags.map((tag) => (
            <SelectItem key={tag.name} value={tag.name}>
              #{tag.name} · {tag.count}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.difficulty ?? '__all'}
        onValueChange={(value) => update('difficulty', value === '__all' ? null : value)}
      >
        <SelectTrigger className="h-8 w-auto min-w-24 text-[0.8125rem]" aria-label="按难度筛选">
          <SelectValue placeholder="难度" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all">全部难度</SelectItem>
          {DIFFICULTIES.map((difficulty) => (
            <SelectItem key={difficulty} value={difficulty}>
              {DIFFICULTY_LABELS[difficulty]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {showStatus ? (
        <Select
          value={filters.status ?? 'published'}
          onValueChange={(value) => update('status', value === 'published' ? null : value)}
        >
          <SelectTrigger className="h-8 w-auto min-w-24 text-[0.8125rem]" aria-label="按状态筛选">
            <SelectValue placeholder="状态" />
          </SelectTrigger>
          <SelectContent>
            {ALL_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      <Select
        value={filters.sort}
        onValueChange={(value) => update('sort', value)}
      >
        <SelectTrigger className="h-8 w-auto min-w-28 text-[0.8125rem]" aria-label="排序方式">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORTS.map((sort) => (
            <SelectItem key={sort.value} value={sort.value}>
              {sort.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {activeCount > 0 ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            setParams(
              (prev) => {
                const next = new URLSearchParams(prev)
                ;['category', 'tag', 'difficulty', 'status'].forEach((key) => next.delete(key))
                return next
              },
              { replace: true },
            )
          }
        >
          <X />
          清除
        </Button>
      ) : null}
    </div>
  )
}

/** Chips for the facets currently applied, so a filtered view is legible. */
export function ActiveFilterChips({ filters }: { filters: CardFilters }) {
  const [, setParams] = useSearchParams()
  const chips = useMemo(
    () =>
      [
        filters.category ? { key: 'category', label: filters.category } : null,
        filters.tag ? { key: 'tag', label: `#${filters.tag}` } : null,
        filters.difficulty
          ? { key: 'difficulty', label: DIFFICULTY_LABELS[filters.difficulty] }
          : null,
        filters.status ? { key: 'status', label: STATUS_LABELS[filters.status] } : null,
      ].filter(Boolean) as { key: keyof CardFilters; label: string }[],
    [filters],
  )

  if (chips.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={() =>
            setParams(
              (prev) => {
                const next = new URLSearchParams(prev)
                next.delete(chip.key)
                return next
              },
              { replace: true },
            )
          }
          className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 px-2.5 py-0.5 text-xs text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)]/20"
        >
          {chip.label}
          <X aria-hidden className="size-3" />
        </button>
      ))}
    </div>
  )
}
