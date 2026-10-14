# AGENTS.md

   ## 项目名称

   Knowledge Cards —— 云端数据库驱动的个人知识卡片库。

   本项目是一个「公开阅读、密码编辑」的个人知识管理与展示系统：
   前端 React 部署在 Cloudflare Pages，数据存储在 Cloudflare D1，
   读写由 Pages Functions API 提供。

   核心思想：

   > 数据属于 D1，展示属于 React，视觉属于主题引擎。读取公开，写入需要密码。

   ------

   ## 一、核心目标

   项目需要实现：

   - QA 类型知识卡片
   - Markdown 实时预览
   - KaTeX 数学公式
   - GFM
   - 代码高亮
   - 搜索（纯前端）
   - 标签筛选
   - 分类浏览
   - 卡片正反面展示
   - 多主题系统
   - 长文本连续阅读
   - PNG/JPG/WebP/SVG 导出
   - 响应式设计
   - PWA
   - Android / Capacitor 兼容（PWA 优先，不单独重写 UI）
   - Cloudflare Pages 部署（Functions + D1 + KV）
   - 密码保护的增删改（网页端编辑器）
   - 间隔复习系统（FSRS）：翻卡复习、成长看板、闪卡管理器、学习宠物

   ------

   ## 二、核心架构原则

   必须遵守：

   ```text
   D1 → Functions API → React → ( Search | Theme | Card ) → Export
   ```

   读取公开；新增、修改、删除与复习记录需要登录。写入只允许通过
   API（Bearer 会话 token），前端永不直连 D1。

   默认情况下：

   - 不引入 D1 / KV / Pages 之外的云服务
   - 不依赖第三方内容 API
   - 不引入 AI API
   - 不做实时同步 / WebSocket
   - 不把 IndexedDB 当作正式数据源

   ------

   ## 三、数据源原则

   正式知识数据保存在 Cloudflare D1：

   ```text
   cards / tags / card_tags / card_reviews / card_schedule / review_log
   ```

   D1 是唯一正式数据源。卡片的 question / answer 以 Markdown 存储，
   编辑器仍以 Markdown + Front Matter 编辑，但保存目标只有 D1。

   IndexedDB 只能用于：

   - 编辑草稿
   - 临时状态
   - 本地缓存

   不得把 IndexedDB 数据作为唯一正式数据。

   ------

   ## 四、数据规范

   每张卡（cards 表）必须具有：

   ```text
   id          唯一业务 ID（TEXT）
   type        qa
   title       标题
   category    分类
   tags        标签（多对多，tags + card_tags）
   status      published 等
   question    正面 Markdown
   answer      背面 Markdown
   ```

   可选字段：

   ```text
   subcategory
   difficulty
   theme
   aliases
   related
   sort_order
   ```

   数据库结构以 `migrations/` 下的 SQL 为唯一出处。表结构变更必须新增
   迁移文件，并评估 front matter 的 schemaVersion 是否要升级（当前 v1，
   只有卡片 front matter 变更才需要升级；纯新增表不需要，见 §31）。

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

   禁止重复 ID。写入 API 必须校验 ID 唯一性。

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

   ```text
   status: published
   ```

   的内容默认进入公开浏览（首页、分类、标签、搜索）。

   ------

   ## 七、目录结构

   ```text
   functions/api/     Pages Function（REST API + 密码鉴权）
   migrations/        D1 schema SQL（唯一表结构出处，勿删）
   scripts/           generate-icons.ts / cards-to-sql.ts（PWA 图标 / 卡片转 SQL）
   public/            图标、favicon
   src/
   ├── features/      cards / markdown / themes / editor / search / export
   │                  / review（音效）/ pet（学习宠物）
   ├── lib/           api / auth / content / search / export / drafts / duration
   ├── pages/         路由页面
   ├── shell/         应用外壳与阅读偏好
   ├── ui/            shadcn 风格基础组件
   ├── styles/        tokens.css（设计变量 + 卡片样式）
   └── types/         数据契约
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
   - Fuse.js
   - html2canvas

   云端：

   - Cloudflare Pages（Pages Functions）
   - Cloudflare D1
   - Cloudflare KV
   - wrangler CLI

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

   复习记录（card_reviews 的 known / unknown 计数）与卡片本身分离存储，
   按 (card_id, user_key) 聚合，只作为阅读侧的个人进度。

   复习评分已升级为四档 FSRS（again / hard / good / easy），到期时间由
   服务端调度；known / unknown 作为兼容视图继续回写（见 §31）。

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

   持久化约定：

   - 草稿存 IndexedDB，刷新不丢失
   - 「保存」调用 API 写入 D1，需要登录（编辑密码）
   - 「下载 .md」只是备份便利，不是发布路径——正式数据始终在 D1

   ------

   ## 十四、长文本阅读

   卡片不自动分页。

   长内容采用连续滚动阅读：卡片高度由内容决定，页面自然滚动。

   不得对承载 Markdown 的容器设置 max-height + overflow: hidden。

   以下元素不得被裁切，必须完整可达：

   - Code Block
   - Table
   - Heading
   - Image
   - Math Block
   - Quote
   - List

   超出卡片宽度的元素（宽公式、宽表格、长代码块）应横向滚动，而不是被裁掉或缩放到无法阅读。

   ------

   ## 十五、搜索

   搜索数据来自加载到内存的知识索引，由 `GET /api/cards` 一次性构建
   （`src/lib/content.ts` 适配为 KnowledgeIndex 形状）。

   搜索至少支持：

   - title
   - tags
   - category
   - aliases
   - content（question + answer）
   - id

   搜索实现保持纯前端（Fuse.js）：不上传任何查询，不请求服务器搜索。

   ------

   ## 十六、API 契约

   后端由 `functions/api/[[proxy]].js` 单文件实现方法级路由：

   ```text
   GET    /api/cards               公开：已发布卡片 + 聚合
   GET    /api/cards/:id           公开
   GET    /api/tags                公开
   GET    /api/categories          公开
   POST   /api/login               密码 → 会话 token
   POST   /api/logout              注销
   POST   /api/cards               需要登录
   POST   /api/cards/bulk          需要登录：批量删除（软删除）
   PUT    /api/cards/:id           需要登录（整卡替换）
   DELETE /api/cards/:id           需要登录（软删除 deleted_at）
   POST   /api/cards/:id/review    需要登录（FSRS 评分）
   GET    /api/reviews             需要登录
   GET    /api/review/session      需要登录：复习队列（到期 + 新卡）
   GET    /api/review/manage       需要登录：闪卡管理器全量卡片
   GET    /api/review/stats        需要登录：成长看板统计
   ```

   约定：

   - 读取公开，写入鉴权；未授权返回 401，前端引导登录
   - 密码校验使用恒定时间比较，任何接口不得返回明文密码
   - 删除一律软删除，公开接口过滤 `deleted_at IS NOT NULL`
   - 写卡时按名称 upsert tags 并重建 card_tags（标签同步）
   - 卡片 JSON：`{ id, type, title, question, answer, category, subcategory,
     difficulty, status, theme, tags[], aliases[], related[], sort_order,
     created_at, updated_at }`

   ------

   ## 三十一、间隔复习系统（FSRS）

   复习记录从「记得 / 忘了」升级为 FSRS 调度：每张卡独立维护到期时间与
   记忆参数，到期才出现在复习队列里。目标：学过的都记住。

   约定：

   - **调度只在服务端算**。`ts-fsrs` 只被 Pages Function import，前端永远
     不本地计算间隔 —— 避免多设备算出不同结果，也避免前端包膨胀。
   - **评分四档**：`again` / `hard` / `good` / `easy`。旧的 `verdict:
     known | unknown` 仍然接受，分别映射为 `good` / `again`，并继续回写
     `card_reviews` 的计数（向后兼容）。
   - **单表职责**：`card_schedule` 存每张卡的调度状态（含 user_key），
     `review_log` 只存事件。看板的所有聚合值（热力图、连击、留存率）
     都由 `review_log` 现算，不落冗余统计列。
   - **user_key 恒为 `default_user`**。项目无用户体系（§19），所以云端
     进度是跨设备共享的一份；这是「读取公开、写入需要密码」的必然结果，
     不是 bug。要真正的多用户进度，先解决 §19 的用户体系。
   - **学习宠物零存储**：形态由复习统计纯派生（`src/features/pet/pet.ts`），
     不建 pet 表。任何排行榜 / 成长值都不要为此引入新表。
   - 只有 `status: published` 且有答案的卡片才进复习队列（§6 / §16）。
   - `ts-fsrs` 参数保持默认（FSRS-6 权重、保持度 0.9、关闭 fuzz），保证
     同一输入同一输出，重放和测试才稳定。

   ------

   ## 十七、部署

   部署目标是 Cloudflare Pages（Functions + D1 + KV），从域名根路径 `/` 提供服务。

   ```text
   git push
    ↓
   Cloudflare Pages 构建（tsc -b && vite build）
    ↓
   部署（静态资源 + Functions）
   ```

   - `dist/` 由 Pages 托管，`/api/*` 由 Functions 处理
   - 不要添加顶层 `404.html`——SPA 回退交给 Pages 自动处理
   - D1 / KV 绑定在 Pages 项目配置中进行（wrangler.jsonc 仅用于本地开发）
   - `APP_SECRET_KEY` 通过 `wrangler pages secret put` 配置
   - 首次部署完整步骤见 `DEPLOY.md`

   ------

   ## 十八、PWA

   PWA 必须支持：

   - manifest
   - service worker
   - offline shell
   - standalone mode
   - app icon
   - responsive UI

   离线只需保证应用外壳可用；实时卡片数据依赖网络。不要把 API 响应
   当作离线缓存，也不要假设用户始终在线。

   Android 目标采用：

   ```text
   React + PWA + Capacitor
   ```

   不要为了 Android 单独重写 UI。

   ------

   ## 十九、权限与会话

   - 单一共享编辑密码（`APP_SECRET_KEY`），不做用户体系
   - 登录：`POST /api/login` 校验密码后签发随机 token，写入 KV
     （`QUIZ_SESSIONS`，TTL 7 天）
   - 前端保存 token，写入请求携带 `Authorization: Bearer <token>`
   - 注销即删除 KV 会话，前端同时清除本地 token
   - token 与密码不得写入任何日志；不依赖 Cookie

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

   保持知识内容可迁移：

   - D1 是运行时唯一来源，但内容格式是 Markdown（question / answer 列）
   - 编辑器「下载 .md」与导出功能是退出路径，不允许被移除
   - 不得把核心知识内容锁定在二进制格式或专有云服务

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

   第一版本禁止为了"未来可能需要"而提前加入：

   - 用户系统（共享密码已足够）
   - 权限系统
   - 除 D1 / KV / Pages 之外的新存储
   - 多用户协作
   - 实时同步
   - WebSocket
   - AI API
   - 额外的后端服务

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
   4. 如果必须改变数据格式，应升级 schemaVersion 并新增 migration
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

   1. 登录（编辑密码）
   2. 打开编辑器，填写 Front Matter（唯一 ID、分类、标签、状态）与正反面
   3. 点击「保存」写入 D1（必须走 API，不直连数据库）
   4. 验证公开侧可见：列表、分类、标签、搜索均正常

   每张卡必须有唯一 ID，禁止重复；只有 `status: published` 进入公开索引。

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
   - 登录与编辑器可使用

   ------

   ## 三十、最终架构原则

   整个项目始终保持：

   ```text
   Cloudflare Pages
    │
    ├── Functions（REST API + 密码鉴权 + FSRS 调度）
    │     ├── D1   （卡片 / 标签 / 复习 / 调度 / 流水 —— 唯一数据源）
    │     └── KV   （会话 token）
    │
    └── React
          ├── Search   Theme   Card   Review
          │                              │
          │              Dashboard · Manager · Pet · Web · PWA · Export
   ```

   核心原则：

   > 数据属于 D1，展示属于 React，部署属于 Cloudflare Pages。
   > 读取公开，写入需要密码；内容以 Markdown 格式保存，永远可迁移。