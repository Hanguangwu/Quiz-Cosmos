import { useCallback, useEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, RefObject } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Eye, MoveDown, MoveHorizontal, type LucideIcon } from 'lucide-react'
import type { IndexedCard } from '@/types'
import { cn } from '@/lib/cn'
import { Markdown } from '@/features/markdown/Markdown'
import { CardMeta, CardTags } from './CardMeta'
import { resolveThemeId, themeToBinding, usesVerticalWriting } from '@/features/themes'
import { THEMES, getDefaultTheme, getTheme } from '@/features/themes/registry'

/**
 * The knowledge card (AGENTS.md §12).
 *
 * TWO READING MODES, ONE COMPONENT
 * -------------------------------
 *   展开  expand  question and answer in normal document flow, stacked, both
 *                visible, one continuous scroll. The default wherever a long
 *                answer is read, and what the export engine stages.
 *   翻面  flip    the 3D turn: the answer stays hidden until the reader asks
 *                for it. The self-test ritual, and the compact surface a grid
 *                wants.
 *
 * Design contract:
 * - One card component for every theme. Styling flows from the `--card-*`
 *   custom properties bound onto the `.kc-card` root — there is no per-theme
 *   card JSX anywhere (AGENTS.md §10, §28).
 * - The 3D turn is a progressive enhancement: under reduced motion it becomes
 *   a cross-fade. Both faces are always real DOM, so the answer is selectable,
 *   linkable and exportable in either mode.
 * - No pagination. A long humanities or economics answer is one continuous
 *   surface, not N fixed-height pages.
 *
 * WHERE THE MODE CONTROL LIVES
 * ---------------------------
 * Outside the card, in page chrome — see `ReadModeToggle`. A card that is also
 * a flip target cannot host its own mode switch without the switch competing
 * with the flip, and a grid of cards would become a grid of switches.
 *
 * POINTER vs KEYBOARD
 * -------------------
 * Clicking the FRONT face turns the card: on a phone that is the point, and
 * the front holds almost nothing worth selecting. The BACK is never a click
 * target, because the answer is full of text to select, links to follow and
 * formulas to drag sideways. Every flip also has a real `<button>`, so the
 * whole interaction is reachable with Tab and Enter.
 */

export type CardReadMode = 'expand' | 'flip'
export type CardSize = 'sm' | 'md' | 'lg'

export interface KnowledgeCardProps {
  card: IndexedCard
  /** Overrides the card's own `theme` front matter when provided. */
  themeId?: string | null
  /** Start on the back — used by "answer first" views. */
  defaultFlipped?: boolean
  /** 翻面 by default (every grid); 展开 on the single-card page and for export. */
  readMode?: CardReadMode
  size?: CardSize
  /** Whether the card offers a link to its detail page (grid browsing). */
  showDetailLink?: boolean
  /**
   * When false the card is a static surface: no flip, no links, no hints. The
   * export stage sets this so nothing interactive is baked into a PNG.
   */
  interactive?: boolean
  /** Renders the image-source variant. See the export block in tokens.css. */
  exportStage?: boolean
  className?: string
  onFlippedChange?: (flipped: boolean) => void
}

const SIZE_CLASSES: Record<CardSize, string> = {
  sm: 'text-[0.95rem]',
  md: 'text-base',
  lg: 'text-lg',
}

/** Every card answers this the same way, so it is decided once here. */
function questionAddsToTitle(card: IndexedCard): boolean {
  return card.question.trim().length > 0 && !card.question.includes(card.title)
}

export function KnowledgeCard({
  card,
  themeId,
  defaultFlipped = false,
  readMode = 'flip',
  size = 'md',
  showDetailLink = true,
  interactive = true,
  exportStage = false,
  className,
  onFlippedChange,
}: KnowledgeCardProps) {
  const theme = resolveThemeId(themeId ?? card.theme, null, THEMES)
  const definition = getTheme(theme) ?? getDefaultTheme()
  const binding = themeToBinding(definition)

  const surface = {
    card,
    binding,
    vertical: usesVerticalWriting(definition),
    hasAnswer: card.hasAnswer && card.answer.trim().length > 0,
    size,
    showDetailLink,
    interactive,
    exportStage,
  }

  return (
    <div className={className} data-read={readMode}>
      {readMode === 'flip' ? (
        <FlipCard {...surface} defaultFlipped={defaultFlipped} onFlippedChange={onFlippedChange} />
      ) : (
        <ExpandCard {...surface} />
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* 展开                                                                       */
/* -------------------------------------------------------------------------- */

interface SurfaceProps {
  card: IndexedCard
  binding: ReturnType<typeof themeToBinding>
  vertical: boolean
  hasAnswer: boolean
  size: CardSize
  showDetailLink: boolean
  interactive: boolean
  exportStage: boolean
}

/**
 * The reading surface. Plain block flow, no 3D, no window: the card is exactly
 * as tall as its content and the page scrolls. This is also what the export
 * engine stages, so the rhythm between blocks comes from `margin-top` only —
 * html2canvas 1.4.1 does not implement flex `gap` (AGENTS.md §20).
 */
function ExpandCard({
  card,
  binding,
  vertical,
  hasAnswer,
  size,
  showDetailLink,
  exportStage,
}: SurfaceProps) {
  return (
    <article
      {...binding}
      className={cn('kc-card', SIZE_CLASSES[size], vertical && 'kc-vertical')}
      style={binding.style}
      data-export-stage={exportStage ? 'true' : undefined}
    >
      <div className="kc-inline-row justify-between">
        <CardMeta card={card} />
        {showDetailLink ? <DetailLink slug={card.slug} /> : null}
      </div>

      <p className="kc-card__eyebrow mt-5">问题</p>
      <h1 className="mt-2 text-balance">{card.title}</h1>
      {questionAddsToTitle(card) ? <Markdown content={card.question} className="mt-3" /> : null}

      {hasAnswer ? (
        <>
          <hr className="kc-card__rule mt-6" />
          <p className="kc-card__eyebrow mt-4">答案</p>
          <Markdown content={card.answer} className="mt-2" />
        </>
      ) : null}

      <CardTags tags={card.tags} limit={10} className="mt-6" />
    </article>
  )
}

/* -------------------------------------------------------------------------- */
/* 翻面                                                                       */
/* -------------------------------------------------------------------------- */

interface FlipCardProps extends SurfaceProps {
  defaultFlipped: boolean
  onFlippedChange?: (flipped: boolean) => void
}

function FlipCard({
  card,
  binding,
  vertical,
  hasAnswer,
  size,
  showDetailLink,
  interactive,
  defaultFlipped,
  onFlippedChange,
}: FlipCardProps) {
  const [flipped, setFlipped] = useState(defaultFlipped)
  const motion = useFlipMotion()
  const frontRef = useRef<HTMLElement>(null)
  const backRef = useRef<HTMLDivElement>(null)
  const hint = useOverflowHint(backRef, flipped)

  // A different card is a different question, so start on the front again.
  useEffect(() => {
    setFlipped(defaultFlipped)
  }, [card.slug, defaultFlipped])

  useEffect(() => {
    onFlippedChange?.(flipped)
  }, [flipped, onFlippedChange])

  /**
   * The face you cannot see must also be out of reach. `backface-visibility`
   * only hides pixels, so without this, Tab would walk into the answer's links
   * while the question is still showing. `inert` covers the whole subtree, the
   * markdown's own links included.
   */
  useEffect(() => {
    setFaceHidden(frontRef.current, flipped)
    setFaceHidden(backRef.current, !flipped)
  }, [flipped])

  const flip = useCallback(() => setFlipped((previous) => !previous), [])

  const handleFrontClick = (event: ReactMouseEvent<HTMLElement>) => {
    if (!interactive || !hasAnswer || flipped) return
    const target = event.target
    if (target instanceof Element && target.closest('a, button, input, select, textarea')) return
    // A click that ends a text selection is a copy, not a flip.
    if (typeof window !== 'undefined' && String(window.getSelection() ?? '') !== '') return
    flip()
  }

  const faceClass = cn(
    'kc-card kc-stack kc-flip-face',
    SIZE_CLASSES[size],
    vertical && 'kc-vertical',
  )
  const faceStyle = { ...binding.style, ['--kc-stack-gap' as string]: '0.9rem' }

  return (
    /* `data-size` lives here, not on the card: the per-size window height is a
       property of the 3D scene (`.kc-flip-scene[data-size=…]`), not of a face. */
    <div className="kc-flip-scene" data-size={size} data-flipped={String(flipped)} data-motion={motion}>
      <div className="kc-flip-inner">
        <article
          ref={frontRef}
          {...binding}
          className={faceClass}
          style={faceStyle}
          data-face="front"
          onClick={handleFrontClick}
        >
          <div className="kc-inline-row justify-between">
            <CardMeta card={card} />
            {showDetailLink ? <DetailLink slug={card.slug} /> : null}
          </div>

          <div>
            <h1 className="text-balance">{card.title}</h1>
            {questionAddsToTitle(card) ? (
              <Markdown content={card.question} className="mt-3" />
            ) : null}
          </div>

          <div className="kc-stack__foot">
            <CardTags tags={card.tags} limit={4} />
            {hasAnswer && interactive ? (
              <FlipAction
                className="mt-3"
                icon={Eye}
                label="显示答案"
                hint="点卡片上任意空白处也可以翻面"
                onClick={flip}
              />
            ) : null}
          </div>
        </article>

        {hasAnswer ? (
          <div
            ref={backRef}
            {...binding}
            className={faceClass}
            style={faceStyle}
            data-face="back"
          >
            <div className="kc-inline-row justify-between">
              <span className="kc-card__eyebrow">答案</span>
              {interactive ? (
                <FlipAction icon={ArrowLeft} label="返回问题" onClick={flip} />
              ) : null}
            </div>

            <Markdown content={card.answer} />

            <div className="kc-stack__foot">
              {hint.scrollable ? (
                <p className="kc-card__hint flex items-center">
                  <MoveDown aria-hidden className="mr-1.5 size-3.5 shrink-0" />
                  答案较长，可上下滚动
                </p>
              ) : null}
              {hint.wide ? (
                <p className="kc-card__hint mt-1.5 flex items-center">
                  <MoveHorizontal aria-hidden className="mr-1.5 size-3.5 shrink-0" />
                  公式比卡片宽，可左右滑动
                </p>
              ) : null}
              <CardTags tags={card.tags} limit={6} className="mt-3" />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

/** Remove a hidden face from hit-testing, the tab order and the a11y tree. */
function setFaceHidden(node: HTMLElement | null, hidden: boolean): void {
  if (!node) return
  node.inert = hidden
  if (hidden) node.setAttribute('aria-hidden', 'true')
  else node.removeAttribute('aria-hidden')
}

/* -------------------------------------------------------------------------- */
/* shared pieces                                                              */
/* -------------------------------------------------------------------------- */

function DetailLink({ slug }: { slug: string }) {
  return (
    <Link
      to={`/card/${slug}`}
      className="kc-card__tag opacity-80 transition-opacity hover:opacity-100"
      onClick={(event) => event.stopPropagation()}
    >
      详情
    </Link>
  )
}

function FlipAction({
  icon: Icon,
  label,
  hint,
  className,
  onClick,
}: {
  icon: LucideIcon
  label: string
  hint?: string
  className?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={cn('kc-card__action', className)}
      title={hint}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
    >
      <Icon aria-hidden className="size-3.5" />
      {label}
    </button>
  )
}

type FlipMotion = '3d' | 'fade'

/** The turn — or a cross-fade for anyone who asked for less movement. */
function useFlipMotion(): FlipMotion {
  const [motion, setMotion] = useState<FlipMotion>(() => {
    if (typeof window === 'undefined') return '3d'
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'fade' : '3d'
  })

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setMotion(query.matches ? 'fade' : '3d')
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  return motion
}

interface OverflowHint {
  /** The answer is taller than the flip window. */
  scrollable: boolean
  /** At least one display formula is wider than the card. */
  wide: boolean
}

/**
 * Measure the back face so the reader is told how to reach what does not fit.
 * A ResizeObserver keeps it honest as the card is resized, and a capture-phase
 * `load` listener catches images and fonts that settle after the first paint.
 */
function useOverflowHint(ref: RefObject<HTMLDivElement>, active: boolean): OverflowHint {
  const [hint, setHint] = useState<OverflowHint>({ scrollable: false, wide: false })

  useEffect(() => {
    const node = ref.current
    if (!node || !active) return

    const measure = () => {
      const scrollable = node.scrollHeight - node.clientHeight > 8
      const wide = Array.from(node.querySelectorAll<HTMLElement>('.katex-display')).some(
        (box) => box.scrollWidth - box.clientWidth > 8,
      )
      setHint((previous) =>
        previous.scrollable === scrollable && previous.wide === wide
          ? previous
          : { scrollable, wide },
      )
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    node.addEventListener('load', measure, true)
    return () => {
      observer.disconnect()
      node.removeEventListener('load', measure, true)
    }
  }, [ref, active])

  return hint
}

export default KnowledgeCard
