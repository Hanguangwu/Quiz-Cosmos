import { Link } from 'react-router-dom'
import { Clock3, Gauge, Layers, type LucideIcon } from 'lucide-react'
import { DIFFICULTY_LABELS, STATUS_LABELS, type Difficulty, type IndexedCard } from '@/types'
import { cn } from '@/lib/cn'

/**
 * Card metadata chrome. Everything here is rendered *inside* a themed card
 * root, so it reads `--card-*` variables rather than app tokens.
 *
 * SPACING IS MARGINS, NOT `gap`
 * ------------------------------
 * Every chip row in here is a flex row that also appears in the export stage,
 * and html2canvas 1.4.1 does not implement flex `gap` — chips would come out
 * touching in the exported image while looking correctly spaced on screen
 * (AGENTS.md §20). The same reasoning is why `.kc-card__tags` is margin-based.
 */

const DIFFICULTY_TONE: Record<Difficulty, string> = {
  easy: 'var(--card-tag-background)',
  medium: 'var(--card-table-header-background)',
  hard: 'var(--card-tag-background)',
}

/** A chip's own box: the shared shape, plus a trailing margin for the row. */
const CHIP_CLASS =
  'inline-flex items-center rounded-[var(--card-radius)] px-2 py-0.5 mr-1.5 mb-1.5 text-[0.76em] leading-5 whitespace-nowrap'

const CHIP_STYLE = {
  background: 'var(--card-tag-background)',
  color: 'var(--card-tag-foreground)',
} as const

function Chip({
  icon: Icon,
  children,
  className,
}: {
  icon?: LucideIcon
  children: React.ReactNode
  className?: string
}) {
  return (
    <span className={cn(CHIP_CLASS, className)} style={CHIP_STYLE}>
      {Icon ? <Icon aria-hidden className="mr-1 size-3 opacity-70" /> : null}
      {children}
    </span>
  )
}

export interface CardMetaProps {
  card: Pick<IndexedCard, 'category' | 'subcategory' | 'difficulty' | 'status' | 'updated' | 'length'>
  /** Show the draft/review/archived badge even when published. */
  showStatus?: boolean
  className?: string
}

export function CardMeta({ card, showStatus = false, className }: CardMetaProps) {
  const updated = card.updated ? card.updated.slice(0, 10) : null

  return (
    <div
      className={cn('flex flex-wrap items-center', className)}
      style={{ color: 'var(--card-muted)' }}
    >
      <Chip icon={Layers}>{card.subcategory ?? card.category}</Chip>

      {card.difficulty ? (
        <span
          className={CHIP_CLASS}
          style={{
            background: DIFFICULTY_TONE[card.difficulty],
            color: 'var(--card-tag-foreground)',
          }}
        >
          <Gauge aria-hidden className="mr-1 size-3 opacity-70" />
          {DIFFICULTY_LABELS[card.difficulty]}
        </span>
      ) : null}

      {showStatus && card.status !== 'published' ? (
        <Chip>{STATUS_LABELS[card.status]}</Chip>
      ) : null}

      {updated ? (
        <span className="inline-flex items-center mr-1.5 mb-1.5 text-[0.76em] whitespace-nowrap">
          <Clock3 aria-hidden className="mr-1 size-3 opacity-60" />
          {updated}
        </span>
      ) : null}
    </div>
  )
}

export interface CardTagsProps {
  tags: readonly string[]
  /** Render as links into the tag browser. */
  linkable?: boolean
  limit?: number
  className?: string
}

export function CardTags({ tags, linkable = true, limit, className }: CardTagsProps) {
  if (tags.length === 0) return null
  const shown = typeof limit === 'number' ? tags.slice(0, limit) : tags
  const rest = tags.length - shown.length

  return (
    <div className={cn('kc-card__tags', className)}>
      {shown.map((tag) =>
        linkable ? (
          <Link
            key={tag}
            to={`/tags/${encodeURIComponent(tag)}`}
            className="kc-card__tag transition-opacity hover:opacity-70"
            onClick={(event) => event.stopPropagation()}
          >
            #{tag}
          </Link>
        ) : (
          <span key={tag} className="kc-card__tag">
            #{tag}
          </span>
        ),
      )}
      {rest > 0 ? <span className="kc-card__tag">+{rest}</span> : null}
    </div>
  )
}