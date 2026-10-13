import { useEffect, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Link2, Pencil, Printer } from 'lucide-react'
import { PageHeader } from '@/shell/AppShell'
import {
  CardTags,
  KnowledgeCard,
  READ_MODE_HINT,
  ReadModeToggle,
  useReadModePreference,
} from '@/features/cards'
import { ExportMenu } from '@/features/export/ExportMenu'
import { Button, EmptyState, Separator, Skeleton } from '@/ui'
import { useKnowledge } from '@/lib/knowledge-context'
import { useCardThemePreference } from '@/shell/preferences'
import { resolveCard } from '@/lib/content'
import { STATUS_LABELS } from '@/types'

/**
 * Single card page (`/card/:slug`). The card itself, its metadata, and the
 * export sheet — the Markdown source moved to the editor long ago, because the
 * editor is where a source is actually owned.
 *
 * READING MODE
 * -----------------------------------
 * One card, two ways to read it, and the page owns the choice:
 *
 *   展开  question and answer stacked in normal flow. One continuous surface,
 *        nothing scrolled out of reach, no clipping. This is the default.
 *   翻面  the 3D turn, for the ritual of testing yourself and for a quick look
 *        on a phone.
 *
 * The switch sits in page chrome, ABOVE the card, rather than inside it. A card
 * that is also a flip target cannot host its own mode control without the
 * control competing with the flip for the same click; here there is nothing to
 * compete with. Browsing surfaces (`/`, `/cards`, `/search`, tag and category
 * pages) get no switch at all and stay 翻面, because in a grid the answer
 * should be one tap away and the grid should keep its shape — a grid of cards
 * with two-button switches on each is a wall of toggles.
 *
 * There is no paginated reader. A long answer is one continuous surface; it was
 * never N fixed-height pages.
 */

export default function CardPage() {
  const { slug = '' } = useParams()
  const { index, loading } = useKnowledge()
  const [themeId] = useCardThemePreference()
  const [readMode, setReadMode] = useReadModePreference()

  const card = useMemo(() => (index ? resolveCard(slug, index) : null), [index, slug])

  const related = useMemo(() => {
    if (!index || !card) return []
    return card.related
      .map((id) => resolveCard(id, index))
      .filter((item): item is NonNullable<typeof item> => item !== null)
  }, [index, card])

  const hasAnswer = Boolean(card?.hasAnswer && card.answer.trim().length > 0)

  // A different card is a different document, so scroll back to the top rather
  // than leaving the reader halfway down the previous answer. Flipping back to
  // the front is the component's job — `KnowledgeCard` resets on slug change.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [slug])

  if (loading) return <Skeleton className="h-96" />

  if (!card) {
    return (
      <EmptyState
        icon={<Link2 className="size-8" />}
        title="未找到这张卡片"
        description={`标识 ${slug} 不在索引中，可能已被重命名或删除。`}
        action={
          <Button asChild variant="outline" size="sm">
            <Link to="/cards">返回卡片列表</Link>
          </Button>
        }
      />
    )
  }

  return (
    <div>
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/cards">
            <ArrowLeft />
            返回
          </Link>
        </Button>
      </div>

      <PageHeader
        title={card.title}
        description={`${card.id}${card.status !== 'published' ? ` · ${STATUS_LABELS[card.status]}` : ''}`}
        actions={
          <>
            {/* 导出图片 first: it is what visitors come for on a single card
                page, and an icon-only-looking ghost button used to hide it at
                the end of the row. */}
            <ExportMenu card={card} />
            <Button asChild variant="ghost" size="sm">
              <Link to={`/editor/${card.slug}`}>
                <Pencil />
                编辑
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="min-w-0">
          {hasAnswer ? (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <ReadModeToggle mode={readMode} onChange={setReadMode} />
              <p className="text-xs text-[var(--color-ink-3)]">{READ_MODE_HINT[readMode]}</p>
            </div>
          ) : null}

          <KnowledgeCard
            key={card.slug}
            card={card}
            readMode={readMode}
            size="lg"
            themeId={themeId}
            showDetailLink={false}
          />
        </div>

        <aside className="min-w-0 space-y-5">
          <section>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--color-ink-3)]">
              标签
            </h2>
            <CardTags tags={card.tags} />
          </section>

          {related.length > 0 ? (
            <section>
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--color-ink-3)]">
                相关卡片
              </h2>
              <ul className="space-y-1.5">
                {related.map((item) => (
                  <li key={item.id}>
                    <Link
                      to={`/card/${item.slug}`}
                      className="block rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink-2)] transition-colors hover:border-[var(--color-accent)]/50 hover:text-[var(--color-ink)]"
                    >
                      {item.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <Separator />

          <section>
            <h2 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-[var(--color-ink-3)]">
              <Printer aria-hidden className="size-3" />
              元数据
            </h2>
            <dl className="space-y-1.5 text-xs">
              {[
                ['ID', card.id],
                ['分类', card.subcategory ? `${card.category} / ${card.subcategory}` : card.category],
                ['状态', STATUS_LABELS[card.status]],
                ['长度', `${card.length} 字符`],
                ['创建', card.created ?? '—'],
                ['更新', card.updated ?? '—'],
              ].map(([key, value]) => (
                <div key={key} className="flex justify-between gap-3">
                  <dt className="shrink-0 text-[var(--color-ink-3)]">{key}</dt>
                  <dd className="truncate text-right text-[var(--color-ink-2)]">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {card.aliases.length > 0 ? (
            <section>
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--color-ink-3)]">
                别名
              </h2>
              <p className="text-xs leading-relaxed text-[var(--color-ink-2)]">
                {card.aliases.join('、')}
              </p>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  )
}