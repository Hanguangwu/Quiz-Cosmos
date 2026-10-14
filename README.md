# 知库 · Knowledge Cards

> 以 Markdown 书写，用卡片的方式阅读与复习的个人知识库

数据属于 Cloudflare D1，展示属于 React，视觉属于主题引擎。

一个公开阅读、密码编辑的个人知识库：卡片、标签、复习记录存储在 Cloudflare D1
数据库中，通过 Pages Functions API 读写；浏览器端完成搜索、QA 卡片翻面、FSRS
间隔复习、主题切换与图片导出。

设计约定见 [AGENTS.md](./AGENTS.md)，部署步骤见 [DEPLOY.md](./DEPLOY.md)。

---

## 快速开始

```bash
pnpm install

pnpm dev            # Vite 开发服务器（UI 开发）
pnpm build          # 类型检查 → 构建（tsc -b && vite build）
pnpm preview        # 预览生产构建
pnpm typecheck      # tsc -b
pnpm icons          # 由应用标记生成 PWA 图标（public/favicon.svg）
pnpm cards:sql      # 卡片 Markdown → D1 SQL（配合 md-to-cards skill）
```

> 卡片数据来自 Cloudflare D1 API（`/api/cards`）。本地跑通完整链路：
> `pnpm build` 后 `pnpm pages:dev`（需要已配置 D1/KV 绑定
> 与 `APP_SECRET_KEY`）。只做 UI 开发时直接 `pnpm dev` 即可，页面会提示
> 「卡片加载失败」，这是预期行为。

## 数据模型

数据存储在 Cloudflare D1，由 `functions/api/[[proxy]].js` 提供 REST API：

- **卡片**：`id` / `type` / `title` / `question`（正面）/ `answer`（背面）/
  `category` / `subcategory` / `difficulty` / `status` / `theme` /
  `tags` / `aliases` / `related` / `sort_order`
- **标签**：多对多（`tags` + `card_tags`），用于聚类与筛选
- **复习**：`known` / `unknown` 计数按卡片与用户聚合（`card_reviews`）
- **调度**：每张卡一份 FSRS 状态（`card_schedule`），`review_log` 记每次评分

表结构见 `migrations/0001_init.sql` 与 `migrations/0002_fsrs.sql`。
读取公开；新增、修改、删除与复习记录需要登录（`APP_SECRET_KEY` 编辑密码）。

## 间隔复习（FSRS）

学过的都记住。四档评分 **忘了 / 模糊 / 记得 / 太简单** 驱动 FSRS-6 调度，
每张卡的到期时间由服务端用 `ts-fsrs` 计算，到期才进入复习队列。

- **复习页** `/review` —— 到期卡优先，其后补新卡；空格翻面，`1`–`4` 评分，
  每个按钮下显示评分后的实际间隔（学习步长是分钟，成长后是天/月/年）
- **成长看板** `/dashboard` —— 全年学习热力图、连击、记忆留存率、
  未来 30 天到期预测、卡片掌握度分布，以及「今天还有 N 张到期」的提醒
- **闪卡管理器** `/manage` —— 搜索、按分类与掌握度筛选、排序、行内编辑、
  批量软删除
- **学习宠物** 🐣 —— 形态由复习统计纯派生（蛋 → 幼鸟 → 成鸟），零额外存储

复习统计属于个人进度，需要登录；浏览与阅读保持零门槛。

## 新增一张卡片

1. 点击右上角「登录」，输入编辑密码
2. 打开编辑器，左侧写 Markdown（Front Matter + 正反面），右侧实时预览
3. 点击「保存」——立即写入 D1 并对所有访问者生效；「下载 .md」可用于备份

草稿只存在浏览器 IndexedDB（防止刷新丢失），正式数据始终在 D1。

## 目录结构

```text
functions/api/      Cloudflare Pages Function（REST API + 密码鉴权 + FSRS 调度）
migrations/         D1 schema SQL（唯一表结构出处，勿删）
scripts/            generate-icons.ts（PWA 图标）、cards-to-sql.ts（卡片 → SQL）
src/
├── features/       cards / markdown / themes / editor / search / export
│                   / review（音效）/ pet（学习宠物）
├── lib/            api、auth、content、search、export、drafts、duration
├── shell/          应用外壳与阅读偏好
├── ui/             shadcn 风格基础组件
├── pages/          路由页面
├── styles/         tokens.css（设计变量 + 卡片样式）
└── types/          数据契约
```

## 关键设计

- **数据与展示分离**：D1 是唯一数据源，React 只负责渲染
- **读取公开、写入密码**：浏览零门槛，编辑需登录
- **主题即数据**：新增主题只改 `src/features/themes/registry.ts`，
  不触碰卡片组件（10 套主题覆盖极简 / 艺术 / 科技 / 中国传统 / 自然）
- **单一 Renderer**：所有 Markdown 渲染都走同一个组件，主题通过
  `--card-*` CSS 变量影响外观
- **纯前端搜索**：Fuse.js 在浏览器内检索内存索引，不上传任何查询
- **内容不被裁切**：代码块、表格、公式、图片等在卡片中完整可达，
  超出宽度的元素横向滚动，而不是被截断
- **长文本连续阅读**：卡片高度由内容决定，不做自动分页
- **调度在服务端**：`ts-fsrs` 只被 Pages Function 引入，前端不本地算间隔，
  保证任何设备打开同一张卡看到的到期时间一致
- **统计不落冗余列**：热力图、连击、记忆留存全部由 `review_log` 现算
- **宠物零存储**：形态是复习统计的纯函数，不为此新建表
- **PWA**：预缓存应用外壳，离线时也能打开界面（实时卡片数据需要网络）

## 部署

应用部署在 **Cloudflare Pages**（Pages Functions + D1 + KV），从域名根路径 `/` 提供服务。
推送到 `main` 后由 Cloudflare Pages 构建（`pnpm run build`，输出 `dist`）。
完整的首次部署步骤见 [`DEPLOY.md`](./DEPLOY.md)。

> 如需再次部署到子路径，设置环境变量 `VITE_BASE_PATH=/<sub-path>/` 即可
> （见 `vite.config.ts` 的 `base`）。

上线后需要按顺序应用两个迁移（只增表，不影响既有数据）：

```bash
pnpm wrangler d1 execute quiz-cosmos-db --remote --file=./migrations/0001_init.sql
pnpm wrangler d1 execute quiz-cosmos-db --remote --file=./migrations/0002_fsrs.sql
```