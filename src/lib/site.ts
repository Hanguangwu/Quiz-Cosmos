/** Site-wide constants. Content lives in `content/**`, this is only chrome text. */

export const SITE = {
  name: '知库',
  nameLatin: 'Knowledge Cards',
  tagline: 'Markdown 驱动的个人知识卡片库',
  description: '用 Markdown 与 Git 承载知识，用卡片的方式阅读、复习与导出。',
  /** GitHub Pages subpath — must match `base` in vite.config.ts. */
  base: '/Quiz-Cosmos/',
  repository: '',
} as const

/** Per-page document titles, rendered by the router. */
export const PAGE_TITLES = {
  home: '总览',
  cards: '卡片浏览',
  card: '卡片详情',
  search: '搜索',
  tags: '标签',
  categories: '分类',
  review: '复习',
  editor: '编辑器',
  themes: '主题',
  about: '关于',
} as const
