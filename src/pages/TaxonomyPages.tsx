import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Hash, Layers, Tags as TagsIcon } from 'lucide-react'
import { PageHeader } from '@/shell/AppShell'
import { KnowledgeCard } from '@/features/cards'
import { EmptyState, Skeleton } from '@/ui'
import { useKnowledge } from '@/lib/knowledge-context'
import { useCardThemePreference } from '@/shell/preferences'
import { filterCards } from '@/features/search/FilterBar'
import { cn } from '@/lib/cn'

/**
 * Tag and category browsers (design-plan §16–17).
 *
 * Tags and categories are deliberately separate: a category answers "what field
 * is this?", a tag answers "which concept does this card touch?".
 */

function FacetGrid({
  facets,
  hrefFor,
  prefix = '',
  emptyTitle,
  emptyHint,
}: {
  facets: { name: string; count: number }[]
  hrefFor: (name: string) => string
  /** Prepended to the label only; tags read better as `#react`. */
  prefix?: string
  emptyTitle: string
  emptyHint: string
}) {
  if (facets.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyHint} />
  }

  const max = Math.max(...facets.map((facet) => facet.count))

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {facets.map((facet) => (
        <Link
          key={facet.name}
          to={hrefFor(facet.name)}
          className="group relative overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3.5 py-3 transition-colors hover:border-[var(--color-accent)]/50"
        >
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 bg-[var(--color-accent)]/8 transition-all"
            style={{ width: `${Math.max(6, (facet.count / max) * 100)}%` }}
          />
          <span className="relative flex items-baseline justify-between gap-2">
            <span className="truncate text-sm text-[var(--color-ink)]">
              {prefix}
              {facet.name}
            </span>
            <span className="shrink-0 text-xs tabular-nums text-[var(--color-ink-3)]">
              {facet.count}
            </span>
          </span>
        </Link>
      ))}
    </div>
  )
}

function CardGrid({ slugs }: { slugs: string[] }) {
  const { index, loading } = useKnowledge()
  const [themeId] = useCardThemePreference()

  const cards = useMemo(
    () => (index ? filterCards(index.cards.filter((c) => slugs.includes(c.id)), { category: null, tag: null, difficulty: null, status: null, sort: 'updated' }) : []),
    [index, slugs],
  )

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-52" />
        ))}
      </div>
    )
  }

  if (cards.length === 0) {
    return <EmptyState title="没有卡片" description="该筛选下暂时没有已发布的卡片。" />
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {cards.map((card) => (
        <KnowledgeCard key={card.id} card={card} size="sm" themeId={themeId} />
      ))}
    </div>
  )
}

export function TagsPage() {
  const { index, loading } = useKnowledge()
  return (
    <div>
      <PageHeader
        title="标签"
        description={
          index ? `${index.tags.length} 个标签 · 标签表达“这张卡涉及什么概念”` : undefined
        }
      />
      {loading ? (
        <Skeleton className="h-64" />
      ) : (
        <FacetGrid
          facets={index?.tags ?? []}
          hrefFor={(name) => `/tags/${encodeURIComponent(name)}`}
          prefix="#"
          emptyTitle="还没有标签"
          emptyHint="在卡片的 front matter 中添加 tags。"
        />
      )}
    </div>
  )
}

export function TagPage() {
  const { tag = '' } = useParams()
  const { index } = useKnowledge()
  const name = decodeURIComponent(tag)
  const ids = useMemo(
    () => index?.cards.filter((c) => c.tags.includes(name)).map((c) => c.id) ?? [],
    [index, name],
  )

  return (
    <div>
      <PageHeader
        title={`#${name}`}
        description={`${ids.length} 张卡片 · 标签表达“这张卡涉及什么概念”`}
        actions={
          <Link
            to="/tags"
            className="inline-flex items-center gap-1.5 text-xs text-[var(--color-ink-3)] hover:text-[var(--color-ink)]"
          >
            <Hash aria-hidden className="size-3" />
            全部标签
          </Link>
        }
      />
      <CardGrid slugs={ids} />
    </div>
  )
}

export function CategoriesPage() {
  const { index, loading } = useKnowledge()
  const subcategories = useMemo(() => {
    const map = new Map<string, number>()
    for (const card of index?.cards ?? []) {
      const key = card.subcategory ?? card.category
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    return [...map.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }, [index])

  return (
    <div>
      <PageHeader
        title="分类"
        description="分类表达“这是什么领域”，与标签不同。"
      />
      {loading ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 flex items-center gap-1.5 text-sm font-medium text-[var(--color-ink)]">
              <Layers aria-hidden className="size-4" />
              领域
            </h2>
            <FacetGrid
              facets={index?.categories ?? []}
              hrefFor={(name) => `/categories/${encodeURIComponent(name)}`}
              emptyTitle="还没有分类"
              emptyHint="在卡片的 front matter 中添加 category。"
            />
          </section>

          {subcategories.length > 0 ? (
            <section>
              <h2 className="mb-3 flex items-center gap-1.5 text-sm font-medium text-[var(--color-ink)]">
                <TagsIcon aria-hidden className="size-4" />
                子领域
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {subcategories.map((item) => (
                  <Link
                    key={item.name}
                    to={`/cards?tag=${encodeURIComponent(item.name)}`}
                    className={cn(
                      'rounded-[var(--radius-pill)] border border-[var(--color-line)] bg-[var(--color-surface)] px-2.5 py-1 text-xs text-[var(--color-ink-2)] transition-colors',
                      'hover:border-[var(--color-accent)]/50 hover:text-[var(--color-ink)]',
                    )}
                  >
                    {item.name}
                    <span className="ml-1.5 tabular-nums text-[var(--color-ink-3)]">
                      {item.count}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  )
}

export function CategoryPage() {
  const { name = '' } = useParams()
  const { index } = useKnowledge()
  const category = decodeURIComponent(name)
  const ids = useMemo(
    () => index?.cards.filter((c) => c.category === category).map((c) => c.id) ?? [],
    [index, category],
  )

  return (
    <div>
      <PageHeader
        title={category}
        description={`${ids.length} 张卡片 · 领域分类`}
        actions={
          <Link
            to="/categories"
            className="inline-flex items-center gap-1.5 text-xs text-[var(--color-ink-3)] hover:text-[var(--color-ink)]"
          >
            <Layers aria-hidden className="size-3" />
            全部分类
          </Link>
        }
      />
      <CardGrid slugs={ids} />
    </div>
  )
}
