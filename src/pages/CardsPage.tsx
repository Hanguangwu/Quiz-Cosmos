import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Library } from 'lucide-react'
import { PageHeader } from '@/shell/AppShell'
import { KnowledgeCard } from '@/features/cards'
import { ActiveFilterChips, FilterBar, filterCards, readFilters } from '@/features/search/FilterBar'
import { Button, EmptyState, Skeleton } from '@/ui'
import { useKnowledge } from '@/lib/knowledge-context'
import { useCardThemePreference } from '@/shell/preferences'
import { STATUS_LABELS } from '@/types'

/**
 * Card browser (design-plan §13 `/cards`). Defaults to published cards only —
 * `status: published` is the gate for the public index (AGENTS.md §6).
 */
export default function CardsPage() {
  const { index, loading } = useKnowledge()
  const [params] = useSearchParams()
  const [themeId] = useCardThemePreference()
  const filters = readFilters(params)

  const cards = useMemo(() => {
    if (!index) return []
    const status = filters.status ?? 'published'
    const base = index.cards.filter((card) => card.status === status)
    return filterCards(base, filters)
  }, [index, filters])

  return (
    <div>
      <PageHeader
        title="全部卡片"
        description={
          index
            ? `${cards.length} / ${index.total} 张卡片${filters.status && filters.status !== 'published' ? ` · 状态：${STATUS_LABELS[filters.status]}` : ''}`
            : undefined
        }
        actions={
          <Button asChild variant="primary" size="sm">
            <Link to="/editor">新建卡片</Link>
          </Button>
        }
      />

      {index ? (
        <div className="mb-5 space-y-3">
          <FilterBar
            filters={filters}
            categories={index.categories}
            tags={index.tags}
            showStatus
          />
          <ActiveFilterChips filters={filters} />
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
      ) : cards.length === 0 ? (
        <EmptyState
          icon={<Library className="size-8" />}
          title="没有匹配的卡片"
          description="调整筛选条件，或在 content/**/*.md 中添加新卡片。"
          action={
            <Button asChild variant="outline" size="sm">
              <Link to="/">返回总览</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <KnowledgeCard key={card.id} card={card} size="sm" themeId={themeId} />
          ))}
        </div>
      )}
    </div>
  )
}
