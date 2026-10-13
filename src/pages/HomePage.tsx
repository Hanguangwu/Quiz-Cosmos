import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, LayoutGrid, Library, PenLine, PlayCircle, Sparkles, Tags } from 'lucide-react'
import { PageHeader } from '@/shell/AppShell'
import { KnowledgeCard } from '@/features/cards'
import { Button, EmptyState, Skeleton } from '@/ui'
import { useKnowledge } from '@/lib/knowledge-context'
import { useCardThemePreference } from '@/shell/preferences'

/**
 * Dashboard: a knowledge-base overview, not a blog feed —
 * counts, a "continue learning" shelf, and a category browser.
 */

function Stat({
  label,
  value,
  to,
  icon: Icon,
}: {
  label: string
  value: number | string
  to: string
  icon: typeof Library
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3.5 transition-colors hover:border-[var(--color-accent)]/50 hover:bg-[var(--color-surface-2)]"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-panel)] bg-[var(--color-surface-2)] text-[var(--color-accent)] transition-colors group-hover:bg-[var(--color-accent)]/12">
        <Icon aria-hidden className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-lg font-semibold leading-tight text-[var(--color-ink)]">
          {value}
        </span>
        <span className="block truncate text-xs text-[var(--color-ink-3)]">{label}</span>
      </span>
    </Link>
  )
}

export default function HomePage() {
  const { index, loading } = useKnowledge()
  const [themeId] = useCardThemePreference()

  const recent = useMemo(() => {
    if (!index) return []
    return [...index.cards]
      .filter((card) => card.status === 'published')
      .sort((a, b) => (b.updated ?? b.created ?? '').localeCompare(a.updated ?? a.created ?? ''))
      .slice(0, 3)
  }, [index])

  const categories = index?.categories.slice(0, 8) ?? []
  const topTags = index?.tags.slice(0, 18) ?? []

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48" />
        <div className="grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (!index) {
    return (
      <EmptyState
        icon={<Library className="size-8" />}
        title="卡片加载失败"
        description="无法从知识库 API 读取卡片，请稍后重试，或检查网络连接。"
      />
    )
  }

  return (
    <div>
      <PageHeader
        title="总览"
        description="数据实时读取自 Cloudflare D1，公开阅读、登录后可编辑。"
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link to="/review">
                <PlayCircle />
                开始复习
              </Link>
            </Button>
            <Button asChild variant="primary" size="sm">
              <Link to="/editor">
                <PenLine />
                新建卡片
              </Link>
            </Button>
          </>
        }
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="卡片" value={index.total} to="/cards" icon={Library} />
        <Stat label="标签" value={index.tags.length} to="/tags" icon={Tags} />
        <Stat label="分类" value={index.categories.length} to="/categories" icon={LayoutGrid} />
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="flex items-center gap-2 text-sm font-medium text-[var(--color-ink)]">
            <Sparkles aria-hidden className="size-4 text-[var(--color-accent)]" />
            最近更新
          </h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/cards">
              全部
              <ArrowRight />
            </Link>
          </Button>
        </div>

        {recent.length === 0 ? (
          <EmptyState
            title="还没有已发布的卡片"
            description="登录后打开编辑器，创建第一张知识卡片并保存。"
            action={
              <Button asChild variant="primary" size="sm">
                <Link to="/editor">
                  <PenLine />
                  新建卡片
                </Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {recent.map((card) => (
              <KnowledgeCard key={card.id} card={card} size="sm" themeId={themeId} />
            ))}
          </div>
        )}
      </section>

      {categories.length > 0 ? (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-medium text-[var(--color-ink)]">分类</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((category) => (
              <Link
                key={category.name}
                to={`/categories/${encodeURIComponent(category.name)}`}
                className="flex items-center justify-between rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3.5 py-2.5 text-sm transition-colors hover:border-[var(--color-accent)]/50 hover:bg-[var(--color-surface-2)]"
              >
                <span className="truncate text-[var(--color-ink)]">{category.name}</span>
                <span className="ml-2 shrink-0 text-xs tabular-nums text-[var(--color-ink-3)]">
                  {category.count}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {topTags.length > 0 ? (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-medium text-[var(--color-ink)]">热门标签</h2>
          <div className="flex flex-wrap gap-1.5">
            {topTags.map((tag) => (
              <Link
                key={tag.name}
                to={`/tags/${encodeURIComponent(tag.name)}`}
                className="rounded-[var(--radius-pill)] border border-[var(--color-line)] bg-[var(--color-surface)] px-2.5 py-1 text-xs text-[var(--color-ink-2)] transition-colors hover:border-[var(--color-accent)]/50 hover:text-[var(--color-ink)]"
              >
                #{tag.name}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
