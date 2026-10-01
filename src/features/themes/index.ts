/**
 * Theme feature barrel.
 *
 * One import for the whole theme system:
 *
 * ```ts
 * import { THEMES, getTheme, themeToBinding } from '@/features/themes'
 * ```
 *
 * The order below mirrors the data flow: types (the contracts) -> registry
 * (which themes exist) -> engine (how a theme becomes CSS custom properties).
 */

export type {
  ThemeBinding,
  ThemeCategory,
  ThemeDefinition,
  ThemeLayout,
  ThemeMode,
  ThemeTexture,
  ThemeTypography,
  ThemeVariables,
} from '@/types'
export { THEME_CATEGORIES, THEME_CATEGORY_LABELS } from '@/types'

export {
  DEFAULT_THEME_ID,
  THEME_IDS,
  THEMES,
  getDefaultTheme,
  getTheme,
  getThemesByCategory,
  isValidThemeId,
  isVerticalTheme,
} from './registry'

export {
  resolveThemeId,
  themeToBinding,
  themeToCssVariables,
  themeToStyle,
  themeVariableName,
  usesVerticalWriting,
} from './engine'
