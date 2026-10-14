/**
 * cards-to-sql —— 把卡片 Markdown 批量转成可导入 Cloudflare D1 的 SQL。
 *
 * 设计要点：
 * - 复用 `src/lib/parser.ts`：每张卡都先经 `parseCard` 规范化与校验，
 *   保证写进 D1 的字段与前端 / API 完全一致（含 search_text 纯文本）。
 * - 生成的 SQL 是幂等的：`cards` 按 id upsert，`tags` 按 name upsert，
 *   `card_tags` 先删后建；重复执行不会报错，也不会产生重复标签。
 * - 只要有一张卡解析失败或 id 重复，就整体失败，绝不产出一半的 SQL。
 *
 * 用法：
 *   pnpm cards:sql -- <input...> [--out .cards/cards.sql] [--db quiz-cosmos-db]
 *                  [--local] [--submit] [--help]
 */

import { spawnSync } from 'node:child_process'
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, extname, join, resolve } from 'node:path'
import { parseCard, stripMarkdown } from '../src/lib/parser'
import type { KnowledgeCard } from '../src/types'

const DEFAULT_OUT = '.cards/cards.sql'
const DEFAULT_DB = 'quiz-cosmos-db'

interface Options {
  inputs: string[]
  out: string
  db: string
  local: boolean
  submit: boolean
  help: boolean
}

function usage(): string {
  return `用法：
  pnpm cards:sql -- <input...> [选项]

参数：
  <input...>        卡片 .md 文件，或包含卡片的目录（递归查找 *.md）

选项：
  --out <file>      输出 SQL 文件（默认 ${DEFAULT_OUT}；- 表示打印到 stdout）
  --db <name>       目标 D1 数据库名（默认 ${DEFAULT_DB}）
  --local           提交到本地 D1（默认 remote）
  --remote          提交到远端 D1
  --submit          生成后执行 wrangler d1 execute 提交
  -h, --help        显示帮助`
}

function parseArgs(argv: string[]): Options {
  const opts: Options = {
    inputs: [],
    out: DEFAULT_OUT,
    db: DEFAULT_DB,
    local: false,
    submit: false,
    help: false,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] ?? ''
    if (arg === '--help' || arg === '-h') opts.help = true
    else if (arg === '--local') opts.local = true
    else if (arg === '--remote') opts.local = false
    else if (arg === '--submit') opts.submit = true
    else if (arg === '--out' || arg.startsWith('--out=')) {
      opts.out = arg === '--out' ? (argv[(i += 1)] ?? DEFAULT_OUT) : arg.slice('--out='.length)
    } else if (arg === '--db' || arg.startsWith('--db=')) {
      opts.db = arg === '--db' ? (argv[(i += 1)] ?? DEFAULT_DB) : arg.slice('--db='.length)
    } else if (arg.startsWith('-')) throw new Error(`未知参数：${arg}`)
    else opts.inputs.push(arg)
  }
  return opts
}

/** 递归收集输入里的 `*.md` 文件（去重、排序，保证输出稳定）。 */
async function collectMarkdownFiles(inputs: readonly string[]): Promise<string[]> {
  const files: string[] = []
  for (const input of inputs) {
    const absolute = resolve(input)
    let info
    try {
      info = await stat(absolute)
    } catch {
      throw new Error(`输入不存在：${input}`)
    }
    if (info.isDirectory()) {
      const entries = await readdir(absolute, { withFileTypes: true })
      const children = entries
        .filter((entry) => entry.isDirectory() || extname(entry.name).toLowerCase() === '.md')
        .map((entry) => join(absolute, entry.name))
      files.push(...(await collectMarkdownFiles(children)))
    } else if (extname(absolute).toLowerCase() === '.md') {
      files.push(absolute)
    } else {
      throw new Error(`不是 Markdown 文件：${input}`)
    }
  }
  return [...new Set(files)].sort()
}

/** `string | null` -> SQL 字面量（单引号转义）。 */
function sqlText(value: string | null): string {
  if (value === null) return 'NULL'
  return `'${value.replace(/'/g, "''")}'`
}

const nowIso = (): string => new Date().toISOString()

/** 单张卡的 SQL：cards upsert + card_tags 重建 + tags upsert。 */
function cardSql(card: KnowledgeCard, ts: string): string {
  const searchText = [card.title, card.question, card.answer]
    .map((part) => stripMarkdown(part))
    .filter((part) => part !== '')
    .join(' ')

  const lines: string[] = [`-- card: ${card.id}`]
  lines.push(
    `INSERT INTO cards
  (id, type, title, question, answer, category, subcategory, difficulty,
   status, theme, aliases, related, search_text, sort_order, created_at, updated_at, deleted_at)
VALUES
  (${sqlText(card.id)}, ${sqlText(card.type)}, ${sqlText(card.title)}, ${sqlText(card.question)}, ${sqlText(card.answer)},
   ${sqlText(card.category)}, ${sqlText(card.subcategory)}, ${sqlText(card.difficulty)}, ${sqlText(card.status)},
   ${sqlText(card.theme)}, ${sqlText(JSON.stringify(card.aliases))}, ${sqlText(JSON.stringify(card.related))},
   ${sqlText(searchText)}, 0, ${sqlText(ts)}, ${sqlText(ts)}, NULL)
ON CONFLICT(id) DO UPDATE SET
  type = excluded.type, title = excluded.title, question = excluded.question, answer = excluded.answer,
  category = excluded.category, subcategory = excluded.subcategory, difficulty = excluded.difficulty,
  status = excluded.status, theme = excluded.theme, aliases = excluded.aliases, related = excluded.related,
  search_text = excluded.search_text, sort_order = excluded.sort_order,
  updated_at = excluded.updated_at, deleted_at = NULL;`,
  )

  lines.push(`DELETE FROM card_tags WHERE card_id = ${sqlText(card.id)};`)
  for (const tag of card.tags) {
    lines.push(
      `INSERT INTO tags (name, slug, created_at) VALUES (${sqlText(tag)}, ${sqlText(tag)}, ${sqlText(ts)}) ON CONFLICT(name) DO NOTHING;`,
    )
    lines.push(
      `INSERT OR IGNORE INTO card_tags (card_id, tag_id) SELECT ${sqlText(card.id)}, id FROM tags WHERE name = ${sqlText(tag)};`,
    )
  }

  return lines.join('\n')
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2))

  if (opts.help) {
    console.log(usage())
    return
  }
  if (opts.inputs.length === 0) {
    console.error('缺少输入：请至少给一个卡片 .md 文件或目录。\n')
    console.error(usage())
    process.exitCode = 1
    return
  }
  if (opts.submit && opts.out === '-') {
    console.error('--submit 需要写入文件，不能配合 --out -。')
    process.exitCode = 1
    return
  }

  const files = await collectMarkdownFiles(opts.inputs)
  if (files.length === 0) {
    console.error('未找到任何 *.md 卡片文件。')
    process.exitCode = 1
    return
  }

  const cards: KnowledgeCard[] = []
  const errors: string[] = []
  for (const file of files) {
    const source = await readFile(file, 'utf8')
    const result = parseCard(source, file)
    if (result.ok) {
      cards.push(result.card)
      for (const warning of result.warnings) console.warn(`warn  ${file}: ${warning}`)
    } else {
      for (const error of result.errors) errors.push(`${file}: ${error}`)
    }
  }

  const seen = new Map<string, string>()
  for (const card of cards) {
    const previous = seen.get(card.id)
    if (previous) errors.push(`id 重复：${card.id}（${previous} 与 ${card.sourcePath}）`)
    else seen.set(card.id, card.sourcePath)
  }

  if (errors.length > 0) {
    console.error('卡片校验失败，未生成 SQL：')
    for (const error of errors) console.error(`  - ${error}`)
    process.exitCode = 1
    return
  }

  const ts = nowIso()
  const tagLinks = cards.reduce((total, card) => total + card.tags.length, 0)
  const header = [
    '-- Generated by scripts/cards-to-sql.ts',
    `-- ${cards.length} card(s), ${tagLinks} tag link(s), ${ts}`,
    `-- target D1: ${opts.db}`,
    '-- 幂等：重复执行会覆盖同 id 卡片并重建其标签。',
    'PRAGMA foreign_keys = ON;',
    '',
  ].join('\n')
  const sql = `${header}${cards.map((card) => cardSql(card, ts)).join('\n\n')}\n`

  if (opts.out === '-') {
    process.stdout.write(sql)
  } else {
    const outPath = resolve(opts.out)
    await mkdir(dirname(outPath), { recursive: true })
    await writeFile(outPath, sql, 'utf8')
    console.log(`已生成 ${opts.out}（${cards.length} 张卡，${tagLinks} 个标签关联）`)
  }

  if (opts.submit) {
    const target = opts.local ? '--local' : '--remote'
    const args = ['wrangler', 'd1', 'execute', opts.db, target, `--file=${opts.out}`]
    console.log(`> npx ${args.join(' ')}`)
    const result = spawnSync('npx', args, { stdio: 'inherit', shell: true })
    if (result.status !== 0) {
      console.error('wrangler 提交失败。')
      process.exitCode = result.status ?? 1
      return
    }
    console.log('提交完成。')
  }
}

try {
  await main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
