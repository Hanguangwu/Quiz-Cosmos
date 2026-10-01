# 知识卡片内容规范（CONTENT_SCHEMA）

> 正式知识数据只存在于 `content/**/*.md`（AGENTS.md §3）。
> 索引 `public/index.json` 由构建生成，IndexedDB 只保存编辑草稿。

---

## 一、目录结构

```text
content/
├── ai/llm/ai-llm-token-001.md
├── programming/
│   ├── os/os-001.md
│   ├── db/db-001.md
│   └── java/java-001.md
config/categories.yml      # 分类注册表（唯一来源）
public/index.json          # 构建产物，勿手改
```

路径约定：<code>content/&lt;category&gt;/&lt;subcategory&gt;/&lt;id&gt;.md</code>，文件名必须与 front matter 的 `id` 一致。

## 二、Front Matter 字段

必填（`src/types/card.ts` 的 `REQUIRED_FIELDS`）：

| 字段 | 类型 | 取值 | 说明 |
| --- | --- | --- | --- |
| `schemaVersion` | number | `1` | 与 `SCHEMA_VERSION` 不一致直接报错 |
| `id` | string | 全局唯一 | 非空、不含空白字符 |
| `type` | string | `qa` | 卡片类型 |
| `title` | string | 非空 | 正面问题文本 |
| `category` | string | 见第五节 | 必须在 `config/categories.yml` 中声明 |
| `tags` | string[] | 3～6 个 | 搜索与筛选依据，不要留空 |
| `status` | string | `draft` / `review` / `published` / `archived` | 未知值报错 |

选填（缺省时解析为 `null` 或 `[]`）：

| 字段 | 类型 | 取值 | 说明 |
| --- | --- | --- | --- |
| `subcategory` | string | 见第五节 | 未声明时给出警告 |
| `difficulty` | string | `easy` / `medium` / `hard` | 未知值报错 |
| `theme` | string | 主题注册表 id | 留空表示跟随用户默认主题；不要写 `null` |
| `aliases` | string[] | 自由 | 别名，用于搜索 |
| `related` | string[] | 已存在的 id | 只允许单向引用，禁止自引用 |
| `created` | string | `YYYY-MM-DD` | |
| `updated` | string | `YYYY-MM-DD` | 早于 `created` 时给出警告 |

未列出的键会给出警告（不会中断构建），请及时清理。

## 三、正文与 QA 切分

正文承载正反面。`splitQaCard` 按以下优先级切分（`src/lib/parser.ts`）：

1. 存在**独占一行**的 `<!-- flip -->`：之前为问题，之后为答案。
2. 否则存在 `## ` 二级标题：在**第一个**二级标题处切分，标题及其后为答案。
3. 否则：`title` 作为问题，整个正文作为答案。

因此推荐写法（问题同时出现在 `title` 与正文首段，保证正面非空）：

```markdown
## 问题

问题文本……

<!-- flip -->

## 答案

1. 要点一
2. 要点二
```

`<!-- flip -->` 必须单独占一行，否则校验报错。

## 四、ID 约定

- 迁移自旧站的 8 张卡片**保留原有短 id**（`os-001`、`os-002`、`os-003`、`db-001`、`db-002`、`java-001`、`java-002`、`java-003`），不要重写，以免历史链接失效。
- **新增卡片**统一使用 `<category>-<topic>-<NNN>`，例如 `programming-os-004`、`ai-llm-token-002`、`history-ming-001`。
- id 全库唯一，大小写敏感，路由为 `/card/<slug>`，其中 `slug = slugify(id)`。

## 五、分类注册表

`config/categories.yml` 是分类的唯一声明处（`scripts/validate-content.ts` 会校验）：

| id | 名称 | order | subcategory |
| --- | --- | --- | --- |
| `ai` | 人工智能 | 1 | `llm` |
| `programming` | 编程 | 2 | `os`、`db`、`java` |
| `history` | 历史 | 3 | — |
| `philosophy` | 哲学 | 4 | — |
| `other` | 其他 | 5 | — |

新增分类：先改本文件，再建目录，最后加卡片。

## 六、命令

```bash
pnpm run validate:content   # 校验字段、重复 id、分类、theme、related、正文切分
pnpm run build-index        # 生成 public/index.json（含全部分析计数）
pnpm run build              # validate -> build-index -> tsc -b -> vite build
```

`validate:content` 打印中文报告，出现错误时以退出码 1 结束，CI 会直接中断。

## 七、完整示例

```markdown
---
schemaVersion: 1
id: programming-os-004
type: qa
title: 什么是虚拟内存？
category: programming
subcategory: os
tags:
  - 操作系统
  - 虚拟内存
  - 页表
  - 内存管理
difficulty: medium
status: published
aliases:
  - Virtual Memory
related:
  - os-001
created: 2026-01-10
updated: 2026-01-10
---

## 问题

什么是虚拟内存？

<!-- flip -->

## 答案

1. **地址抽象**：每个进程看到独立的连续地址空间，物理内存由操作系统按需分配。
2. **分页与换页**：内存按固定大小的页管理，缺页时由操作系统从磁盘换入。
3. **隔离与保护**：页表项记录访问权限，一个进程无法直接访问其他进程的内存。

> 虚拟内存让程序可以使用超过物理容量的地址空间，但频繁换页会显著降低性能。
```

## 八、单一数据源

- **Markdown + Git 是唯一正式数据**：内容改动必须提交到仓库。
- `public/index.json` 是**构建产物**，由 `build:index` 生成，不要手工编辑。
- IndexedDB（`src/lib/drafts.ts`）**仅用于编辑草稿**，随时可丢弃；它不能成为唯一数据来源。
- 主题、样式、分页、导出都不得反向修改内容数据。
