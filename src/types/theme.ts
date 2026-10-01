/**
 * Theme Engine contracts.
 *
 * A theme is data, not code: a set of CSS custom properties applied to the card
 * root. Adding a theme must never require touching card or markdown rendering.
 *
 * HARD RULE: every colour value must be plain `hex` / `rgb()` / `rgba()`.
 * No `oklch()`, `color-mix()`, `lab()`, `currentColor` or CSS nesting in theme
 * values — the export engine (html2canvas + foreignObject SVG) resolves colours
 * to concrete rgb and cannot handle those.
 */

export const THEME_CATEGORIES = ['minimal', 'art', 'tech', 'chinese', 'nature'] as const
export type ThemeCategory = (typeof THEME_CATEGORIES)[number]

export type ThemeMode = 'light' | 'dark'

export const THEME_CATEGORY_LABELS: Record<ThemeCategory, string> = {
  minimal: '极简',
  art: '艺术',
  tech: '科技',
  chinese: '中国传统',
  nature: '自然',
}

/**
 * Canonical theme variables, camelCase here, kebab-case in CSS.
 * The engine maps `codeBackground` -> `--card-code-background`.
 */
export interface ThemeVariables {
  background: string
  foreground: string
  primary: string
  secondary: string
  muted: string
  border: string
  accent: string
  link: string
  codeBackground: string
  codeForeground: string
  inlineCodeBackground: string
  blockquote: string
  blockquoteBorder: string
  tableBorder: string
  tableHeaderBackground: string
  tableStripeBackground: string
  math: string
  divider: string
  tagBackground: string
  tagForeground: string
  radius: string
  shadow: string
  lineHeight: string
  font: string
  headingFont: string
  cardPadding: string
}

/** Variables a theme may override but which have a global CSS fallback. */
export interface ThemeVariableOverrides {
  /** Repeating background texture, e.g. paper grain. Keep it very subtle. */
  texture: string
  textureOpacity: string
  letterSpacing: string
  fontWeight: string
  /** Max content width of the card, e.g. `720px`. */
  maxWidth: string
  /** Vertical rhythm between block elements. */
  blockGap: string
}

export interface ThemeTypography {
  /** Applied to `--card-font` when set. */
  fontFamily: string
  /** Applied to `--card-heading-font` when set. */
  headingFontFamily: string
  fontWeight: string
  letterSpacing: string
  baseSize: string
  lineHeight: string
}

export interface ThemeTexture {
  /** Any CSS background value, e.g. `url(data:image/svg+xml,...)` or a gradient. */
  backgroundImage: string
  backgroundSize: string
  /** `repeat`, `no-repeat`, `cover`, ... */
  repeat: string
  /** 0–1. Themes that ship a texture should stay under 0.08. */
  opacity: number
}

export interface ThemeLayout {
  cardPadding: string
  maxWidth: string
  blockGap: string
  /**
   * `vertical` enables traditional Chinese top-to-bottom text flow for
   * Chinese-classic themes. The renderer must degrade gracefully to `horizontal`
   * when unsupported.
   */
  writingMode: 'horizontal' | 'vertical'
}

export interface ThemeDefinition {
  id: string
  name: string
  /** Latin/pinyin name, shown under the Chinese name in the gallery. */
  nameLatin: string
  category: ThemeCategory
  description: string
  mode: ThemeMode
  variables: ThemeVariables
  typography?: Partial<ThemeTypography>
  texture?: ThemeTexture
  layout?: Partial<ThemeLayout>
}

/** Runtime shape applied to a card root element: `data-theme` + inline vars. */
export interface ThemeBinding {
  id: string
  attribute: string
  style: Record<string, string>
}

/** The id of the fallback theme, always safe to render with. */
export const DEFAULT_THEME_ID = 'paper' as const
