/**
 * Content validation — the gate before any build.
 *
 *   pnpm exec tsx scripts/validate-content.ts
 *
 * Every rule here is a build-time contract, so failures are loud: the process
 * exits 1 and CI (`validate-content` -> `build-index` -> `vite build`) stops
 * before a broken card can reach the published site.
 *
 * Front matter is parsed with the app's own `parseCard`, therefore this script
 * can never accept a card that the browser would reject.
 */

import {
  CATEGORIES_FILE,
  CONTENT_DIR,
  THEME_IDS,
  fileExists,
  listContentFiles,
  loadCategoryConfig,
  readTextFile,
  toRepoPath,
} from './lib/content-fs.ts'
import type { CategoryConfig } from './lib/content-fs.ts'
import { parseCard } from '../src/lib/parser.ts'
import { FLIP_MARKER } from '../src/types/index.ts'
import type { KnowledgeCard } from '../src/types/index.ts'

const MAX_CHARS = 1200

type Level = '错误' | '警告'

interface Issue {
  level: Level
  file: string
  message: string
}

const issues: Issue[] = []
const cards: { file: string; card: KnowledgeCard }[] = []
let config: CategoryConfig | null = null

function add(level: Level, file: string, message: string): void {
  issues.push({ level, file, message })
}

function exists(path: string): boolean {
  return fileExists(path)
}

/* --- 1. files & parse ----------------------------------------------------- */

const files = listContentFiles()
if (files.length === 0) {
  console.error(`错误：没有找到任何卡片文件，请检查目录 ${toRepoPath(CONTENT_DIR)}/`)
  process.exit(1)
}
if (!exists(CATEGORIES_FILE)) {
  console.error(`错误：缺少分类注册表 ${toRepoPath(CATEGORIES_FILE)}`)
  process.exit(1)
}
try {
  config = loadCategoryConfig()
} catch (error) {
  console.error(`错误：${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}

for (const file of files) {
  const relative = toRepoPath(file)
  const markdown = readTextFile(file)
  const result = parseCard(markdown, relative)
  if (!result.ok) {
    for (const message of result.errors) add('错误', relative, message)
    for (const message of result.warnings) add('警告', relative, message)
    continue
  }
  for (const message of result.warnings) add('警告', relative, message)
  cards.push({ file: relative, card: result.card })

  const { card } = result

  /* --- body split (AGENTS.md §12) ---------------------------------------- */

  if (card.question.trim() === '') add('错误', relative, '正文无法切分出问题（正面为空）。')
  if (card.answer.trim() === '') add('错误', relative, '正文无法切分出答案（背面为空）。')

  const lines = card.body.split('\n')
  for (const [index, line] of lines.entries()) {
    if (line.includes(FLIP_MARKER) && line.trim() !== FLIP_MARKER) {
      add('错误', relative, `第 ${index + 1} 行的 ${FLIP_MARKER} 必须单独占一行。`)
    }
  }

  /* --- path <-> metadata consistency ------------------------------------- */

  const expectedDir = card.subcategory
    ? `content/${card.category}/${card.subcategory}/`
    : `content/${card.category}/`
  if (!relative.startsWith(expectedDir)) {
    add('警告', relative, `文件位置与 category/subcategory 不一致，期望目录 ${expectedDir}`)
  }
  const fileName = relative.slice(relative.lastIndexOf('/') + 1).replace(/\.md$/i, '')
  if (fileName !== card.id) add('警告', relative, `文件名（${fileName}）与 id（${card.id}）不一致。`)

  /* --- category registry -------------------------------------------------- */

  const category = config.byId.get(card.category)
  if (!category) {
    add('错误', relative, `category "${card.category}" 未在 config/categories.yml 中声明。`)
  } else if (card.subcategory && !category.subcategories.has(card.subcategory)) {
    add(
      '警告',
      relative,
      `subcategory "${card.subcategory}" 未在 config/categories.yml 的 ${card.category} 下声明。`,
    )
  }

  /* --- theme -------------------------------------------------------------- */

  if (card.theme !== null && !THEME_IDS.includes(card.theme)) {
    add(
      '错误',
      relative,
      `theme "${card.theme}" 不在主题注册表中（可用值：${THEME_IDS.join(' | ')}）。`,
    )
  }

  /* --- content size ------------------------------------------------------- */

  if (card.body.length > MAX_CHARS) {
    add('警告', relative, `正文长度 ${card.body.length} 字符，超过 ${MAX_CHARS}，建议拆成多张卡片。`)
  }
}

/* --- 2. duplicate ids ------------------------------------------------------ */

const byId = new Map<string, string[]>()
for (const { file, card } of cards) {
  const list = byId.get(card.id) ?? []
  list.push(file)
  byId.set(card.id, list)
}
for (const [id, paths] of byId) {
  if (paths.length < 2) continue
  for (const file of paths) add('错误', file, `id "${id}" 重复，出现于：${paths.join('、')}`)
}

/* --- 3. related links ------------------------------------------------------ */

const knownIds = new Set(byId.keys())
for (const { file, card } of cards) {
  for (const related of card.related) {
    if (!knownIds.has(related)) add('错误', file, `related 指向不存在的卡片：${related}`)
    if (related === card.id) add('错误', file, `related 指向自身：${related}`)
  }
}

/* --- report ---------------------------------------------------------------- */

const errors = issues.filter((issue) => issue.level === '错误')
const warnings = issues.filter((issue) => issue.level === '警告')

console.log('知识内容校验报告')
console.log('================')
console.log(`卡片文件：${files.length} 个，解析成功 ${cards.length} 个`)
console.log('')
for (const { file, card } of cards) {
  const flag = errors.some((issue) => issue.file === file) ? '✗' : warnings.some((i) => i.file === file) ? '!' : '✓'
  console.log(`  ${flag} ${file}`)
  console.log(
    `      id=${card.id}  分类=${card.category}${card.subcategory ? `/${card.subcategory}` : ''}  ` +
      `难度=${card.difficulty ?? '-'}  状态=${card.status}  标签=${card.tags.length}  关联=${card.related.length}`,
  )
}
console.log('')
for (const level of ['错误', '警告'] as Level[]) {
  const list = issues.filter((issue) => issue.level === level)
  console.log(`${level}（${list.length}）`)
  if (list.length === 0) console.log('  无')
  for (const issue of list) console.log(`  [${issue.file}] ${issue.message}`)
  console.log('')
}

const perCategory = new Map<string, number>()
for (const { card } of cards) perCategory.set(card.category, (perCategory.get(card.category) ?? 0) + 1)
console.log('分类统计：')
for (const [name, count] of [...perCategory.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))) {
  console.log(`  ${name}: ${count}`)
}
console.log(`  合计: ${cards.length}`)
console.log('')
console.log(`汇总：文件 ${files.length} / 错误 ${errors.length} / 警告 ${warnings.length}`)

if (errors.length > 0) {
  console.error('校验未通过：请修复上述错误后重试。')
  process.exit(1)
}
console.log('校验通过。')
