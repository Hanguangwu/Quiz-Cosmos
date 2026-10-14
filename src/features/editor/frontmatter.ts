import {
  CARD_STATUSES,
  DIFFICULTIES,
  FLIP_MARKER,
  SCHEMA_VERSION,
  type CardFrontMatter,
  type CardStatus,
  type Difficulty,
} from '@/types'

/**
 * Front-matter serialisation for the in-browser editor.
 *
 * The editor edits a *file*, not a database row: it keeps the full Markdown
 * text as the source of truth and rewrites only the front-matter block, so a
 * round-trip through the browser never reorders or reformats the body
 * (AGENTS.md §25 — do not change the data format gratuitously).
 */

/** Quote a scalar only when YAML would otherwise misread it. */
function scalar(value: string): string {
  const trimmed = value.trim()
  if (trimmed === '') return "''"
  const needsQuotes =
    /^[\s>|*&!%@`#-]/.test(trimmed) ||
    /[:#]\s/.test(trimmed) ||
    /[\n"']/.test(trimmed) ||
    /^(true|false|null|yes|no|on|off|~)$/i.test(trimmed) ||
    /^-?\d+(\.\d+)?$/.test(trimmed)
  if (!needsQuotes) return trimmed
  return `"${trimmed.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ')}"`
}

function list(key: string, values: readonly string[], alwaysEmit = false): string[] {
  if (values.length === 0) return alwaysEmit ? [`${key}: []`] : []
  return [`${key}:`, ...values.map((value) => `  - ${scalar(value)}`)]
}

/** Emit a YAML front-matter block, including the `---` fences. */
export function serializeFrontMatter(front: CardFrontMatter): string {
  const lines: string[] = [
    '---',
    `schemaVersion: ${front.schemaVersion ?? SCHEMA_VERSION}`,
    `id: ${scalar(front.id)}`,
    `type: ${front.type}`,
    `title: ${scalar(front.title)}`,
    `category: ${scalar(front.category)}`,
  ]

  if (front.subcategory) lines.push(`subcategory: ${scalar(front.subcategory)}`)
  // `tags` is a required field: always emit it (matching `serializeCard` in
  // src/lib/parser.ts) so the editor template already contains the key and the
  // author only fills in values.
  lines.push(...list('tags', front.tags, true))
  if (front.difficulty) lines.push(`difficulty: ${front.difficulty}`)
  lines.push(`status: ${front.status}`)
  if (front.theme) lines.push(`theme: ${scalar(front.theme)}`)
  if (front.aliases.length > 0) lines.push(...list('aliases', front.aliases))
  if (front.related.length > 0) lines.push(...list('related', front.related))
  if (front.created) lines.push(`created: ${front.created}`)
  if (front.updated) lines.push(`updated: ${front.updated}`)

  lines.push('---')
  return lines.join('\n')
}

export interface NewCardOptions {
  category?: string
  subcategory?: string
  id?: string
  title?: string
}

const CATEGORY_BY_ZH: Record<string, string> = {
  操作系统: 'programming',
  数据库: 'programming',
  Java: 'programming',
}

/** A ready-to-edit new card. `title` is the question. */
export function newCardTemplate(options: NewCardOptions = {}): string {
  const today = new Date().toISOString().slice(0, 10)
  const category = options.category ?? 'programming'
  const subcategory = options.subcategory ?? ''
  const front: CardFrontMatter = {
    schemaVersion: SCHEMA_VERSION,
    id: options.id ?? '',
    type: 'qa',
    title: options.title ?? '',
    category,
    subcategory: subcategory || null,
    tags: [],
    difficulty: null,
    status: 'draft',
    theme: null,
    aliases: [],
    related: [],
    created: today,
    updated: today,
  }

  const body = [
    `${FLIP_MARKER}`,
    '',
    '## 答案',
    '',
    '在这里写下答案。',
    '',
    '支持 GFM：**加粗**、`行内代码`、表格、列表、引用、任务列表，以及 $E = mc^2$ 行内公式。',
  ].join('\n')

  return `${serializeFrontMatter(front)}\n${body}\n`
}

/** Suggest an id from a category and a title, following `<topic>-NNN`. */
export function suggestId(category: string, subcategory: string, title: string, taken: readonly string[]): string {
  const parts = [category, subcategory, title]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  const slug = parts
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
  // Chinese titles have no Latin slug; fall back to the category alone so the
  // author fills in the sequence number.
  const base = /[a-z]/.test(slug) ? slug : category || 'card'
  const prefix = base.replace(/-\d+$/, '')

  for (let n = 1; n <= 999; n += 1) {
    const candidate = `${prefix}-${String(n).padStart(3, '0')}`
    if (!taken.includes(candidate)) return candidate
  }
  return `${prefix}-${Date.now()}`
}

export const STATUS_OPTIONS = CARD_STATUSES.map((status) => ({ value: status, label: status })) as {
  value: CardStatus
  label: string
}[]

export const DIFFICULTY_OPTIONS = DIFFICULTIES.map((difficulty) => ({
  value: difficulty,
  label: difficulty,
})) as { value: Difficulty; label: string }[]

export { CATEGORY_BY_ZH }
