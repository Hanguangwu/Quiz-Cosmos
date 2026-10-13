# 部署指南 · Cloudflare Pages + Functions + D1 + KV

本项目已从「GitHub Pages 纯静态」迁移到 **Cloudflare Pages**：

| 组成 | 作用 |
| --- | --- |
| Pages 静态资源 | 构建产物 `dist/`（React + Vite） |
| Pages Functions | `functions/api/[[proxy]].js` —— REST API + 密码鉴权 |
| D1 | 唯一正式数据源（卡片、标签、复习记录） |
| KV | 登录会话 token（7 天 TTL） |
| Secret | `APP_SECRET_KEY` —— 编辑密码 |

> 数据属于 D1，展示属于 React，部署属于 Cloudflare Pages。
> 一旦完成首次部署，日常增删改卡片直接在网页端进行，不再依赖 Markdown 构建。

---

## 0. 前置条件

- Cloudflare 账号。
- 仓库已推送到 GitHub（推荐用 Git 集成流程）。
- `wrangler` **不是**项目依赖，用一次性命令调用：`npx wrangler@latest …`（或 `pnpm dlx wrangler …`）。
- Node 22 + pnpm 10。

---

## 1. 登录 Wrangler

```powershell
npx wrangler@latest login
```

---

## 2. 创建 D1 数据库

```powershell
npx wrangler@latest d1 create quiz-cosmos-db
```

把输出的 `database_id` 填入 `wrangler.jsonc`，替换 `REPLACE_WITH_D1_ID`。

---

## 3. 创建 KV 命名空间（会话）

```powershell
npx wrangler@latest kv namespace create QUIZ_SESSIONS
```

把输出的 `id` 填入 `wrangler.jsonc`，替换 `REPLACE_WITH_KV_ID`。

本地预览可选：`npx wrangler@latest kv namespace create QUIZ_SESSIONS --preview`，再把 `preview_id` 加进 `wrangler.jsonc`。

---

## 4. 把表结构写入远程 D1

```powershell
npx wrangler@latest d1 execute quiz-cosmos-db --remote --file=./migrations/0001_init.sql
```

校验（首次执行后）：

```powershell
npx wrangler@latest d1 execute quiz-cosmos-db --remote --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
# 预期：card_reviews / card_tags / cards / tags
```

> 本步只需在**全新**数据库上执行一次（所有语句都带 `IF NOT EXISTS`，重复执行无害）。
> 后续 schema 变更请新增 `migrations/0002_xxx.sql` 再应用。
> 首次部署完成后，日常内容直接走网页端写库，无需再跑种子数据。

---

## 5. 创建 Pages 项目

```powershell
npx wrangler@latest pages project create quiz-cosmos --production-branch main
```

> 若改用控制台 Git 导入流程创建项目，则跳过本步，直接进入第 6 步。

---

## 6. 设置访问密码（Secret）

Pages 项目必须先存在。

```powershell
npx wrangler@latest pages secret put APP_SECRET_KEY --project-name quiz-cosmos
# 提示时粘贴密码
```

需要预览环境也启用鉴权时，加 `--env preview`。

---

## 7. 部署（二选一）

### A. 直接上传（最快完成首次部署）

```powershell
pnpm run build
npx wrangler@latest pages deploy dist --project-name quiz-cosmos
```

`wrangler.jsonc` 会自动提供 `DB` / `QUIZ_SESSIONS` 绑定。

### B. Git 集成（推荐，推送即部署）

在控制台连接仓库并设置：

- 构建命令：`pnpm run build`
- 输出目录：`dist`
- 环境：Node 22 + pnpm（仓库含 `pnpm-lock.yaml`，会自动识别）
- **绑定**（项目 → Settings → Functions → Bindings）：
  - D1 变量 `DB` → `quiz-cosmos-db`
  - KV 命名空间 `QUIZ_SESSIONS`
- `APP_SECRET_KEY` 放在 Settings → Environment variables（勾选加密）。

> Git 构建**不会**读取 `wrangler.jsonc` 里的绑定，必须在控制台手动配置；
> 直接上传（`wrangler pages deploy`）才会自动读取。

---

## 8. 路由与 base path（重要）

- 站点从**根路径 `/`** 提供服务。`vite.config.ts` 的 `base` 默认 `'/'`；如需子路径，设置 `VITE_BASE_PATH=/<sub-path>/`。
- `src/lib/site.ts` 的 `SITE.base` 读取 `import.meta.env.BASE_URL`，因此与实际部署路径自动保持一致。
- **不要**在项目根添加 `404.html`：Pages 只有在找不到顶层 `404.html` 时才对 SPA 生效
  （任意未命中静态资源的路径都回退到 `/`）。一旦存在 `404.html`，`/login`、`/editor` 直接刷新会 404。
- 无需 `_redirects`。`/api/*` 由 Functions 优先匹配，与静态资源共存。
- 检测到 `functions/` 目录时，Pages 会自动生成 `_routes.json`。

---

## 9. 验证

```powershell
curl https://quiz-cosmos.pages.dev/api/cards
# 预期：包含 9 张卡片的 JSON
```

然后打开站点 → 登录 → 尝试新增/删除卡片。

---

## 10. 后续内容更新

- 日常：直接使用网页端编辑器写库（D1 是唯一数据源，读取公开、写入需密码）。
- Schema 变更：新增 `migrations/000X_xxx.sql`，再
  `npx wrangler@latest d1 execute quiz-cosmos-db --remote --file=...` 应用。

---

## 排障

### 资源被拦截，MIME 类型为 `text/html`

```
已拦截加载自"…/Quiz-Cosmos/assets/index-*.js"的模块，它使用了不允许的 MIME 类型（"text/html"）
```

说明构建产物引用的资源路径与实际部署路径不一致（例如 base 仍是 GitHub Pages 子路径
`/Quiz-Cosmos/`，而 Pages 从 `/` 提供服务）。资源 404 后被 SPA 回退当作 `index.html` 返回，
于是 MIME 为 `text/html`。修复：

1. 确认 `vite.config.ts` 的 `base` 为 `'/'`（或正确的 `VITE_BASE_PATH`）。
2. 重新 `pnpm run build` 并重新部署。

### `APP_SECRET_KEY` 未设置

登录接口会始终返回失败。检查 Secret 是否在当前环境（production / preview）下配置。

### 旧 Service Worker 缓存了旧路径

PWA 已把 `navigateFallback` 与 `scope` 改为跟随 `base`。若浏览器仍缓存旧的
`/Quiz-Cosmos/` 作用域 SW，在 DevTools → Application → Service Workers 中注销后刷新。
