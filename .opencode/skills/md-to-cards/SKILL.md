---
name: md-to-cards
description: 把讲义/笔记类 Markdown 抽取成 QA 知识卡片，生成可导入 Cloudflare D1 的 SQL，并可用 wrangler 一键提交。当用户要求「把 markdown/笔记/讲义变成卡片」「从笔记里抽问题」「批量导入知识库」「生成 D1 SQL / 提交到 D1」时使用。
---

# md-to-cards —— 笔记转知识卡片

把一份**非结构化**的讲义 / 笔记 Markdown，抽取成本项目的 QA 卡片，
再生成可直接导入 Cloudflare D1 的 SQL，并可一键提交。

背景：本项目的唯一数据源是 Cloudflare D1（`cards` / `tags` / `card_tags`，
见 AGENTS.md §3/§4）。卡片以 Markdown 存储，正面（问题）与背面（答案）
用 `<!-- flip -->` 分隔（AGENTS.md §12）。

## 何时使用

- 用户丢来一份笔记 / 讲义 / 教程 Markdown，想变成可复习的问答卡片。
- 需要把一批卡片批量写入 D1，而不是逐张在网页编辑器里手填。

## 总览：4 步

1. **抽取**：读源 Markdown，识别「可独立考核的知识点」，每个知识点写成一张卡的问答。
2. **落卡片**：每张卡写成一份卡片 Markdown，放到工作目录 `.cards/`（默认）。
3. **生成 SQL**：`pnpm cards:sql -- .cards/<topic> --out .cards/cards.sql`
4. **提交**：`pnpm cards:sql -- .cards/<topic> --submit`，或手动跑 wrangler（见下）。

> 第 1 步是语义判断，由你（agent）完成；第 3~4 步是确定性的，交给 `scripts/cards-to-sql.ts`。

## 第 1 步：从笔记里抽取问题

把笔记拆成「一个知识点 = 一张卡」。启发式：

- **标题即问题**：`## TCP 三次握手` → 卡片 `title`/`question` 取「TCP 三次握手是什么？」
  （或直接用标题原文），答案取该标题下的正文。
- **显式问答**：文中出现 `Q:` / `问:` / `A:` / `答:` 时，按标记切分问答。
- **定义句**：`X 是指 …` / `X 是一种 …` / `X 用于 …` → 问题「X 是什么？」，答案取该定义段。
- **公式 / 代码 / 表格**：原样放进答案（卡片渲染支持 GFM、KaTeX、代码高亮）。
- **粒度**：一张卡只承载一个独立知识点；过长的小节拆成多张；相邻的零碎要点可合并。
- **跳过**：目录、过渡语、寒暄，以及没有独立考点的纯例子罗列。
- **拿不准**：宁可多拆一张，也不要让一张卡塞进多个互不相关的考点。
- 抽取过程**只读**用户的源笔记，绝不修改它。

## 第 1 步产物：卡片 Markdown 格式

每张卡是一份带 YAML front matter 的 `.md`。必填字段见 AGENTS.md §4：

```md
---
schemaVersion: 1
id: os-process-001        # 唯一 ID，建议 <领域>-<主题>-<序号>
type: qa
title: 进程与线程的区别是什么？   # title 即正面的问题
category: programming     # 分类
tags:                     # 必填；按知识点填 2~4 个
  - os
  - concurrency
status: draft             # 新导入默认 draft；复核后再改 published
difficulty: medium        # 可选：easy | medium | hard
subcategory: null         # 可选
theme: null               # 可选
aliases: []
related: []
---

<!-- flip -->

## 答案

（这里的 Markdown 就是卡片背面。）
```

要点：

- `<!-- flip -->` **以上**是正面（问题），**以下**是背面（答案）。若没有 `<!-- flip -->`，
  第一个 `## ` 标题会被当作答案起点，而 `title` 作为问题。
- `tags` 一定要有 key（新建卡模板已内置）；标签驱动筛选与搜索，鼓励 2~4 个。
- `id` 必须唯一，脚本会做重复校验；建议 `<领域>-<主题>-<序号>`，如 `llm-agent-001`。
- 只有 `status: published` 会进入公开浏览（首页 / 分类 / 标签 / 搜索）；批量导入先留 `draft`。
- 可直接复用编辑器模板：`src/features/editor/frontmatter.ts` 的 `newCardTemplate()`。

## 第 3 步：生成 SQL

```bash
# 递归收集目录下所有 *.md 卡片，生成 .cards/cards.sql
pnpm cards:sql -- .cards/os --out .cards/cards.sql

# 也可以直接打印到 stdout 检查
pnpm cards:sql -- .cards/os --out -
```

参数：

- `<input...>`：卡片 `.md` 文件，或包含它们的目录（递归查找 `*.md`）；可传多个。
- `--out <file>`：输出 SQL（默认 `.cards/cards.sql`；`-` 表示 stdout）。
- `--db <name>`：D1 数据库名（默认 `quiz-cosmos-db`）。
- `--local` / `--remote`：提交目标（默认 `--remote`）。
- `--submit`：生成后立刻执行 wrangler 提交。
- `-h, --help`：帮助。

脚本会：

- 用 `src/lib/parser.ts` 的 `parseCard` 解析并规范化每张卡（与前端 / API 同一套规则）；
- 用 `stripMarkdown` 生成 `search_text`；
- 校验必填字段、`id` 唯一、标签去重；
- 生成**幂等**的 SQL：`cards` 按 `id` upsert，`card_tags` 先删后建，`tags` 按 `name` upsert；
- 任何一张卡解析失败或 `id` 重复 → 打印全部问题并退出，**不写出**一半的 SQL。

## 第 4 步：提交到 D1

```bash
# 推荐：生成并提交（远端 D1）
pnpm cards:sql -- .cards/os --submit

# 等价的手动命令
npx wrangler d1 execute quiz-cosmos-db --remote --file=.cards/cards.sql

# 本地开发库
npx wrangler d1 execute quiz-cosmos-db --local --file=.cards/cards.sql
```

提交后验证：网页端列表 / 分类 / 标签 / 搜索应能看到新卡
（`status: published` 才会进入公开索引）。

## 安全与注意事项

- **只读源笔记**：抽取不修改用户的源 Markdown。
- **upsert 会覆盖**：相同 `id` 的既有卡片会被本次 SQL 覆盖（`updated_at` 刷新、`deleted_at` 清空）。
  导入前确认没有撞上已发布的卡；不确定就先 `--local` 试跑。
- **先看一眼**生成的 `.cards/cards.sql` 再 `--submit`。
- **不要**把编辑密码写进脚本或仓库；本方案用 wrangler 的登录态，全程不涉及明文密码。
- `.cards/` 是工作目录（已 gitignore）：中间卡片与 SQL 默认不入库。
  需要长期保存的卡片请移到仓库内的正式位置。
