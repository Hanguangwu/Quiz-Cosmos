/**
 * Card export (AGENTS.md §20).
 *
 * - png / jpg / webp go through html2canvas at a chosen scale.
 * - svg is built by hand: clone -> inline computed styles -> `<foreignObject>`,
 *   which keeps the result self-contained and infinitely scalable.
 *
 * Two things make SVG export hard and both are handled here:
 * 1. Colours. Modern CSS colours (`oklch()`, `color-mix()`, `color()`) are not
 *    understood by many SVG renderers, so every colour is painted into a 1x1
 *    canvas and read back as concrete `rgb()`.
 * 2. Fonts. Web fonts cannot be inlined; we emit the `font-family` stack only
 *    and let the consumer resolve it.
 *
 * html2canvas is ~200 kB and is needed by only three of the four formats, so it
 * is pulled in with a dynamic `import()` inside `exportCard` rather than a
 * top-level one. The SVG path never touches it. The import sits inside the
 * render `try` block so that a chunk-load failure is reported with the same
 * Chinese `ExportError` as a render failure instead of escaping as an
 * unhandled rejection.
 */

export const EXPORT_FORMATS = ['png', 'jpg', 'webp', 'svg'] as const
export type ExportFormat = (typeof EXPORT_FORMATS)[number]

export const EXPORT_SCALES = [1, 2, 3, 4] as const
export type ExportScale = (typeof EXPORT_SCALES)[number]

export interface ExportOptions {
  format: ExportFormat
  scale?: number
  /** Defaults to the card's resolved `--card-background`. */
  background?: string
  filename?: string
  /** Hard cap on the output width in CSS pixels; the scale is reduced to fit. */
  maxWidth?: number
  /** 0..1, jpeg/webp only. */
  quality?: number
  /** Stage notifications; failures always throw a Chinese `ExportError`. */
  onProgress?: (stage: string) => void
}

export class ExportError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message)
    this.name = 'ExportError'
    if (options && 'cause' in options) this.cause = options.cause
  }
}

const MIME: Record<Exclude<ExportFormat, 'svg'>, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
}

const EXTENSION: Record<ExportFormat, string> = {
  png: 'png',
  jpg: 'jpg',
  webp: 'webp',
  svg: 'svg',
}

/* -------------------------------------------------------------------------- */
/* colour resolution                                                          */
/* -------------------------------------------------------------------------- */

const NEEDS_RESOLUTION = /oklch|oklab|(?:^|[^\w-])lab\s*\(|(?:^|[^\w-])lch\s*\(|color-mix|(?:^|[^\w-])color\s*\(|currentcolor/i

let colorContext: CanvasRenderingContext2D | null | undefined

function context2d(): CanvasRenderingContext2D | null {
  if (colorContext !== undefined) return colorContext
  if (typeof document === 'undefined') {
    colorContext = null
    return null
  }
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  colorContext = canvas.getContext('2d', { willReadFrequently: true })
  return colorContext
}

const colorCache = new Map<string, string>()

/**
 * Turn any CSS colour the browser understands into `rgb()` / `rgba()`.
 * Plain hex and `rgb()` values are returned untouched.
 */
export function resolveColorValue(value: string): string {
  const input = String(value ?? '').trim()
  if (input === '') return input
  if (input === 'transparent' || input === 'none' || input === 'inherit' || input === 'unset') return input
  if (!NEEDS_RESOLUTION.test(input)) return input

  const cached = colorCache.get(input)
  if (cached !== undefined) return cached

  const ctx = context2d()
  if (!ctx) return input
  let resolved = input
  try {
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = '#010203'
    ctx.fillStyle = input
    if (ctx.fillStyle === '#010203') {
      // The browser rejected the value; keep it as-is rather than lying.
      colorCache.set(input, input)
      return input
    }
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillRect(0, 0, 1, 1)
    const { data } = ctx.getImageData(0, 0, 1, 1)
    // A 1x1 read always yields RGBA; the defaults only satisfy the index type.
    const [r = 0, g = 0, b = 0, a = 0] = data
    resolved = a === 0 ? 'transparent' : `rgba(${r}, ${g}, ${b}, ${a / 255})`
  } catch {
    resolved = input
  }
  colorCache.set(input, resolved)
  return resolved
}

/** Resolved `--card-background` of a card root, walking up until one is set. */
export function resolveCardBackground(element: HTMLElement): string {
  let node: HTMLElement | null = element
  while (node) {
    const raw = getComputedStyle(node).getPropertyValue('--card-background').trim()
    if (raw !== '') {
      const resolved = resolveColorValue(raw)
      if (resolved !== '' && resolved !== 'transparent') return resolved
    }
    node = node.parentElement
  }
  const fallback = getComputedStyle(element).backgroundColor
  if (fallback && fallback !== 'rgba(0, 0, 0, 0)' && fallback !== 'transparent') {
    return resolveColorValue(fallback)
  }
  return '#ffffff'
}

/* -------------------------------------------------------------------------- */
/* SVG serialisation                                                          */
/* -------------------------------------------------------------------------- */

/** Properties worth inlining: enough to look identical, small enough to ship. */
const INLINE_PROPERTIES = [
  'display',
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'box-sizing',
  'width',
  'height',
  'min-width',
  'min-height',
  'max-width',
  'max-height',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'border-top-width',
  'border-right-width',
  'border-bottom-width',
  'border-left-width',
  'border-top-style',
  'border-right-style',
  'border-bottom-style',
  'border-left-style',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'border-top-left-radius',
  'border-top-right-radius',
  'border-bottom-right-radius',
  'border-bottom-left-radius',
  'overflow',
  'color',
  'background-color',
  'background-image',
  'background-size',
  'background-position',
  'background-repeat',
  'opacity',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'font-variant',
  'line-height',
  'letter-spacing',
  'word-break',
  'overflow-wrap',
  'white-space',
  'text-align',
  'text-decoration',
  'text-decoration-color',
  'text-indent',
  'text-transform',
  'vertical-align',
  'list-style-type',
  'list-style-position',
  'visibility',
  'transform',
  'transform-origin',
  'box-shadow',
  'table-layout',
  'border-collapse',
  'border-spacing',
  'caption-side',
  'fill',
  'stroke',
  'stroke-width',
] as const

function inlineStyleOf(source: Element, computed: CSSStyleDeclaration): string {
  const parentColor =
    source.parentElement && source !== source.parentElement
      ? getComputedStyle(source.parentElement).color
      : computed.color
  const declarations: string[] = []
  for (const property of INLINE_PROPERTIES) {
    const value = computed.getPropertyValue(property)
    if (value === '' || value === 'none' || value === 'normal' || value === 'auto') continue
    if (property === 'color' || property.endsWith('-color') || property === 'fill' || property === 'stroke') {
      const target = value.trim().toLowerCase() === 'currentcolor' ? parentColor : value
      declarations.push(`${property}: ${resolveColorValue(target)}`)
      continue
    }
    declarations.push(`${property}: ${value}`)
  }
  return declarations.join('; ')
}

const SKIPPED_TAGS = new Set(['SCRIPT', 'NOSCRIPT'])

function inlineTree(source: Element, target: Element): void {
  const computed = getComputedStyle(source)
  target.setAttribute('style', inlineStyleOf(source, computed))

  // Inline handlers never survive serialisation anyway, and they are a hazard in
  // a standalone SVG document.
  for (const attribute of Array.from(target.attributes)) {
    if (attribute.name.toLowerCase().startsWith('on')) target.removeAttribute(attribute.name)
  }

  const sourceChildren = Array.from(source.children).filter(
    (child) => !SKIPPED_TAGS.has(child.tagName.toUpperCase()),
  )
  const targetChildren = Array.from(target.children)
  for (let i = 0; i < sourceChildren.length && i < targetChildren.length; i += 1) {
    const sourceChild = sourceChildren[i]
    const targetChild = targetChildren[i]
    if (sourceChild && targetChild) inlineTree(sourceChild, targetChild)
  }
}

/** Turn a card element into a standalone, scalable SVG string. */
export function elementToSvg(element: HTMLElement, options: ExportOptions = { format: 'svg' }): string {
  const rect = element.getBoundingClientRect()
  const width = Math.max(1, Math.round(rect.width))
  const height = Math.max(1, Math.round(rect.height))

  const clone = element.cloneNode(true) as HTMLElement
  clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml')
  clone.setAttribute('style', `margin:0;width:${width}px;min-height:${height}px;`)
  inlineTree(element, clone)

  const markup = new XMLSerializer().serializeToString(clone)
  const outWidth = options.maxWidth && options.maxWidth > 0 ? Math.min(options.maxWidth, width) : width
  const outHeight = Math.round((height * outWidth) / width)
  const background = options.background ? resolveColorValue(options.background) : resolveCardBackground(element)
  const backdrop = `<rect x="0" y="0" width="${width}" height="${height}" fill="${background}" />`

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${outWidth}" height="${outHeight}" viewBox="0 0 ${width} ${height}">`,
    `<foreignObject x="0" y="0" width="${width}" height="${height}">`,
    backdrop,
    markup,
    '</foreignObject>',
    '</svg>',
  ].join('')
}

/* -------------------------------------------------------------------------- */
/* raster export                                                              */
/* -------------------------------------------------------------------------- */

function supportsWebp(): boolean {
  if (typeof document === 'undefined') return false
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  return canvas.toDataURL('image/webp').startsWith('data:image/webp')
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new ExportError(`导出失败：浏览器无法生成 ${mime} 图片。`))
      },
      mime,
      quality,
    )
  })
}

/* -------------------------------------------------------------------------- */
/* public API                                                                 */
/* -------------------------------------------------------------------------- */

function clampScale(scale: number | undefined, rectWidth: number, maxWidth: number | undefined): number {
  const requested = typeof scale === 'number' && Number.isFinite(scale) && scale > 0 ? scale : 2
  let value = Math.min(requested, 8)
  if (maxWidth && maxWidth > 0 && rectWidth > 0) {
    value = Math.min(value, maxWidth / rectWidth)
  }
  return Math.max(0.1, Math.round(value * 100) / 100)
}

/**
 * Render a card element to a downloadable blob.
 * Always throws `ExportError` with a Chinese message on failure.
 */
export async function exportCard(element: HTMLElement, options: ExportOptions): Promise<Blob> {
  if (!element || typeof element.getBoundingClientRect !== 'function') {
    throw new ExportError('导出失败：没有可导出的卡片元素。')
  }
  if (!options || !EXPORT_FORMATS.includes(options.format)) {
    throw new ExportError(`导出失败：不支持的格式 ${String(options?.format)}。`)
  }
  const report = options.onProgress ?? (() => undefined)

  if (options.format === 'svg') {
    report('正在生成 SVG…')
    try {
      const svg = elementToSvg(element, options)
      return new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
    } catch (error) {
      throw new ExportError('导出失败：SVG 生成过程中出错。', { cause: error })
    }
  }

  const rect = element.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) {
    throw new ExportError('导出失败：卡片尺寸为 0，请确认卡片已渲染完成。')
  }
  const mime = MIME[options.format]
  if (options.format === 'webp' && !supportsWebp()) {
    throw new ExportError('导出失败：当前浏览器不支持 WebP 编码，请改用 PNG。')
  }

  const background = resolveColorValue(options.background?.trim() || resolveCardBackground(element))
  const scale = clampScale(options.scale, rect.width, options.maxWidth)
  const quality = typeof options.quality === 'number' ? Math.min(1, Math.max(0, options.quality)) : 0.95

  report(`正在渲染画布（${scale}x）…`)
  let canvas: HTMLCanvasElement
  try {
    const { default: html2canvas } = await import('html2canvas')
    canvas = await html2canvas(element, {
      scale,
      backgroundColor: background,
      useCORS: true,
      allowTaint: false,
      logging: false,
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      windowWidth: Math.round(rect.width),
      scrollX: 0,
      scrollY: 0,
    })
  } catch (error) {
    throw new ExportError('导出失败：html2canvas 渲染出错（可能是跨域图片或不支持的 CSS）。', {
      cause: error,
    })
  }

  report('正在编码图片…')
  return canvasToBlob(canvas, mime, quality)
}

/** Trigger a browser download for a blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  if (!(blob instanceof Blob)) throw new ExportError('下载失败：没有可下载的数据。')
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Give the browser a tick to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** ASCII-safe file name fragment; CJK is dropped rather than hashed. */
function fileSafe(value: string): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
}

/**
 * `os-001.png` — stable, filesystem-safe, never empty.
 * A Latin title is prefixed when it adds information; a CJK title is dropped
 * because it cannot be slugged (`slugify`'s hash fallback is for routes, not
 * file names).
 */
export function suggestFilename(card: { id: string; title: string }, format: string): string {
  const extension = (EXPORT_FORMATS as readonly string[]).includes(format)
    ? EXTENSION[format as ExportFormat]
    : String(format || 'png').replace(/[^a-z0-9]/gi, '') || 'png'
  const base = fileSafe(card?.id ?? '') || 'card'
  const title = fileSafe(card?.title ?? '')
  return title && title !== base ? `${title}-${base}.${extension}` : `${base}.${extension}`
}
