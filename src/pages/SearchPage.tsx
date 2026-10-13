import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search as SearchIcon, Library } from 'lucide-react'
import { PageHeader } from '@/shell/AppShell'
import { CardTags, KnowledgeCard } from '@/features/cards'
import { ActiveFilterChips, FilterBar, readFilters } from '@/features/search/FilterBar'
import { Button, EmptyState, Skeleton } from '@/ui'
import { useKnowledge } from '@/lib/knowledge-context'
import { createSearchEngine } from '@/lib/search'
import { SITE } from '@/lib/site'
import { cn } from '@/lib/cn'

/**
 * Search page (`/search`). Query state lives in the URL, so a search is
 * shareable. Text search runs client-side over the in-memory index through
 * Fuse.js — no server round trip (AGENTS.md §15).
 */
export default function SearchPage() {
  const { index, loading } = useKnowledge()
  const [params, setParams] = useSearchParams()
  const [draft, setDraft] = useState(params.get('q') ?? '')

  const filters = readFilters(params)
  const query = params.get('q') ?? ''

  // Keep the input in sync when the URL changes from outside (e.g. the shell
  // search box submitting while this page is mounted).
  useEffect(() => {
    setDraft(query)
  }, [query])

  const engine = useMemo(() => (index ? createSearchEngine(index) : null), [index])

  const results = useMemo(() => {
    if (!engine) return { hits: [], total: 0, tookMs: 0 }
    return engine.search({ query, category: filters.category, tag: filters.tag, difficulty: filters.difficulty, status: filters.status })
  }, [engine, query, filters])

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (draft.trim()) next.set('q', draft.trim())
        else next.delete('q')
        return next
      },
      { replace: true },
    )
  }

  return (
    <div>
      <PageHeader
        title="搜索"
        description={
          index && query
            ? `${results.total} 条结果，用时 ${results.tookMs}ms`
            : '在标题、别名、标签、ID 与正文中检索。'
        }
      />

      <form role="search" onSubmit={submit} className="relative mb-4">
        <SearchIcon
          aria-hidden
          className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-[var(--color-ink-3)]"
        />
        <input
          type="search"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="输入关键词，例如：进程、GC、索引…"
          aria-label="搜索关键词"
          autoFocus
          className="h-11 w-full rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-surface)] pl-11 pr-4 text-base text-[var(--color-ink)] placeholder:text-[var(--color-ink-3)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/25"
        />
      </form>

      {index ? (
        <div className="mb-5 space-y-3">
          <FilterBar filters={filters} categories={index.categories} tags={index.tags} showStatus />
          <ActiveFilterChips filters={filters} />
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : results.hits.length === 0 ? (
        <EmptyState
          icon={<Library className="size-8" />}
          title={query ? `没有找到与“${query}”相关的卡片` : '输入关键词开始搜索'}
          description={
            query
              ? '试试更短的关键词，或清除筛选条件。'
              : `索引共收录 ${index?.total ?? 0} 张卡片。`
          }
          action={
            <Button asChild variant="outline" size="sm">
              <Link to="/cards">浏览全部卡片</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {results.hits.map(({ card, matched }) => (
            <article
              key={card.id}
              className="rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-surface)] p-4 transition-colors hover:border-[var(--color-accent)]/40"
            >
              <Link to={`/card/${card.slug}`} className="group block">
                <h2 className="text-[0.98rem] font-medium leading-snug text-[var(--color-ink)] group-hover:text-[var(--color-accent)]">
                  {card.title}
                </h2>
              </Link>

              <p
                className={cn(
                  'mt-1.5 text-[0.82rem] leading-relaxed text-[var(--color-ink-3)]',
                  card.answer ? 'kc-clamp-3' : 'kc-clamp-2',
                )}
              >
                {card.question || card.text}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <CardTags tags={card.tags} limit={5} />
                {matched.length > 0 ? (
                  <span className="text-[0.7rem] text-[var(--color-ink-3)]">
                    命中：{matched.join('、')}
                  </span>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}

      <p className="mt-8 text-center text-xs text-[var(--color-ink-3)]">
        搜索完全在浏览器内完成，卡片数据实时读取自 Cloudflare D1，{SITE.name} 不上传任何查询。
      </p>
    </div>
  )
}

export { KnowledgeCard }
