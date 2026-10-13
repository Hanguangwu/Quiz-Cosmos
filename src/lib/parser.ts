/**
 * Card parser — the single place that turns a Markdown file into a
 * `KnowledgeCard` (AGENTS.md §3/§4/§5/§6).
 *
 * Design rules:
 * - It NEVER throws. Every failure is returned as a Chinese error string.
 * - It is the only place allowed to decide "missing" vs "present": the returned
 *   front matter is fully normalised (`string | null`, `string[]`, never
 *   `undefined`), so every downstream consumer can rely on the shape.
 * - The same module is used wherever Markdown must become a `KnowledgeCard`
 *   (editor / preview / API seeding), so parsing never drifts from what the
 *   app is able to render.
 * - Front matter is split by a plain regex and the YAML block is handed to the
 *   `yaml` package. Both are isomorphic: `gray-matter` was Node-only (it calls
 *   `Buffer.from()` unconditionally) and threw `ReferenceError: Buffer is not
 *   defined` in the browser, which broke the editor's live preview for every
 *   card. Nothing imported here may reach for a Node global.
 *
 * Imports use relative specifiers on purpose: this file has to run under Vite,
 * under `tsx` (build scripts) and under plain Node type-stripping without
 * depending on a bundler alias.
 */

import { parse as parseYaml } from 'yaml'
import {
  CARD_STATUSES,
  CARD_TYPES,
  DIFFICULTIES,
  FLIP_MARKER,
  OPTIONAL_FIELDS,
  REQUIRED_FIELDS,
  SCHEMA_VERSION,
} from '../types'
import type {
  CardDraft,
  CardFrontMatter,
  CardStatus,
  CardType,
  Difficulty,
  KnowledgeCard,
  ParseResult,
} from '../types'

/** Canonical key order used when serialising a card back to Markdown. */
const FIELD_ORDER = [
  'schemaVersion',
  'id',
  'type',
  'title',
  'category',
  'subcategory',
  'tags',
  'difficulty',
  'status',
  'theme',
  'aliases',
  'related',
  'created',
  'updated',
] as const

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
/**
 * `2026-01-10`, optionally followed by a time part (`2026-01-10T09:30:00Z`,
 * `2026-01-10T09:30:00.123+08:00`, `2026-01-10 09:30:00 +08:00`). YAML 1.2's
 * core schema has no timestamp type, so such a value now reaches the parser as
 * a string instead of a `Date`; group 1 is the calendar date both
 * representations mean, which is what js-yaml 3 produced from the same line.
 */
const TIMESTAMP_RE = /^(\d{4}-\d{2}-\d{2})(?:[Tt ]\d{1,2}:\d{2}:\d{2}(?:[.,]\d+)?(?:\s*[Zz]|\s*[+-]\d{2}:?\d{2})?)?$/
const HEADING_RE = /^(#{1,6})\s+(.*)$/

/** Fields that are written even when they hold no value. */
const ALWAYS_EMIT = new Set<string>(['schemaVersion', 'id', 'type', 'title', 'category', 'tags', 'status'])

/* -------------------------------------------------------------------------- */
/* small helpers                                                              */
/* -------------------------------------------------------------------------- */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Front-matter fence. Kept byte-for-byte in sync with `sliceFrontMatter` in
 * `src/lib/content.ts` (the editor's CodeMirror helper) so the preview and the
 * editor can never disagree about where a card's front matter ends: a `---`
 * line, then the YAML block, then a closing `---` line followed by a newline or
 * end of input.
 */
const FRONT_MATTER_RE = /^---[ \t]*\n([\s\S]*?)\n?---[ \t]*(?:\n|$)/

/** BOM + CRLF removal, applied once so every branch sees the same document. */
function normaliseDocument(markdown: string): string {
  if (typeof markdown !== 'string') return ''
  return markdown.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
}

/**
 * Split the `---` front-matter fence off the document.
 *
 * This replaces `gray-matter`, which is Node-only: `utils.js` / `to-file.js`
 * call `Buffer.from(input)` unconditionally and its bundled `js-yaml@3` refers
 * to `Buffer` 33 more times, so `matter()` threw in the browser. A regex has no
 * platform dependency at all.
 */
function sliceFrontMatterFence(markdown: string): { raw: string; body: string } {
  const source = normaliseDocument(markdown)
  const match = FRONT_MATTER_RE.exec(source)
  if (!match) return { raw: '', body: source }
  return { raw: match[1] ?? '', body: source.slice(match[0].length) }
}

/**
 * Normalise whatever the YAML engine produced into a `YYYY-MM-DD` string.
 *
 * `yaml` implements the YAML 1.2 core schema, which has no timestamp type, so
 * `created: 2026-01-10` arrives here as the string `'2026-01-10'` — js-yaml 3's
 * default schema (used by the previous gray-matter based implementation)
 * returned a `Date` for the very same line. Both shapes are reduced to the same
 * `YYYY-MM-DD` string here, and a bare `20260110` still arrives as a number, so
 * this stays the single, total date gate over `unknown` regardless of which
 * schema produced the value.
 */
function toDateString(value: unknown): string | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return value.toISOString().slice(0, 10)
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString().slice(0, 10)
  }
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed === '') return null
  // A full ISO timestamp used to be a `Date` here and was reduced to its date
  // part; as a plain string it needs the same reduction.
  return TIMESTAMP_RE.exec(trimmed)?.[1] ?? trimmed
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    if (seen.has(value)) continue
    seen.add(value)
    out.push(value)
  }
  return out
}

/** Remove the leading `---` front matter block, if present. */
function stripFrontMatter(markdown: string): string {
  return sliceFrontMatterFence(markdown).body
}

/* -------------------------------------------------------------------------- */
/* parseCard                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Parse + normalise one card file.
 *
 * @param markdown  raw file contents
 * @param sourcePath repo-relative path, only used in the error branch
 */
export function parseCard(markdown: string, sourcePath: string): ParseResult {
  const errors: string[] = []
  const warnings: string[] = []

  let data: Record<string, unknown> = {}
  let body = ''

  try {
    const fence = sliceFrontMatterFence(markdown)
    body = fence.body
    // An absent or empty fence is a card with no front matter at all, which the
    // required-field checks below report one field at a time — far more useful
    // than a single "empty mapping" error.
    if (fence.raw.trim() !== '') {
      const parsed: unknown = parseYaml(fence.raw)
      if (isRecord(parsed)) data = parsed
      else if (parsed !== undefined) errors.push('front matter 必须是键值映射（YAML mapping）。')
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    return { ok: false, sourcePath, errors: [`YAML front matter 解析失败：${reason}`], warnings }
  }

  body = body.replace(/\r\n/g, '\n').trim()

  /* --- required fields --------------------------------------------------- */

  for (const field of REQUIRED_FIELDS) {
    if (!(field in data) || data[field] === undefined || data[field] === null) {
      errors.push(`缺少必填字段 ${field}。`)
    }
  }

  // schemaVersion
  const rawVersion = data.schemaVersion
  const version = typeof rawVersion === 'string' ? Number(rawVersion) : rawVersion
  if (rawVersion !== undefined && rawVersion !== null) {
    if (version !== SCHEMA_VERSION) {
      errors.push(`schemaVersion 必须是 ${SCHEMA_VERSION}，当前为 ${JSON.stringify(rawVersion)}。`)
    }
  }

  // id
  let id = ''
  if (data.id !== undefined && data.id !== null) {
    if (typeof data.id === 'number') {
      id = String(data.id)
      warnings.push('id 建议使用带引号的字符串，避免被解析为数字。')
    } else if (typeof data.id === 'string') {
      id = data.id
    } else {
      errors.push('id 必须是字符串。')
    }
    id = id.trim()
    if (id !== '' && /\s/.test(id)) errors.push(`id 不能包含空白字符：${JSON.stringify(data.id)}。`)
    if (id === '') errors.push('id 不能为空。')
    else if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(id)) {
      warnings.push(`id 含有非常规字符（建议只用字母、数字、. _ - :）：${id}。`)
    }
  }

  // type
  let type: CardType | null = null
  if (data.type !== undefined && data.type !== null) {
    const value = String(data.type)
    if ((CARD_TYPES as readonly string[]).includes(value)) type = value as CardType
    else errors.push(`type 必须是 ${CARD_TYPES.join(' | ')} 之一，当前为 ${JSON.stringify(value)}。`)
  }

  // status
  let status: CardStatus | null = null
  if (data.status !== undefined && data.status !== null) {
    const value = String(data.status)
    if ((CARD_STATUSES as readonly string[]).includes(value)) status = value as CardStatus
    else
      errors.push(
        `status 必须是 ${CARD_STATUSES.join(' | ')} 之一，当前为 ${JSON.stringify(value)}。`,
      )
  }

  // title / category
  const title = typeof data.title === 'string' ? data.title.trim() : ''
  if (data.title !== undefined && data.title !== null && typeof data.title !== 'string') {
    errors.push('title 必须是字符串。')
  } else if (data.title !== undefined && data.title !== null && title === '') {
    errors.push('title 不能为空。')
  }

  const category = typeof data.category === 'string' ? data.category.trim() : ''
  if (data.category !== undefined && data.category !== null && typeof data.category !== 'string') {
    errors.push('category 必须是字符串。')
  } else if (data.category !== undefined && data.category !== null && category === '') {
    errors.push('category 不能为空。')
  }

  // tags (required, but always normalised to string[])
  const tags: string[] = []
  if (data.tags !== undefined && data.tags !== null) {
    const raw = Array.isArray(data.tags) ? data.tags : [data.tags]
    for (const item of raw) {
      if (item === null || item === undefined) continue
      if (typeof item === 'object') {
        errors.push('tags 的每一项都必须是字符串。')
        continue
      }
      const value = String(item).trim()
      if (value === '') {
        warnings.push('tags 中存在空字符串，已忽略。')
        continue
      }
      tags.push(value)
    }
  }
  const dedupedTags = dedupe(tags)
  if (dedupedTags.length !== tags.length) warnings.push('tags 存在重复项，已去重。')

  /* --- optional fields --------------------------------------------------- */

  const optionalScalar = (field: 'subcategory' | 'theme'): string | null => {
    const value = data[field]
    if (value === undefined || value === null || value === '') return null
    if (typeof value !== 'string') {
      errors.push(`${field} 必须是字符串或留空。`)
      return null
    }
    return value.trim()
  }

  const optionalList = (field: 'aliases' | 'related'): string[] => {
    const value = data[field]
    if (value === undefined || value === null) return []
    const raw = Array.isArray(value) ? value : [value]
    const out: string[] = []
    for (const item of raw) {
      if (item === null || item === undefined) continue
      if (typeof item === 'object') {
        errors.push(`${field} 的每一项都必须是字符串。`)
        continue
      }
      const text = String(item).trim()
      if (text === '') {
        warnings.push(`${field} 中存在空字符串，已忽略。`)
        continue
      }
      if (/\s/.test(text)) warnings.push(`${field} 中存在含空白的条目：${text}。`)
      out.push(text)
    }
    if (!Array.isArray(value) && raw.length > 0) {
      warnings.push(`${field} 建议写成 YAML 列表。`)
    }
    return dedupe(out)
  }

  const subcategory = optionalScalar('subcategory')
  const theme = optionalScalar('theme')
  const aliases = optionalList('aliases')
  const related = optionalList('related')

  let difficulty: Difficulty | null = null
  if (data.difficulty !== undefined && data.difficulty !== null && data.difficulty !== '') {
    const value = String(data.difficulty)
    if ((DIFFICULTIES as readonly string[]).includes(value)) difficulty = value as Difficulty
    else
      errors.push(`difficulty 必须是 ${DIFFICULTIES.join(' | ')} 之一，当前为 ${JSON.stringify(value)}。`)
  }

  const optionalDate = (field: 'created' | 'updated'): string | null => {
    const value = data[field]
    if (value === undefined || value === null || value === '') return null
    const text = toDateString(value)
    if (text === null) {
      errors.push(`${field} 必须是 YYYY-MM-DD 格式的日期。`)
      return null
    }
    if (!DATE_RE.test(text)) {
      errors.push(`${field} 必须是 YYYY-MM-DD 格式的日期，当前为 ${JSON.stringify(text)}。`)
      return null
    }
    if (Number.isNaN(new Date(`${text}T00:00:00Z`).getTime())) {
      errors.push(`${field} 不是有效日期：${text}。`)
      return null
    }
    return text
  }

  const created = optionalDate('created')
  const updated = optionalDate('updated')

  /* --- warnings that need the normalised values -------------------------- */

  if (status !== null && status !== 'published') {
    warnings.push(`status 为 ${status}，该卡不会进入公开索引的默认视图。`)
  }
  if (created !== null && updated !== null && updated < created) {
    warnings.push(`updated（${updated}）早于 created（${created}）。`)
  }
  if (data.tags !== undefined && tags.length === 0) {
    warnings.push('tags 为空，搜索与筛选效果会变差。')
  }
  if (status !== null && status === 'published' && !body) {
    errors.push('已发布的卡片不能没有正文。')
  }
  if (Array.isArray(data.related) && data.related.includes(id) && id !== '') {
    warnings.push('related 指向了自身。')
  }

  const known = new Set<string>([...REQUIRED_FIELDS, ...OPTIONAL_FIELDS])
  for (const key of Object.keys(data)) {
    if (!known.has(key)) warnings.push(`未知的 front matter 字段：${key}。`)
  }

  const frontMatter: CardFrontMatter = {
    schemaVersion: SCHEMA_VERSION,
    id,
    type: type ?? 'qa',
    title,
    category,
    subcategory,
    tags: dedupedTags,
    difficulty,
    status: status ?? 'draft',
    theme,
    aliases,
    related,
    created,
    updated,
  }

  const split = splitQaCard(body, title)
  if (!split.hasAnswer) warnings.push('正文没有可识别的答案区（缺少 <!-- flip --> 或二级标题）。')

  if (errors.length > 0) {
    return { ok: false, sourcePath, errors, warnings }
  }

  const card: KnowledgeCard = {
    ...frontMatter,
    body,
    question: split.question,
    answer: split.answer,
    hasAnswer: split.hasAnswer,
    sourcePath,
  }

  return { ok: true, card, warnings }
}

/* -------------------------------------------------------------------------- */
/* splitQaCard                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Split a card body into the question (front) and the answer (back).
 *
 * Priority:
 * 1. a line that is exactly `<!-- flip -->` — before = question, after = answer
 * 2. otherwise the first `## ` heading — before = question, from the heading = answer
 * 3. otherwise the title is the question and the whole body is the answer
 *
 * When the question part comes out empty the `title` is used instead: the title
 * *is* the canonical question (AGENTS.md §12), an empty front is never useful.
 */
export function splitQaCard(body: string, title: string): { question: string; answer: string; hasAnswer: boolean } {
  const normalised = (body ?? '').replace(/\r\n/g, '\n')
  const lines = normalised.split('\n')
  const fallback = (title ?? '').trim()

  const finish = (question: string, answer: string) => {
    const q = question.trim() || fallback
    const a = answer.trim()
    return { question: q, answer: a, hasAnswer: a.length > 0 }
  }

  const flipIndex = lines.findIndex((line) => line.trim() === FLIP_MARKER)
  if (flipIndex >= 0) {
    return finish(
      lines.slice(0, flipIndex).join('\n'),
      lines.slice(flipIndex + 1).join('\n'),
    )
  }

  const headingIndex = lines.findIndex((line) => HEADING_RE.test(line) && line.trimStart().startsWith('## '))
  if (headingIndex >= 0) {
    return finish(
      lines.slice(0, headingIndex).join('\n'),
      lines.slice(headingIndex).join('\n'),
    )
  }

  return finish('', normalised)
}

/* -------------------------------------------------------------------------- */
/* stripMarkdown                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Markdown -> plain text, for the search index.
 *
 * Structure (front matter, fences' fence lines, HTML) is removed, content is
 * kept: code text, link text, image alt text and table cell text all survive so
 * that searching for a keyword finds the card.
 */
export function stripMarkdown(markdown: string): string {
  if (typeof markdown !== 'string' || markdown === '') return ''
  let text = stripFrontMatter(markdown)

  // HTML comments (this also removes the <!-- flip --> marker)
  text = text.replace(/<!--[\s\S]*?-->/g, ' ')
  // Fenced code blocks: keep the code, drop the fences and the language tag
  text = text.replace(/^[ \t]*(`{3,}|~{3,})[^\n]*\n([\s\S]*?)\n?[ \t]*\1[ \t]*$/gm, ' $2 ')
  // Unclosed fence at the end of the document
  text = text.replace(/^[ \t]*(`{3,}|~{3,})[^\n]*\n([\s\S]*)$/m, ' $2 ')
  // HTML tags
  text = text.replace(/<\/?[A-Za-z][^>]*>/g, ' ')

  // Images before links: ![alt](src) -> alt
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, ' $1 ')
  // Reference images
  text = text.replace(/!\[[^\]]*\]\[[^\]]*\]/g, ' ')
  // Inline links: [text](href) -> text, [text][ref] -> text
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, ' $1 ')
  text = text.replace(/\[([^\]]*)\]\[[^\]]*\]/g, ' $1 ')

  // Table separator rows, then the pipes themselves
  text = text.replace(/^[ \t]*\|?[ \t]*:?-{2,}:?[ \t]*(\|[ \t]*:?-{2,}:?[ \t]*)*\|?[ \t]*$/gm, ' ')
  text = text.replace(/\|/g, ' ')

  // Code spans (may still contain backticks after fences were removed)
  text = text.replace(/(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/g, ' $2 ')

  // Atx / setext headings
  text = text.replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, '')
  text = text.replace(/^[ \t]{0,3}(={2,}|-{2,})[ \t]*$/gm, ' ')
  // Horizontal rules
  text = text.replace(/^[ \t]{0,3}([-*_])[ \t]*(?:\1[ \t]*){2,}$/gm, ' ')
  // Block quotes
  text = text.replace(/^[ \t]{0,3}>[ \t]?/gm, '')
  // Lists (bullet, ordered, task list)
  text = text.replace(/^[ \t]*(?:[-*+]|\d+[.)])[ \t]+\[[ xX]\][ \t]*/gm, '')
  text = text.replace(/^[ \t]*(?:[-*+]|\d+[.)])[ \t]+/gm, '')

  // Emphasis
  text = text.replace(/(\*\*\*|___)(.+?)\1/g, ' $2 ')
  text = text.replace(/(\*\*|__)(.+?)\1/g, ' $2 ')
  text = text.replace(/~~(.+?)~~/g, ' $1 ')
  text = text.replace(/\*(.+?)\*/g, ' $1 ')
  text = text.replace(/(^|[\s(（])_([^_\n]+?)_(?=$|[\s)）。，、：；！？])/g, ' $1$2')

  return text.replace(/\s+/g, ' ').trim()
}

/* -------------------------------------------------------------------------- */
/* slugify                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * URL-safe form of a card id, used for `/card/:slug`.
 *
 * Ids are ASCII by convention, so this is a plain lowercase + sanitise pass. If
 * an id contains no ASCII at all the result would be empty, so a deterministic
 * hash is used as a last resort to keep every card routable.
 */
export function slugify(id: string): string {
  const source = typeof id === 'string' ? id : String(id ?? '')
  const slug = source
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
  if (slug !== '') return slug
  let hash = 2166136261
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return `c-${(hash >>> 0).toString(36)}`
}

/* -------------------------------------------------------------------------- */
/* serializeCard                                                              */
/* -------------------------------------------------------------------------- */

const YAML_PLAIN_RE = /^[A-Za-z0-9_][A-Za-z0-9 _./()+-]*$/
const YAML_RESERVED = new Set([
  'true',
  'false',
  'null',
  'yes',
  'no',
  'on',
  'off',
  'y',
  'n',
  '~',
  '',
])

/** Emit a YAML scalar, quoting only when plain style would be ambiguous. */
function yamlScalar(value: string): string {
  if (YAML_RESERVED.has(value.toLowerCase())) return JSON.stringify(value)
  if (!YAML_PLAIN_RE.test(value)) return JSON.stringify(value)
  if (DATE_RE.test(value)) return value
  if (/^[-+]?[0-9._]+$/.test(value)) return JSON.stringify(value)
  if (/\s$/.test(value) || /^\s/.test(value)) return JSON.stringify(value)
  return value
}

function yamlBlockSequence(key: string, values: string[]): string {
  if (values.length === 0) return `${key}: []`
  return [`${key}:`, ...values.map((value) => `  - ${yamlScalar(value)}`)].join('\n')
}

function composeBody(draft: CardDraft): string {
  if (draft.body.trim() !== '') return draft.body.trim()
  const question = draft.question.trim()
  const answer = draft.answer.trim()
  if (question === '' && answer === '') return ''
  if (answer === '') return question
  return question === '' ? answer : `${question}\n\n${FLIP_MARKER}\n\n${answer}`
}

/**
 * Serialise a draft back into a complete `.md` file.
 *
 * The output is guaranteed to re-parse through `parseCard` into an equivalent
 * card: null / empty optional fields are omitted, lists are emitted as YAML
 * block sequences and scalars are quoted only when required.
 */
export function serializeCard(card: CardDraft): string {
  const values: Record<string, string | string[] | number | null> = {
    schemaVersion: SCHEMA_VERSION,
    id: card.id.trim(),
    type: card.type,
    title: card.title.trim(),
    category: card.category.trim(),
    subcategory: card.subcategory,
    tags: dedupe(card.tags.map((tag) => tag.trim()).filter((tag) => tag !== '')),
    difficulty: card.difficulty,
    status: card.status,
    theme: card.theme,
    aliases: card.aliases,
    related: card.related,
    created: card.created,
    updated: card.updated,
  }

  const lines: string[] = ['---']
  for (const field of FIELD_ORDER) {
    const value = values[field]
    // Only the required fields are always emitted; optional fields are omitted
    // when absent or empty so the file stays readable.
    if (Array.isArray(value)) {
      if (value.length === 0 && !ALWAYS_EMIT.has(field)) continue
      lines.push(yamlBlockSequence(field, value))
      continue
    }
    if (value === null || value === undefined) {
      if (ALWAYS_EMIT.has(field)) lines.push(`${field}:`)
      continue
    }
    if (typeof value === 'number') {
      lines.push(`${field}: ${value}`)
      continue
    }
    lines.push(`${field}: ${yamlScalar(value)}`)
  }
  lines.push('---', '')

  const body = composeBody(card)
  return body === '' ? `${lines.join('\n')}\n` : `${lines.join('\n')}\n${body}\n`
}
