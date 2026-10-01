/**
 * Theme registry — the single source of truth for the 10 approved themes.
 *
 * A theme is DATA, never JSX (AGENTS.md §10, §26). This file only fills in
 * `ThemeDefinition` objects; the engine turns each one into CSS custom
 * properties and the common card renderer does the rest. Adding an 11th theme
 * means appending an object here and (optionally) a flourish block in
 * `themes.css` — nothing else in the app changes.
 *
 * HARD RULE (export engine, AGENTS.md §20): every colour value below is a
 * concrete `hex` / `rgb()` / `rgba()`. Never `oklch()`, `color-mix()`, `lab()`
 * or `currentColor` — html2canvas and the foreignObject SVG writer both need
 * to resolve the colour to plain rgb.
 *
 * Reading this file:
 *   - `variables` is COMPLETE. All 27 canonical fields carry a real value so a
 *     card never depends on a CSS fallback in `tokens.css`.
 *   - `typography` adds only what has no `--card-*` counterpart (base size,
 *     weight, letter spacing). Fonts live in `variables.font` /
 *     `variables.headingFont` as `var(--font-*)` references — never a raw font
 *     stack — so the app can swap the family later without editing 10 themes.
 *   - `layout` adds max width, block gap and the opt-in writing mode.
 *
 * CONTRAST IS A CONSTRAINT, NOT A COINCIDENCE (AGENTS.md §28 puts readability
 * above decoration). Every pair a reader actually looks at clears WCAG AA
 * 4.5:1: body text runs 10.5:1–16.9:1, and the small-print pairs — `muted` on
 * the background (the eyebrow is 0.78em) and `tagForeground` on
 * `tagBackground` — are all held at 4.6:1 or better. Tempting pastels were
 * darkened along the way to get there; if you brighten one, re-check the pair
 * rather than the colour in isolation.
 */

import {
  DEFAULT_THEME_ID,
  type ThemeCategory,
  type ThemeDefinition,
} from '@/types'

/* ==========================================================================
   极简 · minimal
   ========================================================================== */

const APPLE_NOTES: ThemeDefinition = {
  id: 'apple-notes',
  name: '备忘便笺',
  nameLatin: 'Apple Notes',
  category: 'minimal',
  description:
    '接近纯白的纸面，暖黄高亮与极细分隔线，安静到几乎只剩文字本身。适合速记与高频复习。',
  mode: 'light',
  variables: {
    background: '#ffffff',
    foreground: '#1f2329',
    primary: '#16191f',
    secondary: '#59606c',
    muted: '#6f757e',
    border: '#e6e8ec',
    accent: '#e0a92e',
    link: '#1a6fd4',
    codeBackground: '#f5f5f7',
    codeForeground: '#1f2329',
    inlineCodeBackground: '#f0f0f3',
    blockquote: '#59606c',
    blockquoteBorder: '#dcdfe4',
    tableBorder: '#e6e8ec',
    tableHeaderBackground: '#f5f5f7',
    tableStripeBackground: '#fafafa',
    math: '#16191f',
    divider: '#e6e8ec',
    tagBackground: '#fff3cf',
    tagForeground: '#7a5b12',
    radius: '14px',
    shadow: '0 1px 2px rgba(15, 23, 42, 0.05), 0 14px 34px -18px rgba(15, 23, 42, 0.2)',
    lineHeight: '1.75',
    font: 'var(--font-sans)',
    headingFont: 'var(--font-sans)',
    cardPadding: '28px',
  },
  typography: {
    baseSize: '16px',
    fontWeight: '400',
    letterSpacing: '0em',
    lineHeight: '1.75',
  },
  layout: {
    maxWidth: '760px',
    blockGap: '0.9em',
    writingMode: 'horizontal',
  },
}

const PAPER: ThemeDefinition = {
  id: 'paper',
  name: '素纸',
  nameLatin: 'Paper',
  category: 'minimal',
  description:
    '温润米白的纸色配宋体正文，行距舒展、层次极轻。默认主题，长答案连续阅读最稳。',
  mode: 'light',
  variables: {
    background: '#fbfaf7',
    foreground: '#23201c',
    primary: '#1b1815',
    secondary: '#55504a',
    muted: '#777169',
    border: '#e6e1d8',
    accent: '#2f5d7c',
    link: '#2f5d7c',
    codeBackground: '#f4f1ea',
    codeForeground: '#2b2723',
    inlineCodeBackground: '#efece4',
    blockquote: '#5f594f',
    blockquoteBorder: '#ddd6c9',
    tableBorder: '#e6e1d8',
    tableHeaderBackground: '#f4f1ea',
    tableStripeBackground: '#f9f7f2',
    math: '#1b1815',
    divider: '#e6e1d8',
    tagBackground: '#eee9dd',
    tagForeground: '#55504a',
    radius: '12px',
    shadow: '0 1px 2px rgba(31, 25, 20, 0.04), 0 18px 40px -24px rgba(31, 25, 20, 0.26)',
    lineHeight: '1.85',
    font: 'var(--font-serif)',
    headingFont: 'var(--font-serif)',
    cardPadding: '32px',
  },
  typography: {
    baseSize: '16.5px',
    fontWeight: '400',
    letterSpacing: '0.01em',
    lineHeight: '1.85',
  },
  layout: {
    maxWidth: '720px',
    blockGap: '1em',
    writingMode: 'horizontal',
  },
}

/* ==========================================================================
   艺术 · art
   ========================================================================== */

const MEMPHIS: ThemeDefinition = {
  id: 'memphis',
  name: '孟菲斯',
  nameLatin: 'Memphis',
  category: 'art',
  description:
    '海报式撞色、粗黑描边与硬投影，活泼到有点吵，但正文对比度依然稳。适合一眼扫题的复习卡。',
  mode: 'light',
  variables: {
    background: '#fdf7ec',
    foreground: '#16161a',
    primary: '#14141a',
    secondary: '#5c5c66',
    muted: '#6f6f77',
    border: '#14141a',
    accent: '#ff2e88',
    link: '#1f5fd0',
    codeBackground: '#14141a',
    codeForeground: '#fdf7ec',
    inlineCodeBackground: '#ffe066',
    blockquote: '#4a4a55',
    blockquoteBorder: '#ff2e88',
    tableBorder: '#14141a',
    tableHeaderBackground: '#ffe066',
    tableStripeBackground: '#f4ecdc',
    math: '#14141a',
    divider: '#14141a',
    tagBackground: '#d92774',
    tagForeground: '#ffffff',
    radius: '20px',
    shadow: '6px 6px 0 rgba(20, 20, 26, 0.92)',
    lineHeight: '1.7',
    font: 'var(--font-sans)',
    headingFont: 'var(--font-sans)',
    cardPadding: '32px',
  },
  typography: {
    baseSize: '16px',
    fontWeight: '500',
    letterSpacing: '0.01em',
    lineHeight: '1.7',
  },
  layout: {
    maxWidth: '720px',
    blockGap: '1em',
    writingMode: 'horizontal',
  },
}

const RETRO: ThemeDefinition = {
  id: 'retro',
  name: '复古海报',
  nameLatin: 'Retro',
  category: 'art',
  description:
    '七十年代印刷品的奶油底色、芥末黄与铁锈橙，圆角与柔和对齐线，怀旧但不刺眼。',
  mode: 'light',
  variables: {
    background: '#f7ead6',
    foreground: '#3a2b1f',
    primary: '#2f2118',
    secondary: '#6b5643',
    muted: '#736657',
    border: '#dcc39c',
    accent: '#c2521c',
    link: '#1f6f6b',
    codeBackground: '#3f2f22',
    codeForeground: '#f7ead6',
    inlineCodeBackground: '#e9d5b3',
    blockquote: '#6b5643',
    blockquoteBorder: '#c2521c',
    tableBorder: '#dcc39c',
    tableHeaderBackground: '#e9d5b3',
    tableStripeBackground: '#f2e3ca',
    math: '#2f2118',
    divider: '#dcc39c',
    tagBackground: '#ba4f1b',
    tagForeground: '#fdf6ea',
    radius: '22px',
    shadow: '0 2px 0 rgba(90, 60, 30, 0.12), 0 20px 40px -22px rgba(74, 48, 20, 0.36)',
    lineHeight: '1.75',
    font: 'var(--font-serif)',
    headingFont: 'var(--font-sans)',
    cardPadding: '32px',
  },
  typography: {
    baseSize: '16px',
    fontWeight: '500',
    letterSpacing: '0.02em',
    lineHeight: '1.75',
  },
  layout: {
    maxWidth: '740px',
    blockGap: '1em',
    writingMode: 'horizontal',
  },
}

/* ==========================================================================
   科技 · tech
   ========================================================================== */

const CYBERPUNK: ThemeDefinition = {
  id: 'cyberpunk',
  name: '赛博霓虹',
  nameLatin: 'Cyberpunk',
  category: 'tech',
  description:
    '近黑底上的洋红与青色辉光，标题换成等宽大写，边线带冷光。技术类卡片的默认语气。',
  mode: 'dark',
  variables: {
    background: '#0a0713',
    foreground: '#e6e1f5',
    primary: '#ffffff',
    secondary: '#b3a9d6',
    muted: '#7d739f',
    border: '#2a2145',
    accent: '#ff2ea6',
    link: '#22e6ff',
    codeBackground: '#140b2b',
    codeForeground: '#c9f0ff',
    inlineCodeBackground: '#1d1440',
    blockquote: '#a99ec9',
    blockquoteBorder: '#ff2ea6',
    tableBorder: '#2a2145',
    tableHeaderBackground: '#1d1440',
    tableStripeBackground: '#120b26',
    math: '#e6e1f5',
    divider: '#2a2145',
    tagBackground: '#ff2ea6',
    tagForeground: '#14000a',
    radius: '4px',
    shadow: '0 0 0 1px rgba(34, 230, 255, 0.22), 0 24px 60px -24px rgba(255, 46, 166, 0.42)',
    lineHeight: '1.7',
    font: 'var(--font-sans)',
    headingFont: 'var(--font-mono)',
    cardPadding: '30px',
  },
  typography: {
    baseSize: '16px',
    fontWeight: '400',
    letterSpacing: '0.01em',
    lineHeight: '1.7',
  },
  layout: {
    maxWidth: '780px',
    blockGap: '1em',
    writingMode: 'horizontal',
  },
}

const TERMINAL: ThemeDefinition = {
  id: 'terminal',
  name: '终端绿',
  nameLatin: 'Terminal',
  category: 'tech',
  description:
    '纯黑底与磷光绿正文，通篇等宽字体、硬边小圆角，像一台还在工作的老终端。',
  mode: 'dark',
  variables: {
    background: '#050807',
    foreground: '#d3f0dd',
    primary: '#eafff2',
    secondary: '#8fbf9f',
    muted: '#5f8a6e',
    border: '#1c3327',
    accent: '#33ff99',
    link: '#7dffb8',
    codeBackground: '#0b120d',
    codeForeground: '#9ef5bd',
    inlineCodeBackground: '#10201a',
    blockquote: '#86b39a',
    blockquoteBorder: '#33ff99',
    tableBorder: '#1c3327',
    tableHeaderBackground: '#10201a',
    tableStripeBackground: '#0a1210',
    math: '#d3f0dd',
    divider: '#1c3327',
    tagBackground: '#0f2a1e',
    tagForeground: '#33ff99',
    radius: '6px',
    shadow: '0 0 0 1px rgba(51, 255, 153, 0.16), 0 20px 50px -20px rgba(0, 0, 0, 0.9)',
    lineHeight: '1.8',
    font: 'var(--font-mono)',
    headingFont: 'var(--font-mono)',
    cardPadding: '28px',
  },
  typography: {
    baseSize: '15.5px',
    fontWeight: '400',
    letterSpacing: '0.01em',
    lineHeight: '1.8',
  },
  layout: {
    maxWidth: '700px',
    blockGap: '1.05em',
    writingMode: 'horizontal',
  },
}

/* ==========================================================================
   中国传统 · chinese
   --------------------------------------------------------------------------
   These three share one idea: 宋体/楷体 for the letterforms, 竖排 for the flow,
   and 朱砂 as the only saturated colour on the page. `writingMode: 'vertical'`
   is a REQUEST — the renderer keeps horizontal flow when it cannot honour it,
   so nothing breaks if a card is exported to a context without vertical
   layout. `.kc-vertical` in tokens.css then swaps block gaps for column gaps
   and keeps tables / code blocks horizontal.
   ========================================================================== */

const SHUI_MO: ThemeDefinition = {
  id: 'shui-mo',
  name: '水墨',
  nameLatin: 'Shuimo',
  category: 'chinese',
  description:
    '米白纸上的淡墨层次，朱砂点睛，留白比字更重。宋体竖排，适合经典文本与人文笔记。',
  mode: 'light',
  variables: {
    background: '#f6f5f0',
    foreground: '#23262b',
    primary: '#171a1e',
    secondary: '#4b5158',
    muted: '#6b7076',
    border: '#dcd9d0',
    accent: '#a8322a',
    link: '#8c2f26',
    codeBackground: '#edeae2',
    codeForeground: '#23262b',
    inlineCodeBackground: '#e8e5dc',
    blockquote: '#4b5158',
    blockquoteBorder: '#9aa0a8',
    tableBorder: '#dcd9d0',
    tableHeaderBackground: '#eceae2',
    tableStripeBackground: '#f2f0ea',
    math: '#171a1e',
    divider: '#dcd9d0',
    tagBackground: '#e9e6de',
    tagForeground: '#3f444b',
    radius: '6px',
    shadow: '0 2px 6px rgba(30, 32, 38, 0.05), 0 22px 48px -28px rgba(30, 32, 38, 0.3)',
    lineHeight: '1.95',
    font: 'var(--font-serif)',
    headingFont: 'var(--font-serif)',
    cardPadding: '34px',
  },
  typography: {
    baseSize: '17px',
    fontWeight: '400',
    letterSpacing: '0.06em',
    lineHeight: '1.95',
  },
  layout: {
    maxWidth: '680px',
    blockGap: '1.1em',
    writingMode: 'vertical',
  },
  texture: {
    // An ink wash: two soft corner gradients in near-black, faded to 5% so it
    // reads as atmosphere rather than a pattern (AGENTS.md §28).
    backgroundImage:
      'radial-gradient(120% 90% at 12% 0%, rgba(35, 38, 43, 0.5) 0%, rgba(35, 38, 43, 0) 55%),' +
      'radial-gradient(90% 70% at 100% 100%, rgba(35, 38, 43, 0.38) 0%, rgba(35, 38, 43, 0) 60%)',
    backgroundSize: '100% 100%',
    repeat: 'no-repeat',
    opacity: 0.05,
  },
}

const XUAN_ZHI: ThemeDefinition = {
  id: 'xuan-zhi',
  name: '宣纸',
  nameLatin: 'Xuanzhi',
  category: 'chinese',
  description:
    '带纤维纹理的温润宣纸，楷体题头，自右向左竖排。像从册子里抽出的一页古纸。',
  mode: 'light',
  variables: {
    background: '#f7f1e3',
    foreground: '#2b2620',
    primary: '#1e1a15',
    secondary: '#554c40',
    muted: '#756c5e',
    border: '#e2d8c3',
    accent: '#b23a2e',
    link: '#9a3527',
    codeBackground: '#efe7d5',
    codeForeground: '#2b2620',
    inlineCodeBackground: '#ebe2cd',
    blockquote: '#554c40',
    blockquoteBorder: '#c0b193',
    tableBorder: '#e2d8c3',
    tableHeaderBackground: '#efe7d5',
    tableStripeBackground: '#f3ecdd',
    math: '#1e1a15',
    divider: '#e2d8c3',
    tagBackground: '#ece3cf',
    tagForeground: '#4a4136',
    radius: '4px',
    shadow: '0 1px 3px rgba(60, 48, 30, 0.06), 0 24px 52px -30px rgba(60, 48, 30, 0.36)',
    lineHeight: '1.95',
    font: 'var(--font-serif)',
    headingFont: 'var(--font-kai)',
    cardPadding: '36px',
  },
  typography: {
    baseSize: '17px',
    fontWeight: '400',
    letterSpacing: '0.06em',
    lineHeight: '1.95',
  },
  layout: {
    maxWidth: '660px',
    blockGap: '1.1em',
    writingMode: 'vertical',
  },
  texture: {
    // Paper fibre from fractal noise. Deliberately colourless — the greyscale
    // turbulence supplies the tone, so there is no colour literal to resolve
    // at export time, and the layer opacity is only 7%.
    backgroundImage:
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='g' x='0' y='0'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23g)'/%3E%3C/svg%3E\")",
    backgroundSize: '200px 200px',
    repeat: 'repeat',
    opacity: 0.07,
  },
}

const ZHU_JIAN: ThemeDefinition = {
  id: 'zhu-jian',
  name: '竹简',
  nameLatin: 'Zhujian',
  category: 'chinese',
  description:
    '竹简的土黄与墨褐，楷体正文竖排，栏距舒展、印章色作点睛。读起来像一卷摊开的简册。',
  mode: 'light',
  variables: {
    background: '#e8dcc0',
    foreground: '#33291a',
    primary: '#241c11',
    secondary: '#5a4c37',
    muted: '#6a5e49',
    border: '#c9b587',
    accent: '#9c3b26',
    link: '#8a3320',
    codeBackground: '#dccdaa',
    codeForeground: '#2e2417',
    inlineCodeBackground: '#dccfae',
    blockquote: '#5a4c37',
    blockquoteBorder: '#a08c5f',
    tableBorder: '#c9b587',
    tableHeaderBackground: '#dfd2b2',
    tableStripeBackground: '#ece2c8',
    math: '#241c11',
    divider: '#c9b587',
    tagBackground: '#d8c8a3',
    tagForeground: '#4a3d2a',
    radius: '3px',
    shadow: '0 1px 2px rgba(50, 38, 18, 0.08), 0 22px 46px -28px rgba(50, 38, 18, 0.4)',
    lineHeight: '2',
    font: 'var(--font-kai)',
    headingFont: 'var(--font-serif)',
    cardPadding: '36px',
  },
  typography: {
    baseSize: '17px',
    fontWeight: '400',
    letterSpacing: '0.08em',
    lineHeight: '2',
  },
  layout: {
    maxWidth: '660px',
    blockGap: '1.15em',
    writingMode: 'vertical',
  },
}

/* ==========================================================================
   自然 · nature
   ========================================================================== */

const FOREST: ThemeDefinition = {
  id: 'forest',
  name: '深林',
  nameLatin: 'Forest',
  category: 'nature',
  description:
    '深林墨绿的暗色表面，蕨叶青作强调色，标题用衬线体补一点温度。夜里读也柔和。',
  mode: 'dark',
  variables: {
    background: '#101a14',
    foreground: '#dfe8dc',
    primary: '#eef4ea',
    secondary: '#a8bda9',
    muted: '#7b9183',
    border: '#24352a',
    accent: '#9ed36b',
    link: '#8ed0a4',
    codeBackground: '#0b1410',
    codeForeground: '#cfe3cd',
    inlineCodeBackground: '#16251c',
    blockquote: '#9db3a1',
    blockquoteBorder: '#3f6b4a',
    tableBorder: '#24352a',
    tableHeaderBackground: '#17261d',
    tableStripeBackground: '#0d1811',
    math: '#eef4ea',
    divider: '#24352a',
    tagBackground: '#1a2c21',
    tagForeground: '#9ed36b',
    radius: '16px',
    shadow: '0 2px 6px rgba(0, 0, 0, 0.4), 0 26px 56px -28px rgba(0, 0, 0, 0.75)',
    lineHeight: '1.8',
    font: 'var(--font-sans)',
    headingFont: 'var(--font-serif)',
    cardPadding: '32px',
  },
  typography: {
    baseSize: '16px',
    fontWeight: '400',
    letterSpacing: '0.005em',
    lineHeight: '1.8',
  },
  layout: {
    maxWidth: '740px',
    blockGap: '1.1em',
    writingMode: 'horizontal',
  },
}

/* ==========================================================================
   The registry
   --------------------------------------------------------------------------
   Canonical order: minimal -> art -> tech -> chinese -> nature, then id
   ascending inside each category. The sort below makes that invariant hold
   even if someone appends a theme out of order later, so the gallery and any
   `previous / next` navigation can rely on `THEMES` being stable.
   ========================================================================== */

const CATEGORY_ORDER: Readonly<Record<ThemeCategory, number>> = {
  minimal: 0,
  art: 1,
  tech: 2,
  chinese: 3,
  nature: 4,
}

const DEFINITIONS: readonly ThemeDefinition[] = [
  APPLE_NOTES,
  PAPER,
  MEMPHIS,
  RETRO,
  CYBERPUNK,
  TERMINAL,
  SHUI_MO,
  XUAN_ZHI,
  ZHU_JIAN,
  FOREST,
]

export const THEMES: readonly ThemeDefinition[] = [...DEFINITIONS].sort((a, b) => {
  const byCategory = CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category]
  return byCategory !== 0 ? byCategory : a.id.localeCompare(b.id, 'en')
})

/** Every registered id, in registry order. Handy for validating a card's `theme:`. */
export const THEME_IDS: readonly string[] = THEMES.map((theme) => theme.id)

/** The fallback theme id, re-exported so callers need only one import path. */
export { DEFAULT_THEME_ID }

/**
 * Every theme bucketed by category, both levels in registry order.
 *
 * The theme gallery renders one section per category straight from this, so
 * no caller has to group or re-sort `THEMES` itself. `THEME_CATEGORIES` is the
 * key order of the record.
 */
export function getThemesByCategory(): Readonly<
  Record<ThemeCategory, readonly ThemeDefinition[]>
> {
  // Spelled out rather than built in a loop, so adding a category to
  // `THEME_CATEGORIES` is a compile error here instead of a runtime `undefined`.
  const grouped: Record<ThemeCategory, ThemeDefinition[]> = {
    minimal: [],
    art: [],
    tech: [],
    chinese: [],
    nature: [],
  }
  for (const theme of THEMES) {
    grouped[theme.category].push(theme)
  }
  return grouped
}

/** Look up one theme. Returns `undefined` for an unknown or missing id. */
export function getTheme(id: string | null | undefined): ThemeDefinition | undefined {
  if (!id) return undefined
  return THEMES.find((theme) => theme.id === id)
}

/** True when the id belongs to a registered theme. */
export function isValidThemeId(id: string | null | undefined): boolean {
  return getTheme(id) !== undefined
}

/** The default theme definition. Always defined — `DEFAULT_THEME_ID` is real. */
export function getDefaultTheme(): ThemeDefinition {
  const theme = getTheme(DEFAULT_THEME_ID) ?? THEMES[0]
  if (!theme) {
    throw new Error(`主题注册表为空：既没有默认主题 ${DEFAULT_THEME_ID}，也没有任何已注册主题。`)
  }
  return theme
}

/**
 * True for the Chinese-classic themes that request vertical flow.
 *
 * Takes a raw id (a card's `theme:` field) rather than a definition, so content
 * validation can ask the question before resolving the whole theme.
 */
export function isVerticalTheme(id: string | null | undefined): boolean {
  return getTheme(id)?.layout?.writingMode === 'vertical'
}
