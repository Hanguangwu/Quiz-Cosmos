# 知库 · Knowledge Cards

> Markdown 驱动的个人知识卡片库

数据属于 Markdown，版本属于 Git，索引属于构建系统，展示属于 React，视觉属于主题引擎。

一个纯前端、无后端、无登录的个人知识库：知识内容以 `content/**/*.md`
（YAML Front Matter + 正文）保存，构建期生成 `index.json`，浏览器端完成
搜索、QA 卡片翻面、复习、主题切换与图片导出。

设计与实现规范见 [AGENTS.md](./AGENTS.md)，原始方案见
[public/design-plan.md](./public/design-plan.md)。

---

## 快速开始

```bash
pnpm install

pnpm dev            # 开发服务器
pnpm build          # 校验内容 → 生成索引 → 类型检查 → 构建
pnpm preview        # 预览生产构建
```

单独运行某一步：

```bash
pnpm validate:content   # 校验 content/**/*.md（重复 ID、缺失字段、未知分类…）
pnpm build-index       # 生成 public/index.json
pnpm typecheck         # tsc -b
pnpm icons             # 由应用标记生成 PWA 图标（public/favicon.svg）
```

## 数据格式

每张卡片是一个 Markdown 文件：

```markdown
---
schemaVersion: 1
id: os-001
type: qa
title: 进程和线程的区别是什么？
category: programming
subcategory: os
tags:
  - 操作系统
  - 进程
  - 线程
difficulty: medium
status: published
created: 2026-01-10
updated: 2026-01-10
---

<!-- flip -->

## 答案

……正文……
```

- 必填：`schemaVersion` `id` `type` `title` `category` `tags` `status`
- 正面（问题）= `title`；背面（答案）= `<!-- flip -->` 之后的内容
- 未使用 `<!-- flip -->` 时，正文第一个 `##` 之前为正面，之后为背面
- `status: published` 才会作为公开内容展示

完整规范见 [CONTENT_SCHEMA.md](./CONTENT_SCHEMA.md)。

## 新增一张卡片

1. 打开应用内 `/editor`，左侧写 Markdown，右侧实时预览
2. 下载 `.md`，放入 `content/<分类>/` 目录
3. `git commit && git push`，CI 自动校验并重新生成索引

编辑器只把草稿存在浏览器 IndexedDB 里，**不会**替你提交文件——正式数据始终
是 Git 中的 Markdown。

## 目录结构

```text
content/            知识卡片（唯一正式数据源）
config/             categories.yml（分类定义）
scripts/            validate-content.ts / build-index.ts / generate-icons.ts
src/
├── features/       cards / markdown / themes / editor / search / export
├── lib/            parser、search、export、drafts
├── shell/          应用外壳与阅读偏好
├── ui/             shadcn 风格基础组件
├── pages/          路由页面
├── styles/         tokens.css（设计变量 + 卡片样式）
└── types/          数据契约
```

## 关键设计

- **数据与展示分离**：Markdown 是唯一数据源，React 只负责渲染
- **主题即数据**：新增主题只改 `src/features/themes/registry.ts`，
  不触碰卡片组件（10 套主题覆盖极简 / 艺术 / 科技 / 中国传统 / 自然）
- **单一 Renderer**：所有 Markdown 渲染都走同一个组件，主题通过
  `--card-*` CSS 变量影响外观
- **纯前端搜索**：Fuse.js 在浏览器内检索 `index.json`，不请求服务器
- **内容不被裁切**：代码块、表格、公式、图片等在卡片中完整可达，
  超出宽度的元素横向滚动，而不是被截断
- **长文本连续阅读**：卡片高度由内容决定，不做自动分页
- **离线可用**：PWA 预缓存应用外壳与索引

## 部署

推送到 `main` 分支后，GitHub Actions 会执行
`validate-content → build-index → tsc → vite build` 并部署到 GitHub Pages。
应用部署在 `/Quiz-Cosmos/` 子路径下（见 `vite.config.ts` 的 `base`）。
