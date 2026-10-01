import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { Download, ImageDown, Loader2, TriangleAlert } from 'lucide-react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui'
import {
  EXPORT_FORMATS,
  EXPORT_SCALES,
  downloadBlob,
  exportCard,
  suggestFilename,
  type ExportFormat,
} from '@/lib/export'
import { KnowledgeCard } from '@/features/cards'
import { useCardThemePreference } from '@/shell/preferences'
import type { IndexedCard } from '@/types'
import { cn } from '@/lib/cn'

/**
 * Export surface (design-plan §24–25, AGENTS.md §20).
 *
 * WHAT THE IMAGE SOURCE IS
 * ------------------------
 * A hidden off-screen card rendered with the SAME component the reader sees, so
 * the PNG is the page rather than an approximation of it. Two settings make it
 * an image source rather than a screenshot of a UI:
 *
 *   `readMode="expand"`     the 翻面 window is a scroll box, and a scroll box
 *                           rasterises as whatever happens to be scrolled into
 *                           view. 展开 has no window: every line is in the DOM
 *                           at a known offset, so the whole answer is written out.
 *   `interactive={false}`   no flip button, no detail link, no overflow hint —
 *                           nothing that would show up as a control in a
 *                           shared picture.
 *
 * Both are real component props, not CSS overrides, so the export cannot drift
 * from the page when either changes.
 *
 * WIDE FORMULAS
 * -------------
 * A display formula wider than the card is the one thing that cannot fit in a
 * 720px column, and 展开 mode will not crop it. So the stage is measured and
 * widened to whatever the widest formula, code block or table actually needs.
 * It only ever grows, which is what stops the measure/widen cycle from
 * oscillating.
 */

const FORMAT_LABELS: Record<ExportFormat, string> = {
  png: 'PNG（推荐，支持透明）',
  jpg: 'JPG（体积更小）',
  webp: 'WebP（现代浏览器）',
  svg: 'SVG（可无限缩放）',
}

/** The shareable card's natural width, and the ceiling a wide formula may raise it to. */
const STAGE_WIDTH = 720
const STAGE_MAX_WIDTH = 1600

export function ExportMenu({ card, className }: { card: IndexedCard; className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className={className}
        title="把问题与答案一起导出为图片"
      >
        <ImageDown />
        导出图片
      </Button>
      <ExportDialog card={card} open={open} onOpenChange={setOpen} />
    </>
  )
}

function ExportDialog({
  card,
  open,
  onOpenChange,
}: {
  card: IndexedCard
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [format, setFormat] = useState<ExportFormat>('png')
  const [scale, setScale] = useState<number>(2)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stageWidth, setStageWidth] = useState(STAGE_WIDTH)
  const stageRef = useRef<HTMLDivElement>(null)
  const [themeId] = useCardThemePreference()

  const run = async () => {
    const stage = stageRef.current
    const target = stage?.querySelector<HTMLElement>('[data-export-target]')
    if (!target) {
      setError('未找到导出目标，请重试。')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const blob = await exportCard(target, { format, scale, filename: card.id })
      downloadBlob(blob, suggestFilename(card, format))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '导出失败，请重试。')
    } finally {
      setBusy(false)
    }
  }

  /**
 * Widen the stage to fit whatever overflows it. Runs on open and on any later
 * resize of the rendered card (fonts, images, a late KaTeX pass), and only ever
 * increases the width — a shrink loop would never settle.
 *
 * Each candidate is measured by BOTH its scroll width and its own box, because
 * in the export stage the scroll boxes are `overflow: visible` and the two no
 * longer agree. `.katex-display > .katex` is `width: max-content`, so its box IS
 * the formula's natural width, which is exactly the number needed here.
 */
  const fitStage = useCallback(() => {
    const stage = stageRef.current
    const target = stage?.querySelector<HTMLElement>('[data-export-target]')
    if (!stage || !target) return

    const candidates = target.querySelectorAll<HTMLElement>(
      '.katex-display > .katex, .katex-display, pre > code, pre',
    )
    let widest = target.clientWidth
    for (const box of candidates) {
      widest = Math.max(widest, box.scrollWidth, box.getBoundingClientRect().width)
    }

    const surface = target.querySelector<HTMLElement>('.kc-card')
    const style = surface ? getComputedStyle(surface) : null
    const inset = style
      ? parseFloat(style.paddingLeft) +
        parseFloat(style.paddingRight) +
        parseFloat(style.borderLeftWidth) +
        parseFloat(style.borderRightWidth)
      : 0
    const needed = Math.min(STAGE_MAX_WIDTH, Math.ceil(widest + (Number.isFinite(inset) ? inset : 0)))

    setStageWidth((current) => (needed > current ? needed : current))
  }, [])

  useEffect(() => {
    if (!open) return
    // The dialog's content mounts after the open state flips, so wait a frame
    // before measuring; KaTeX and fonts land in the same tick.
    const frame = window.requestAnimationFrame(fitStage)
    const target = stageRef.current?.querySelector<HTMLElement>('[data-export-target]')
    const observer = new ResizeObserver(fitStage)
    if (target) observer.observe(target)
    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [open, fitStage])

  /** External images in the staged card, so a reader is warned before the PNG. */
  const externalImages = useCrossOriginImageCount(stageRef, open)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>导出图片</DialogTitle>
          <DialogDescription>
            问题和答案会一起导出为一张图片。倍率越高越清晰，文件也越大。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="export-format"
              className="mb-1.5 block text-xs font-medium text-[var(--app-ink-2)]"
            >
              格式
            </label>
            <Select value={format} onValueChange={(value) => setFormat(value as ExportFormat)}>
              <SelectTrigger id="export-format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPORT_FORMATS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {FORMAT_LABELS[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <span className="mb-1.5 block text-xs font-medium text-[var(--app-ink-2)]">倍率</span>
            <div className="flex gap-2">
              {EXPORT_SCALES.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setScale(item)}
                  aria-pressed={scale === item}
                  className={cn(
                    'h-9 flex-1 rounded-[var(--radius-panel)] border text-sm transition-colors',
                    scale === item
                      ? 'border-[var(--app-accent)] bg-[var(--app-accent-tint)] font-medium text-[var(--app-accent)]'
                      : 'border-[var(--color-line)] text-[var(--app-ink-2)] hover:bg-[var(--app-surface-2)]',
                  )}
                >
                  {item}x
                </button>
              ))}
            </div>
          </div>

          {externalImages > 0 ? (
            <p className="kc-notice kc-notice--warn">
              <TriangleAlert aria-hidden className="kc-notice__icon size-4" />
              <span>
                检测到 {externalImages} 张外链图片。若导出结果里图片缺失，请改用 SVG 导出，或把图片放到
                assets/images 下使用同源地址。
              </span>
            </p>
          ) : null}

          {error ? (
            <p className="kc-notice kc-notice--danger">
              <TriangleAlert aria-hidden className="kc-notice__icon size-4" />
              <span>{error}</span>
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            取消
          </Button>
          <Button variant="primary" onClick={run} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Download />}
            {busy ? '生成中…' : '导出'}
          </Button>
        </DialogFooter>

        {/* Off-screen render target. Kept in the DOM (not conditionally
            mounted) so the engine always has measurable layout, and measured
            every time the sheet opens so a wide formula is never cropped. */}
        <div
          ref={stageRef}
          aria-hidden
          className="pointer-events-none fixed top-0 left-0 opacity-0"
          style={{ width: stageWidth, zIndex: -1 }}
        >
          <div data-export-target style={{ width: stageWidth }}>
            <KnowledgeCard
              card={card}
              readMode="expand"
              interactive={false}
              exportStage
              size="lg"
              themeId={themeId}
              showDetailLink={false}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * How many of the staged card's images live on another origin.
 *
 * A browser will not hand an <img> from another origin to the export renderer
 * unless that origin opts in with CORS headers, so a cross-origin picture is
 * the one reliable cause of a missing image in an otherwise correct export.
 * The engine is not changed to paper over it: there is no proxy and no
 * build-time fetch, so the reader is told the truth instead (AGENTS.md §21 —
 * content stays portable, not clever).
 *
 * Re-measured whenever the staged card resizes, because an image that has not
 * loaded yet still contributes a source and may turn out to be external.
 */
function useCrossOriginImageCount(ref: RefObject<HTMLDivElement>, active: boolean): number {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!active) return
    const stage = ref.current
    if (!stage) return

    const measure = () => {
      const next = countExternalImages(stage)
      setCount((current) => (current === next ? current : next))
    }
    measure()

    const observer = new ResizeObserver(measure)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [ref, active])

  return count
}

function countExternalImages(root: HTMLElement | null): number {
  if (!root) return 0
  const here = window.location.origin
  let external = 0

  for (const image of Array.from(root.querySelectorAll('img'))) {
    const source = image.currentSrc || image.src
    if (source === '') continue
    // Inline payloads are part of the document and always exportable.
    if (source.startsWith('data:') || source.startsWith('blob:')) continue
    try {
      if (new URL(source, window.location.href).origin !== here) external += 1
    } catch {
      // Unparseable src — treat it as external, since we cannot vouch for it.
      external += 1
    }
  }

  return external
}