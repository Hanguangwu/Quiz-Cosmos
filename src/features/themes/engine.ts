import type {
  CSSProperties,
} from 'react'
import {
  DEFAULT_THEME_ID,
  type ThemeDefinition,
  type ThemeVariables,
} from '@/types'

/**
 * Theme Engine.
 *
 * A theme is data. `themeToStyle()` turns a `ThemeDefinition` into the CSS
 * custom properties that `tokens.css` consumes, and nothing else in the app
 * needs to know which theme is active (AGENTS.md §10, §26).
 *
 * Why inline custom properties instead of `[data-theme="x"] {}` blocks: a
 * definition is a plain object, so the theme gallery can render a live preview
 * of any theme without shipping or loading per-theme CSS.
 */

/** Canonical `ThemeVariables` key -> CSS custom property name. */
const VARIABLE_NAMES: Record<keyof ThemeVariables, string> = {
  background: '--card-background',
  foreground: '--card-foreground',
  primary: '--card-primary',
  secondary: '--card-secondary',
  muted: '--card-muted',
  border: '--card-border',
  accent: '--card-accent',
  link: '--card-link',
  codeBackground: '--card-code-background',
  codeForeground: '--card-code-foreground',
  inlineCodeBackground: '--card-inline-code-background',
  blockquote: '--card-blockquote',
  blockquoteBorder: '--card-blockquote-border',
  tableBorder: '--card-table-border',
  tableHeaderBackground: '--card-table-header-background',
  tableStripeBackground: '--card-table-stripe-background',
  math: '--card-math',
  divider: '--card-divider',
  tagBackground: '--card-tag-background',
  tagForeground: '--card-tag-foreground',
  radius: '--card-radius',
  shadow: '--card-shadow',
  lineHeight: '--card-line-height',
  font: '--card-font',
  headingFont: '--card-heading-font',
  cardPadding: '--card-padding',
}

/** A defensive floor so a half-written theme can never make text invisible. */
const MIN_CONTRAST_SHADOW =
  '0 18px 44px -30px rgba(15, 23, 42, 0.55)'

export function themeVariableName(key: keyof ThemeVariables): string {
  return VARIABLE_NAMES[key]
}

/**
 * Flatten a theme into CSS custom properties.
 *
 * `shadow` and `radius` need a guaranteed value because `tokens.css` gives
 * them no visible fallback on a transparent card.
 */
export function themeToCssVariables(theme: ThemeDefinition): Record<string, string> {
  const vars: Record<string, string> = {}
  const v = theme.variables

  for (const key of Object.keys(VARIABLE_NAMES) as (keyof ThemeVariables)[]) {
    const value = v[key]
    if (typeof value === 'string' && value.length > 0) {
      vars[VARIABLE_NAMES[key]] = value
    }
  }

  if (!vars['--card-shadow']) {
    vars['--card-shadow'] = theme.mode === 'dark' ? MIN_CONTRAST_SHADOW : MIN_CONTRAST_SHADOW
  }
  if (!vars['--card-radius']) {
    vars['--card-radius'] = '18px'
  }

  const t = theme.typography
  if (t?.fontFamily) vars['--card-font'] = t.fontFamily
  if (t?.headingFontFamily) vars['--card-heading-font'] = t.headingFontFamily
  if (t?.fontWeight) vars['--card-font-weight'] = t.fontWeight
  if (t?.letterSpacing) vars['--card-letter-spacing'] = t.letterSpacing
  if (t?.lineHeight) vars['--card-line-height'] = t.lineHeight
  if (t?.baseSize) vars['--card-font-size'] = t.baseSize

  const l = theme.layout
  if (l?.cardPadding) vars['--card-padding'] = l.cardPadding
  if (l?.maxWidth) vars['--card-max-width'] = l.maxWidth
  if (l?.blockGap) vars['--card-block-gap'] = l.blockGap

  const tex = theme.texture
  if (tex?.backgroundImage) {
    vars['--card-texture'] = tex.backgroundImage
    vars['--card-texture-size'] = tex.backgroundSize ?? 'auto'
    vars['--card-texture-repeat'] = tex.repeat ?? 'repeat'
    // A texture must never fight the text (AGENTS.md §28).
    vars['--card-texture-opacity'] = String(Math.min(tex.opacity ?? 0, 0.18))
  }

  return vars
}

/** Custom properties ready to spread onto a React element's `style`. */
export function themeToStyle(theme: ThemeDefinition): CSSProperties {
  return themeToCssVariables(theme) as CSSProperties
}

/** Attributes for a card root: the theme id plus the flattened variables. */
export function themeToBinding(theme: ThemeDefinition): {
  'data-theme': string
  'data-texture': 'true' | 'false'
  style: CSSProperties
} {
  return {
    'data-theme': theme.id,
    'data-texture': theme.texture?.backgroundImage ? 'true' : 'false',
    style: themeToStyle(theme),
  }
}

/**
 * Resolve which theme a card should render with.
 *
 * Precedence: the card's own `theme` field, then the reader's preference, then
 * the default. A card may also opt into the *app* chrome theme.
 */
export function resolveThemeId(
  cardTheme: string | null | undefined,
  preferredId: string | null | undefined,
  registry: readonly ThemeDefinition[],
  fallbackId: string = DEFAULT_THEME_ID,
): string {
  if (cardTheme && registry.some((t) => t.id === cardTheme)) return cardTheme
  if (preferredId && registry.some((t) => t.id === preferredId)) return preferredId
  return registry.some((t) => t.id === fallbackId) ? fallbackId : (registry[0]?.id ?? fallbackId)
}

/** True when a vertical writing mode is worth applying (opt-in, degradable). */
export function usesVerticalWriting(theme: ThemeDefinition): boolean {
  return theme.layout?.writingMode === 'vertical'
}
