下面给出一套**重新设计后的完整方案**。核心思路是：**不要把它做成普通 Markdown 编辑器，而是做成“以 Markdown 为数据源、以 QA 知识卡片为核心、以主题化阅读/复习为主要展示形式”的纯前端个人知识库。**

数据层建议采用：

> **Markdown + YAML Front Matter + Git 仓库文件系统作为唯一数据源，前端构建时索引生成 JSON。**

这样既方便人工编辑、批量迁移和 Git 管理，又非常适合 GitHub Pages 静态部署。

------

# 个人知识库系统设计方案

## 1. 产品定位

### 1.1 产品名称

暂定：

> **Knowledge Cards**
>
> Markdown 驱动的个人知识卡片库

也可以采用更具有个人知识库属性的名称：

- `MindCards`
- `InkBase`
- `KnowDeck`
- `QACards`
- `My Knowledge Garden`
- `知库`
- `知笺`
- `问答录`
- `格物`

------

## 2. 核心设计理念

系统不采用传统“文章博客”的思路，而采用：

```text
Markdown 数据
      ↓
结构化 QA
      ↓
知识索引
      ↓
卡片展示
      ↓
主题渲染
      ↓
阅读 / 搜索 / 筛选 / 复习
```

用户看到的是：

> **精美知识卡片**

而不是：

> Markdown 文件。

因此：

```text
编辑端 ≠ 展示端
```

这是整个系统非常重要的设计原则。

------

# 3. 整体架构

建议最终采用：

```text
┌──────────────────────────────────────┐
│              React App              │
├──────────────────────────────────────┤
│                                      │
│  首页                                │
│  ├── 知识卡片                        │
│  ├── 分类                            │
│  ├── 标签                            │
│  ├── 搜索                            │
│  └── 最近更新                        │
│                                      │
│  QA 阅读器                           │
│  Markdown 编辑器                    │
│  主题预览                            │
│  数据管理                            │
│                                      │
├──────────────────────────────────────┤
│             Domain Layer             │
│                                      │
│  QA Parser                           │
│  Markdown Renderer                   │
│  Search Index                        │
│  Theme Engine                        │
│  Pagination Engine                   │
│  Export Engine                       │
│                                      │
├──────────────────────────────────────┤
│             Data Layer               │
│                                      │
│  Markdown                            │
│  YAML Front Matter                   │
│  JSON Index                          │
│                                      │
└──────────────────────────────────────┘
                    ↓
             GitHub Repository
                    ↓
             GitHub Pages
```

------

# 4. 技术栈

## 前端

| 技术         | 用途        |
| ------------ | ----------- |
| React        | UI          |
| TypeScript   | 类型系统    |
| Vite         | 构建        |
| React Router | 页面路由    |
| Tailwind CSS | 样式        |
| shadcn/ui    | UI 基础组件 |
| Lucide React | 图标        |

------

## Markdown

```text
react-markdown
remark-gfm
remark-math
rehype-katex
rehype-prism-plus
```

支持：

- Markdown
- GFM
- 表格
- Task List
- LaTeX
- 数学公式
- 代码高亮
- 引用
- 图片
- 链接

例如：

```markdown
$$
E = mc^2
$$
```

直接渲染。

------

# 5. 最重要的设计：数据与 UI 分离

建议严格遵守：

> **Markdown 是 Source of Truth。**

而不是：

```text
React State
      ↓
IndexedDB
      ↓
最终数据
```

因为后者会导致：

- 数据难以迁移
- Git 不方便管理
- 难以批量修改
- 难以备份
- 难以在其他软件使用

因此采用：

```text
Markdown
+
Front Matter
+
目录结构
```

作为正式数据。

------

# 6. 数据组织方式

建议目录：

```text
knowledge-base/
│
├── content/
│   │
│   ├── computer/
│   │   ├── react/
│   │   │   ├── react-hooks.md
│   │   │   └── react-state.md
│   │   │
│   │   └── typescript/
│   │
│   ├── ai/
│   │   ├── llm/
│   │   └── agent/
│   │
│   ├── history/
│   │
│   └── philosophy/
│
├── assets/
│   ├── images/
│   └── attachments/
│
├── config/
│   ├── categories.yml
│   └── themes.yml
│
└── index.json
```

------

# 7. 单个知识卡片的数据格式

这是整个项目最关键的部分。

建议：

~~~markdown
---
id: react-hooks-001
type: qa
title: React 中为什么不能直接修改 State？
category: programming
subcategory: react

tags:
  - React
  - Hooks
  - State

difficulty: medium

status: published

created: 2026-09-30
updated: 2026-09-30

aliases:
  - React State 修改
  - useState

related:
  - react-hooks-002
  - react-state-001

theme: cyberpunk

---

# 为什么不能直接修改 React State？

React 的 State 应当通过对应的更新函数进行修改。

例如：

```tsx
setCount(count + 1)
~~~

而不是：

```tsx
count = count + 1
```

## 原因

React 需要通过 State 更新机制知道组件的数据发生了变化。

直接修改变量不会触发 React 的重新渲染机制。

## 示例

```tsx
const [count, setCount] = useState(0)

setCount(count + 1)
```

## 记忆

> State 应当通过 React 提供的更新机制进行修改。

```
---

# 8. 为什么推荐 Front Matter

因为这样可以把：

```text
内容
```

和：

```text
数据库字段
```

分开。

例如：

```yaml
id: react-hooks-001
type: qa
category: programming
tags:
  - React
  - Hooks
difficulty: medium
status: published
```

负责：

- 搜索
- 分类
- 标签
- 排序
- 筛选
- 推荐
- 统计

而 Markdown 正文负责：

- 问题
- 答案
- 解释
- 示例
- 代码
- 公式

------

# 9. QA 卡片模型

建议不要把 QA 简单理解成：

```text
question
answer
```

而采用：

```text
KnowledgeCard

├── metadata
│
├── question
│
├── answer
│
├── explanation
│
├── examples
│
├── notes
│
└── references
```

但这些内容仍然使用 Markdown 表达。

------

# 10. 正面 / 反面答案

用户特别提出：

> 数据主要是 QA 类型（正面问题和反面答案）

建议在数据层统一称为：

```text
Question
Answer
```

展示层再使用：

```text
正面：问题
反面：答案
```

这样更接近 Anki。

例如：

```text
┌──────────────────────────┐
│                          │
│      什么是闭包？        │
│                          │
│        React             │
│        JavaScript        │
│                          │
└──────────────────────────┘
```

点击：

```text
Flip
```

变成：

```text
┌──────────────────────────┐
│                          │
│        答案              │
│                          │
│ 闭包是函数与其词法环境   │
│ 的组合……                 │
│                          │
└──────────────────────────┘
```

------

# 11. 编辑模式与展示模式完全不同

这是本项目区别于 MD2Card 的核心。

## 编辑模式

采用 IDE / Obsidian 风格：

```text
┌──────────────────────────────────────┐
│ Markdown Editor                      │
├───────────────────┬──────────────────┤
│                   │                  │
│ # 什么是闭包？    │  什么是闭包？    │
│                   │                  │
│ 闭包是……          │  闭包是……        │
│                   │                  │
│ ```js             │  function...     │
│ function...       │                  │
│ ```               │                  │
│                   │                  │
└───────────────────┴──────────────────┘
```

即：

> 左 Markdown，右实时 Preview。

------

# 12. 展示模式

展示模式则完全隐藏 Markdown。

变成：

```text
┌───────────────────────────────┐
│                               │
│        什么是闭包？           │
│                               │
│        JavaScript             │
│                               │
│      点击查看答案 →           │
│                               │
└───────────────────────────────┘
```

翻面后：

```text
┌───────────────────────────────┐
│                               │
│          答案                 │
│                               │
│ 闭包是函数以及其词法环境的    │
│ 组合。                        │
│                               │
│ ───────────────────────────   │
│ 示例                          │
│                               │
│ function outer() {...}        │
│                               │
└───────────────────────────────┘
```

------

# 13. 页面结构

建议最终设计成 6 个主要页面。

```text
/
├── 首页
│
├── /cards
│   └── 卡片浏览
│
├── /card/:id
│   └── 单卡片
│
├── /search
│   └── 搜索
│
├── /editor
│   └── Markdown 编辑器
│
└── /about
```

------

# 14. 首页

首页不是博客首页，而是：

> **知识库 Dashboard**

建议：

```text
┌─────────────────────────────────────┐
│ 知识库                              │
│                                     │
│ Search knowledge...                 │
│                                     │
├───────────┬───────────┬─────────────┤
│ 1,248     │ 82        │ 36          │
│ Cards     │ Tags      │ Categories  │
├───────────┴───────────┴─────────────┤
│                                     │
│ 最近学习                             │
│                                     │
│ ┌─────┐ ┌─────┐ ┌─────┐             │
│ │ QA  │ │ QA  │ │ QA  │             │
│ └─────┘ └─────┘ └─────┘             │
│                                     │
├─────────────────────────────────────┤
│ 分类                                │
│                                     │
│ AI     编程     历史     哲学       │
└─────────────────────────────────────┘
```

------

# 15. 搜索系统

建议第一阶段完全使用前端搜索。

构建时生成：

```text
index.json
```

例如：

```json
{
  "cards": [
    {
      "id": "react-hooks-001",
      "title": "什么是闭包？",
      "tags": ["JavaScript", "React"],
      "category": "programming"
    }
  ]
}
```

前端：

```text
index.json
      ↓
Fuse.js
      ↓
Search
```

这样无需服务器。

支持：

```text
关键词
标签
分类
标题
正文
ID
```

------

# 16. 标签系统

标签建议采用：

```yaml
tags:
  - React
  - JavaScript
  - Frontend
```

展示：

```text
#React
#JavaScript
#Frontend
```

点击：

```text
#React
```

进入：

```text
React 知识卡片

124 cards
```

------

# 17. 分类系统

标签和分类不要混在一起。

### Category

表达：

> 这是什么领域？

例如：

```text
Programming
AI
History
Philosophy
Economics
Design
```

### Tag

表达：

> 这张卡与什么概念相关？

例如：

```text
React
LLM
RAG
Agent
Transformer
```

------

# 18. 主题系统

主题系统可以直接继承 MD2Card 的设计思想。

核心：

```text
Theme
    ↓
CSS Variables
    ↓
Card Root
    ↓
所有 Markdown 元素
```

例如：

```text
--card-background
--card-foreground
--card-primary
--card-secondary
--card-border
--card-code-background
--card-blockquote
--card-table
```

这样：

```text
主题
 ↓
CSS Variables
 ↓
Markdown Renderer
```

而不是每个主题单独写 JSX。

------

# 19. 主题分类

建议把 34 套主题重新组织为：

### 极简

```text
Apple Notes
Minimal
Paper
Mono
Academic
```

### 艺术

```text
Pop Art
Memphis
Comic
Retro
Vintage
```

### 科技

```text
Cyberpunk
Terminal
Neon
Matrix
Futuristic
```

### 中国传统

```text
水墨
宋式
明式
竹简
宣纸
古籍
```

### 自然

```text
Forest
Ocean
Desert
Mountain
```

------

# 20. 中国传统主题

这是这个项目很适合发挥特色的地方。

例如：

```text
┌─────────────────────────────┐
│                             │
│        何谓中庸？           │
│                             │
│   中者，不偏不倚之谓也。    │
│                             │
│   ─────────────────────     │
│                             │
│        《中庸》             │
│                             │
└─────────────────────────────┘
```

可以使用：

```text
宣纸纹理
墨色
朱砂
印章
宋体
楷体
竖排
```

------

# 21. Markdown 即时预览

编辑器建议：

```text
Monaco Editor / CodeMirror
```

如果希望项目更加轻量：

> CodeMirror 6

布局：

```text
┌──────────────────┬──────────────────┐
│ Markdown         │ Preview          │
│                  │                  │
│ # Question       │ Question          │
│                  │                  │
│ Answer...        │ Answer...         │
│                  │                  │
└──────────────────┴──────────────────┘
```

移动端则变成：

```text
[ 编辑 ] [ 预览 ]
```

------

# 22. 长文本分页

保留你提出的四步方案。

```text
Markdown
    ↓
splitBlocks()
    ↓
Atomic Blocks
    ↓
Render
    ↓
measureChildren()
    ↓
greedPack()
    ↓
Pages
```

原子块：

```text
Heading
Paragraph
List
Quote
Code
Table
Image
Math
```

规则：

> 任何原子块不得被分页算法从中间截断。

------

# 23. QA 卡片的分页策略

普通文章：

```text
Page 1
Page 2
Page 3
```

QA 卡片则建议：

```text
Front
   ↓
Question
```

答案：

```text
Back
   ↓
Answer
```

如果答案过长：

```text
Back 1
Back 2
Back 3
```

因此：

> **卡片翻面 ≠ 页面分页**

两个概念分离。

------

# 24. 导出系统

保留：

```text
html2canvas
```

支持：

```text
PNG
JPG
WebP
SVG
```

倍率：

```text
1x
2x
3x
4x
```

适合：

- 微信分享
- 小红书
- 知识海报
- 印刷
- PPT
- 手机保存

------

# 25. SVG 导出

SVG：

```text
HTML
 ↓
Computed Style
 ↓
Recursive Inline
 ↓
foreignObject
 ↓
SVG
```

最终：

```text
knowledge-card.svg
```

可以无限缩放。

------

# 26. PWA

PWA 是项目的重要能力。

支持：

```text
Install
Offline
Standalone
App Icon
Splash Screen
```

用户可以：

```text
Chrome
 ↓
安装
 ↓
Android Home Screen
```

成为类似原生 App 的应用。

------

# 27. Android

推荐：

```text
React
+
Vite
+
PWA
+
Capacitor
```

架构：

```text
React App
    │
    ├── Web
    │
    └── PWA
          │
          └── Android
               ↓
           Capacitor
```

第一阶段：

> GitHub Pages + PWA

第二阶段：

> Capacitor → Android APK / AAB

这样不需要维护 Android 原生 UI。

------

# 28. 本地数据

虽然 GitHub 是正式数据源，但编辑过程中可以使用：

```text
IndexedDB
```

作为：

> 临时工作区。

例如：

```text
Markdown
 ↓
Editor
 ↓
IndexedDB Draft
```

用户刷新页面不会丢失。

但是：

```text
IndexedDB ≠ 正式数据库
```

正式数据仍然是 Git 中的 Markdown。

------

# 29. 数据生命周期

完整流程：

```text
创建卡片
    ↓
编辑 Markdown
    ↓
IndexedDB Draft
    ↓
预览
    ↓
导出
    ↓
Commit
    ↓
GitHub
    ↓
GitHub Pages Build
    ↓
index.json
    ↓
网页展示
```

------

# 30. GitHub 数据工作流

这里建议区分两个模式。

## 模式 A：开发者模式

直接修改：

```text
content/**/*.md
```

然后：

```bash
git add .
git commit
git push
```

GitHub Actions：

```text
Push
 ↓
Build
 ↓
Generate Index
 ↓
Deploy
```

------

## 模式 B：网页编辑模式

浏览器：

```text
Editor
 ↓
Export Markdown
```

第一阶段可以：

```text
Download .md
```

用户放进：

```text
content/
```

然后提交 Git。

------

# 31. 为什么第一阶段不建议网页直接修改 GitHub

因为你明确要求：

> 0 后端、0 云端调用。

如果网页直接提交 GitHub，就需要：

```text
GitHub API
```

以及认证。

这会破坏：

```text
纯前端
0 云端调用
无登录
```

因此第一阶段采用：

> **本地编辑 → 导出 Markdown → Git 提交**

更加干净。

未来如果需要，可以增加：

```text
File System Access API
```

直接编辑本地 Git 仓库。

------

# 32. 更推荐的最终编辑模式

未来可以做：

```text
Open Folder
```

用户选择：

```text
knowledge-base/
```

浏览器直接读取：

```text
content/
```

修改后：

```text
Save
```

直接写回：

```text
.md
```

这样整个应用真正变成：

> **Git + Markdown 的本地知识库 GUI。**

------

# 33. 自动生成 Index

构建阶段运行：

```text
content/
 ↓
Front Matter Parser
 ↓
Metadata Extractor
 ↓
Search Index Generator
 ↓
index.json
```

生成：

```json
{
  "version": 1,
  "generatedAt": "...",
  "cards": [],
  "categories": [],
  "tags": []
}
```

------

# 34. 数据迁移

这是采用 Markdown 的最大优势。

未来可以迁移到：

```text
Obsidian
Logseq
Joplin
Notion
其他 Markdown 系统
```

因为：

```text
Markdown
+
YAML
```

是开放格式。

------

# 35. 数据版本

建议：

```yaml
schemaVersion: 1
```

例如：

```markdown
---
schemaVersion: 1
id: ai-agent-001
type: qa
---
```

未来修改数据结构：

```text
v1
 ↓
Migration
 ↓
v2
```

避免数据格式被锁死。

------

# 36. 图片资源

不要把图片 Base64 写进 Markdown。

采用：

```text
assets/
├── images/
│   ├── react/
│   └── ai/
```

Markdown：

```markdown
![React Architecture](../../assets/images/react/architecture.png)
```

这样方便：

- Git 管理
- 数据迁移
- 图片复用
- 离线使用

------

# 37. 数据唯一 ID

每张卡必须有：

```yaml
id: react-hooks-001
```

建议：

```text
领域-主题-序号
```

或者：

```text
UUID
```

例如：

```text
react-hooks-001
```

更适合人工管理。

------

# 38. 卡片状态

建议：

```yaml
status: draft
```

或者：

```text
draft
review
published
archived
```

这样：

```text
Git 中存在
```

不代表：

```text
网页一定展示
```

只有：

```yaml
status: published
```

才进入公开索引。

------

# 39. 卡片难度

可以：

```yaml
difficulty: easy
```

或者：

```text
easy
medium
hard
```

未来可以支持：

```text
复习模式
```

但第一阶段不需要实现完整 Anki SM-2。

------

# 40. Anki 模式

建议设计成：

```text
浏览模式
复习模式
```

浏览：

```text
Question
 ↓
Answer
```

复习：

```text
Question
 ↓
Think
 ↓
Show Answer
 ↓
Remember?
```

但：

> **第一版本只实现视觉上的 Anki 卡片，不实现复杂的间隔重复算法。**

避免项目过度膨胀。

------

# 41. 响应式设计

### Desktop

```text
Sidebar | Content | Preview
```

### Tablet

```text
Sidebar
Content
```

### Mobile

```text
Header
Search
Card
Bottom Navigation
```

------

# 42. 手机端导航

建议：

```text
┌──────────────────────────┐
│ Knowledge                │
│                          │
│ Search                   │
│                          │
│ Card                     │
│                          │
├──────────────────────────┤
│ Home Search Tags Settings│
└──────────────────────────┘
```

------

# 43. 桌面端导航

```text
┌──────────────┬────────────────────────┐
│ Knowledge    │                        │
│              │                        │
│ Home         │      Cards             │
│ All Cards    │                        │
│ Categories   │                        │
│ Tags         │                        │
│ Favorites    │                        │
│              │                        │
│ ─────────    │                        │
│ Settings     │                        │
└──────────────┴────────────────────────┘
```

------

# 44. 推荐项目目录

```text
knowledge-cards/
│
├── .github/
│   └── workflows/
│       └── deploy.yml
│
├── content/
│   ├── ai/
│   ├── programming/
│   ├── history/
│   └── philosophy/
│
├── assets/
│   ├── images/
│   └── fonts/
│
├── public/
│   ├── icons/
│   └── manifest.webmanifest
│
├── src/
│   ├── components/
│   │
│   ├── pages/
│   │
│   ├── features/
│   │   ├── cards/
│   │   ├── editor/
│   │   ├── search/
│   │   ├── themes/
│   │   └── export/
│   │
│   ├── lib/
│   │   ├── markdown.ts
│   │   ├── parser.ts
│   │   ├── search.ts
│   │   ├── pagination.ts
│   │   ├── export.ts
│   │   └── themes.ts
│   │
│   ├── types/
│   │
│   ├── data/
│   │
│   └── styles/
│
├── scripts/
│   ├── build-index.ts
│   └── validate-content.ts
│
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
└── AGENTS.md
```

------

# 45. 核心模块关系

```text
                    ┌───────────────┐
                    │ Markdown Data │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ Content Parser│
                    └───────┬───────┘
                            │
                ┌───────────┼───────────┐
                ▼           ▼           ▼
             Metadata     Markdown    Assets
                │           │
                ▼           ▼
             Search      Renderer
                │           │
                └─────┬─────┘
                      ▼
                Theme Engine
                      │
                      ▼
                Card Renderer
                      │
            ┌─────────┼─────────┐
            ▼         ▼         ▼
          Browser   Export    PWA
```

------

# 46. shadcn/ui 的定位

不要让 shadcn/ui 负责“主题”。

它主要负责：

```text
Button
Dialog
Dropdown
Tabs
Input
Select
Sheet
Tooltip
Toast
```

而：

```text
主题卡片
Markdown 内容
视觉风格
```

由：

```text
Theme Engine
```

负责。

这样架构更加清晰。

------

# 47. Theme Engine

建议：

```ts
ThemeDefinition
```

概念结构：

```text
ThemeDefinition
│
├── id
├── name
├── category
├── variables
├── typography
├── radius
├── shadow
├── texture
└── layout
```

主题切换：

```text
data-theme="cyberpunk"
```

然后：

```css
[data-theme="cyberpunk"] {
    --card-bg: ...;
    --card-text: ...;
}
```

------

# 48. 卡片组件

核心组件：

```text
<KnowledgeCard />
```

内部：

```text
KnowledgeCard
├── CardHeader
├── Question
├── Answer
├── MarkdownContent
├── Tags
├── Metadata
└── CardFooter
```

------

# 49. 卡片状态

```text
front
back
expanded
selected
```

动画：

```text
Front
 ↓
3D Flip
 ↓
Back
```

桌面端可以：

```text
Hover
```

移动端：

```text
Tap
```

------

# 50. 设计原则

建议整个项目遵循：

### 数据优先

```text
Markdown > UI
```

### 内容优先

```text
内容 > 装饰
```

### 主题可替换

```text
Content ≠ Theme
```

### 无服务器

```text
Build-time > Runtime API
```

### 可迁移

```text
Open Format > Proprietary DB
```

------

# 51. GitHub 部署

推荐：

```text
GitHub Repository
       ↓
GitHub Actions
       ↓
npm install
       ↓
validate-content
       ↓
build-index
       ↓
vite build
       ↓
GitHub Pages
```

------

# 52. 内容校验

建议增加：

```text
scripts/validate-content.ts
```

提交时检查：

```text
ID 是否重复
category 是否存在
theme 是否存在
status 是否正确
tags 是否合法
Markdown 是否能解析
```

例如：

```text
❌ Duplicate ID:
react-hooks-001

❌ Unknown theme:
cyber-blue

❌ Missing category:
ai-agent-002
```

这样可以避免知识库越来越大后出现数据污染。

------

# 53. 数据规范

建议建立：

```text
CONTENT_SCHEMA.md
```

规定：

```text
必填字段：

id
type
title
category
tags
status
```

可选：

```text
difficulty
theme
aliases
related
created
updated
```

------

# 54. 关于双向链接

你已经说：

> 双链不好实现就略过。

第一版本可以完全不做。

只保留：

```yaml
related:
  - ai-agent-001
```

以后再做：

```text
[[ai-agent-001]]
```

甚至：

```text
Knowledge Graph
```

都可以。

因此现在不应该为了双链增加架构复杂度。

------

# 55. 第一版本 MVP

我建议 MVP 只实现：

```text
① Markdown 数据
② Front Matter
③ QA 卡片
④ Markdown 渲染
⑤ KaTeX
⑥ 代码高亮
⑦ 搜索
⑧ 标签
⑨ 分类
⑩ 主题
⑪ 卡片翻面
⑫ 响应式
⑬ PWA
⑭ PNG/JPG 导出
⑮ GitHub Pages
```

暂时不做：

```text
登录
云同步
数据库
后端
双链
AI
复杂 Anki 算法
协作
```

------

# 56. 第二阶段

之后可以加入：

```text
本地文件夹读取
        ↓
File System Access API
        ↓
直接编辑 Git Repository
```

以及：

```text
复习系统
收藏
阅读记录
学习统计
知识图谱
```

------

# 57. 第三阶段

如果未来愿意增加后端：

```text
GitHub
   ↓
API
   ↓
Serverless
   ↓
多人同步
```

但现在完全没有必要。

------

# 58. 最终技术路线

最终推荐架构：

```text
                    GitHub Repository
                           │
                    Markdown + YAML
                           │
                           ▼
                   Build-time Parser
                           │
                  ┌────────┴────────┐
                  ▼                 ▼
             index.json        Markdown
                  │                 │
                  ▼                 ▼
               Search           Renderer
                  │                 │
                  └────────┬────────┘
                           ▼
                     Theme Engine
                           │
                           ▼
                    Knowledge Card
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
           Browser       PWA        Export
                                       │
                              ┌────────┼────────┐
                              ▼        ▼        ▼
                             PNG      SVG      JPG
```

这套架构的核心优势是：

> **Markdown 是数据库，Git 是版本控制，JSON 是索引，React 是阅读器，主题系统负责视觉表现。**

这比直接使用 SQLite、IndexedDB 或某个云数据库更符合你目前的“**个人知识库 + GitHub + 纯前端 + 可迁移**”目标。

------

# 59. AGENTS.md

项目根目录建议直接加入下面这份 `AGENTS.md`，用于约束后续 AI Agent / Coding Agent 的开发行为：

# AGENTS.md

## 项目名称

Knowledge Cards —— Markdown 驱动的个人知识卡片库。

本项目是一个纯前端、无后端、无云端数据库的个人知识管理与展示系统。

核心思想：

> Markdown 是唯一正式数据源，React 是展示层，JSON 是构建索引，Git 是版本控制。

------

## 一、核心目标

项目需要实现：

- Markdown 知识内容管理
- QA 类型知识卡片
- Markdown 实时预览
- KaTeX 数学公式
- GFM
- 代码高亮
- 搜索
- 标签筛选
- 分类浏览
- 卡片正反面展示
- 多主题系统
- 长文本自动分页
- PNG/JPG/WebP/SVG 导出
- 响应式设计
- PWA
- Android / Capacitor 兼容
- GitHub Pages 部署

------

## 二、核心架构原则

必须遵守：

```text
Markdown → Parser → Renderer → Theme → Card → Export
```

不得引入不必要的后端服务。

默认情况下：

- 不使用数据库服务器
- 不使用云端 API
- 不依赖登录系统
- 不依赖第三方内容 API
- 不把 IndexedDB 当作正式数据源

------

## 三、数据源原则

正式知识数据必须保存在：

```text
content/**/*.md
```

Markdown + YAML Front Matter 是正式数据格式。

IndexedDB 只能用于：

- 编辑草稿
- 临时状态
- 本地缓存

不得把 IndexedDB 数据作为唯一正式数据。

------

## 四、Markdown 数据规范

每张知识卡必须具有：

```yaml
---
schemaVersion: 1
id: unique-id
type: qa
title: title
category: category
tags:
  - tag
status: published
---
```

可选字段：

```yaml
subcategory:
difficulty:
theme:
aliases:
related:
created:
updated:
```

------

## 五、ID 规则

每张卡必须具有唯一 ID。

推荐：

```text
领域-主题-序号
```

例如：

```text
react-hooks-001
llm-agent-001
history-ming-001
```

禁止重复 ID。

------

## 六、状态

允许：

```text
draft
review
published
archived
```

只有：

```yaml
status: published
```

的内容默认进入公开索引。

------

## 七、目录结构

推荐：

```text
content/
├── ai/
├── programming/
├── history/
├── philosophy/
└── other/
```

资源：

```text
assets/
├── images/
├── fonts/
└── attachments/
```

源码：

```text
src/
├── components/
├── pages/
├── features/
├── lib/
├── types/
└── styles/
```

------

## 八、技术栈

优先使用：

- React
- TypeScript
- Vite
- React Router
- Tailwind CSS
- shadcn/ui
- Lucide React
- react-markdown
- remark-gfm
- remark-math
- rehype-katex
- rehype-prism-plus
- CodeMirror 6

新增依赖前，应确认是否确实有必要。

------

## 九、Markdown Renderer

Markdown 渲染必须支持：

- Heading
- Paragraph
- List
- Ordered List
- Blockquote
- Code
- Code Block
- Table
- Task List
- Image
- Link
- Math
- Inline Math

不得针对单个主题重新实现 Markdown Renderer。

------

## 十、主题系统

主题必须与内容分离。

禁止：

```text
Theme A → 独立 Card JSX
Theme B → 独立 Card JSX
```

应采用：

```text
Theme
 ↓
CSS Variables
 ↓
Common Card Renderer
```

主题新增原则：

> 新增主题只修改 themes 配置及相关 CSS，不修改知识卡片业务逻辑。

------

## 十一、主题变量

主题至少应支持：

```text
--card-background
--card-foreground
--card-primary
--card-secondary
--card-border
--card-code-background
--card-blockquote
--card-table
--card-muted
```

可以进一步支持：

```text
--card-radius
--card-shadow
--card-font
--card-line-height
```

------

## 十二、QA 卡片

QA 卡片采用：

```text
Front = Question
Back = Answer
```

展示逻辑：

```text
Question
 ↓
User interaction
 ↓
Answer
```

编辑器不应强制使用与展示端完全相同的 UI。

------

## 十三、编辑器

桌面端：

```text
Markdown Editor | Live Preview
```

移动端：

```text
Edit | Preview
```

Markdown 修改后应尽可能即时更新 Preview。

------

## 十四、分页引擎

分页必须遵循：

```text
splitBlocks()
 ↓
render
 ↓
measureChildren()
 ↓
greedPack()
```

以下元素不得从中间截断：

- Code Block
- Table
- Heading
- Image
- Math Block
- Quote
- List

如果一个原子块本身超过页面高度，应使用专门的 overflow 策略，而不是简单截断。

------

## 十五、搜索

搜索数据来自：

```text
index.json
```

搜索至少支持：

- title
- tags
- category
- aliases
- content
- id

搜索实现应优先保持纯前端。

------

## 十六、Index

构建过程中生成：

```text
index.json
```

索引包含：

- id
- title
- category
- tags
- status
- difficulty
- aliases
- related
- searchable text

不应该为了搜索在运行时请求服务器。

------

## 十七、GitHub Pages

部署流程：

```text
git push
 ↓
GitHub Actions
 ↓
validate-content
 ↓
build-index
 ↓
vite build
 ↓
GitHub Pages
```

所有公开内容必须能够在没有后端服务器的情况下正常运行。

------

## 十八、PWA

PWA 必须支持：

- manifest
- service worker
- offline shell
- standalone mode
- app icon
- responsive UI

不得假设用户始终在线。

------

## 十九、Android

Android 目标采用：

```text
React
+
PWA
+
Capacitor
```

不要为了 Android 单独重写 UI。

------

## 二十、导出

导出引擎使用：

```text
html2canvas
```

支持：

```text
PNG
JPG
WebP
```

倍率：

```text
1x
2x
3x
4x
```

SVG 导出应保持：

```text
self-contained
scalable
```

------

## 二十一、数据迁移

必须保持 Markdown 数据可迁移。

不得把核心知识内容锁定在：

- 私有数据库
- 二进制格式
- 专有云服务

未来应能够迁移到其他 Markdown 工具。

------

## 二十二、双向链接

第一阶段暂不实现双向链接。

可以支持：

```yaml
related:
  - card-id
```

但不要为了双向链接引入复杂数据库。

未来可以增加：

```text
[[card-id]]
```

------

## 二十三、不要过度工程化

第一版本禁止为了“未来可能需要”而提前加入：

- 用户系统
- 权限系统
- 云数据库
- 多用户协作
- 实时同步
- WebSocket
- 后端 API
- AI API

除非需求明确改变。

------

## 二十四、代码质量

所有代码必须：

- 使用 TypeScript
- 尽量保持类型安全
- 避免 any
- 保持组件职责单一
- 将业务逻辑与 UI 分离
- 将 Markdown 解析逻辑与 Card UI 分离
- 将 Theme Engine 与 Card Renderer 分离

------

## 二十五、修改现有功能

修改功能时：

1. 先理解现有架构
2. 尽量复用现有组件
3. 不随意改变数据格式
4. 如果必须改变数据格式，应升级 schemaVersion
5. 优先保持向后兼容
6. 不要复制大量重复组件

------

## 二十六、增加主题

增加主题时：

1. 在 Theme Definition 中增加主题
2. 定义 CSS Variables
3. 添加主题预览
4. 确认 Markdown 所有元素正常显示
5. 确认代码块、表格、公式、引用正常
6. 确认移动端正常

不要复制 Card 组件。

------

## 二十七、增加知识内容

新增知识卡片时：

1. 创建 Markdown 文件
2. 填写 Front Matter
3. 设置唯一 ID
4. 设置 category
5. 设置 tags
6. 设置 status
7. 使用 Markdown 编写内容
8. 执行内容校验
9. 构建 index
10. 确认页面正常

------

## 二十八、设计原则

UI 应优先考虑：

```text
内容可读性
>
信息层级
>
操作效率
>
视觉装饰
```

主题可以高度艺术化，但不能影响知识内容阅读。

------

## 二十九、移动端优先事项

移动端必须保证：

- 卡片宽度自适应
- Markdown 正常换行
- 表格可横向滚动
- 代码块可横向滚动
- 数学公式不溢出
- 图片自适应
- 卡片翻面可操作
- 导出按钮易于触摸
- 编辑器可以使用

------

## 三十、最终架构原则

整个项目始终保持：

```text
Git
 │
 └── Markdown
       │
       ├── Metadata
       │
       └── Content
              │
              ▼
          Build Index
              │
              ▼
            React
              │
       ┌──────┼──────┐
       ▼      ▼      ▼
     Search  Theme  Card
                     │
              ┌──────┼──────┐
              ▼      ▼      ▼
             Web     PWA   Export
```

核心原则：

> **数据属于 Markdown，版本属于 Git，索引属于构建系统，展示属于 React，视觉属于 Theme Engine。**

------

## 60. 最终推荐的项目定位

综合你的要求，这个项目最合适的形态其实不是：

> “一个 Markdown 编辑器”

也不是：

> “一个博客系统”。

而应该定义为：

> **一个 Git + Markdown 驱动的、以 QA 知识卡片为核心的个人知识库阅读与展示系统。**

其核心闭环是：

```text
                ┌─────────────┐
                │ Markdown    │
                │ + YAML      │
                └──────┬──────┘
                       │
                       ▼
                ┌─────────────┐
                │ Knowledge   │
                │ Parser      │
                └──────┬──────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
       Search        Theme       Metadata
          │            │            │
          └────────────┼────────────┘
                       ▼
                ┌─────────────┐
                │ QA Card     │
                └──────┬──────┘
                       │
             ┌─────────┼─────────┐
             ▼         ▼         ▼
           阅读       复习       导出
             │         │         │
             └─────────┼─────────┘
                       ▼
                ┌─────────────┐
                │ PWA / Web   │
                │ Android     │
                └─────────────┘
```

**最关键的决定是数据格式，而不是 React 组件。** 一旦采用 `Markdown + YAML Front Matter + assets + build-time index`，后面的 React、PWA、GitHub Pages、Android、搜索、主题、导出基本都可以在这个基础上独立演进，而且知识内容不会被某个 UI 或数据库绑死。