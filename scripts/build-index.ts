/**
 * Build the runtime search index.
 *
 *   pnpm exec tsx scripts/build-index.ts
 *
 * Writes `public/index.json` (`KnowledgeIndex`), which is the app's only runtime
 * data source (AGENTS.md §16): search, facets, routing and offline all read this
 * one file, so the site needs no backend and no per-card request.
 *
 * Every card is embedded with its markdown, which is what makes the app fully
 * static: `question` / `answer` are rendered directly and `text` is the
 * pre-stripped plain text Fuse searches over.
 *
 * The output is deterministic (stable sort, fixed key order) so git diffs stay
 * small. `generatedAt` is the only volatile field; set `SOURCE_DATE_EPOCH` (or
 * `INDEX_GENERATED_AT`) to pin it for reproducible builds.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import {
  CONTENT_DIR,
  INDEX_FILE,
  countFacets,
  listContentFiles,
  readTextFile,
  toRepoPath,
} from './lib/content-fs.ts'
import { parseCard, slugify, stripMarkdown } from '../src/lib/parser.ts'
import type { IndexedCard, KnowledgeIndex } from '../src/types/index.ts'

function generatedAt(): string {
  const pinned = process.env.INDEX_GENERATED_AT
  if (pinned) return pinned
  const epoch = process.env.SOURCE_DATE_EPOCH
  if (epoch && /^\d+$/.test(epoch)) return new Date(Number(epoch) * 1000).toISOString()
  return new Date().toISOString()
}

const files = listContentFiles()
if (files.length === 0) {
  console.error(`错误：${toRepoPath(CONTENT_DIR)} 下没有任何 .md 卡片。`)
  process.exit(1)
}

const cards: IndexedCard[] = []
const failures: string[] = []

for (const file of files) {
  const relative = toRepoPath(file)
  const result = parseCard(readTextFile(file), relative)
  if (!result.ok) {
    failures.push(`${relative}\n    - ${result.errors.join('\n    - ')}`)
    continue
  }
  const card = result.card
  const text = stripMarkdown(`${card.question}\n${card.answer}`)
  cards.push({
    schemaVersion: card.schemaVersion,
    id: card.id,
    type: card.type,
    title: card.title,
    category: card.category,
    subcategory: card.subcategory,
    tags: card.tags,
    difficulty: card.difficulty,
    status: card.status,
    theme: card.theme,
    aliases: card.aliases,
    related: card.related,
    created: card.created,
    updated: card.updated,
    slug: slugify(card.id),
    body: card.body,
    question: card.question,
    answer: card.answer,
    text,
    length: card.question.length + card.answer.length,
    hasAnswer: card.hasAnswer,
  })
}

if (failures.length > 0) {
  console.error('构建索引失败：以下卡片无法解析（请先运行 pnpm exec tsx scripts/validate-content.ts）')
  for (const failure of failures) console.error(`  ${failure}`)
  process.exit(1)
}

// Stable order: category, then subcategory, then id. Never locale dependent.
cards.sort((a, b) => {
  if (a.category !== b.category) return a.category < b.category ? -1 : 1
  const subA = a.subcategory ?? ''
  const subB = b.subcategory ?? ''
  if (subA !== subB) return subA < subB ? -1 : 1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
})

const published = cards.filter((card) => card.status === 'published')

// `categories` follows the type contract in src/types/search.ts: only published
// cards are counted there, because it drives the public category browser. The
// other facets cover the whole library so that filtering by status/difficulty
// still works for draft and archived cards.
const index: KnowledgeIndex = {
  version: 1,
  generatedAt: generatedAt(),
  total: cards.length,
  cards,
  categories: countFacets(published, (card) => [card.category]),
  tags: countFacets(cards, (card) => card.tags),
  difficulties: countFacets(cards, (card) => [card.difficulty]),
  statuses: countFacets(cards, (card) => [card.status]),
  themes: countFacets(cards, (card) => [card.theme]),
}

mkdirSync(path.dirname(INDEX_FILE), { recursive: true })
writeFileSync(INDEX_FILE, `${JSON.stringify(index, null, 2)}\n`, 'utf8')

console.log('知识索引构建完成')
console.log('================')
console.log(`输出：${toRepoPath(INDEX_FILE)}`)
console.log(`卡片：${index.total}（已发布 ${published.length}，其他 ${index.total - published.length}）`)
console.log(
  `正文字符：${cards.reduce((sum, card) => sum + card.length, 0)}，可搜索文本：${cards.reduce((sum, card) => sum + card.text.length, 0)}`,
)
for (const [name, facet] of [
  ['分类', index.categories],
  ['难度', index.difficulties],
  ['状态', index.statuses],
  ['主题', index.themes],
] as const) {
  const text = facet.length === 0 ? '（无）' : facet.map((item) => `${item.name}(${item.count})`).join('  ')
  console.log(`${name}：${text}`)
}
console.log(`标签：${index.tags.map((item) => `${item.name}(${item.count})`).join('  ')}`)
