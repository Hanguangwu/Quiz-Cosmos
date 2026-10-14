/**
 * Quiz-Cosmos API —— Cloudflare Pages Function。
 *
 * 一个文件承担整个后端：方法级路由 + KV 会话鉴权 + D1 持久化。
 * 单文件实现方法级路由 + KV 会话鉴权 + D1 持久化，便于维护。
 *
 * 绑定（在 Cloudflare Pages 配置，或用 wrangler.jsonc）：
 *   DB             D1 数据库实例
 *   QUIZ_SESSIONS  KV namespace，存放登录会话 token
 *   APP_SECRET_KEY Secret，访问密码（控制台 / `wrangler pages secret put`）
 *
 * 产品约定：读取公开，写入需要密码。
 */

/* -------------------------------------------------------------------------- */
/* 间隔复习调度器（AGENTS.md 新增：间隔复习系统）                                */
/* -------------------------------------------------------------------------- */

/**
 * FSRS 调度器。ts-fsrs 是纯 ESM/无 Node 依赖库，因此在 workerd 里可用。
 * module scope 单例：`FSRS` 实例本身无状态（每次调用都传入 card），可安全复用。
 * 默认参数（FSRS-6）：保持度 0.9、封顶 100 年、关闭 fuzz（保证同输入同输出，
 * 便于测试与重放）。
 */
import { createEmptyCard, fsrs, Rating } from 'ts-fsrs'

const REVIEW_USER = 'default_user' // 单一共享密码 → 无用户体系，user_key 恒定
const SCHEDULE_LIMIT = 1000 // 单次复习会话/管理列表的条数上限

const scheduler = fsrs({ request_retention: 0.9, maximum_interval: 36500, enable_fuzz: false })

/** 客户端可用值 → Rating 枚举值。 */
const RATING_BY_KEY = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
}
const RATING_KEY_BY_VALUE = { 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' }

/* -------------------------------------------------------------------------- */
/* 路由                                                                        */
/* -------------------------------------------------------------------------- */

const Router = () => {
  const routes = []
  const add = (method, path, handler) => routes.push({ method, path, handler })
  const handler = async (request, env, ctx) => {
    const url = new URL(request.url)
    for (const route of routes) {
      if (request.method !== route.method) continue
      const pattern = new RegExp(`^${route.path.replace(/:\w+/g, '([^/]+)')}$`)
      const match = url.pathname.match(pattern)
      if (!match) continue
      const params = {}
      const keys = (route.path.match(/:\w+/g) || []).map((key) => key.substring(1))
      keys.forEach((key, i) => {
        params[key] = decodeURIComponent(match[i + 1])
      })
      return await route.handler({ request, env, ctx, params })
    }
    return new Response('Not Found', { status: 404 })
  }
  return {
    get: (path, handler) => add('GET', path, handler),
    post: (path, handler) => add('POST', path, handler),
    put: (path, handler) => add('PUT', path, handler),
    delete: (path, handler) => add('DELETE', path, handler),
    handler,
  }
}

const router = Router()

/* -------------------------------------------------------------------------- */
/* 常量与工具                                                                  */
/* -------------------------------------------------------------------------- */

const STATUSES = ['draft', 'review', 'published', 'archived']
const DIFFICULTIES = ['easy', 'medium', 'hard']
const TAG_SEP = String.fromCharCode(31) // group_concat 分隔符，避开标签内的逗号

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function nowIso() {
  return new Date().toISOString()
}

/** 常量时间字符串比较，避免密码校验的计时侧信道。 */
async function secureEqual(input, expected) {
  const enc = new TextEncoder()
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(String(input ?? ''))),
    crypto.subtle.digest('SHA-256', enc.encode(String(expected ?? ''))),
  ])
  const av = new Uint8Array(a)
  const bv = new Uint8Array(b)
  let diff = 0
  for (let i = 0; i < av.length; i += 1) diff |= av[i] ^ bv[i]
  return diff === 0
}

/* -------------------------------------------------------------------------- */
/* 鉴权                                                                        */
/* -------------------------------------------------------------------------- */

async function authenticate(request, env) {
  const header = request.headers.get('Authorization')
  if (!header || !header.startsWith('Bearer ')) return null
  const token = header.slice(7)
  if (!token) return null
  return (await env.QUIZ_SESSIONS.get(token)) || null
}

/** 返回 `{ userKey }`；未通过时 `{ error: <401 Response> }`。 */
async function authGuard(request, env) {
  const userKey = await authenticate(request, env)
  if (!userKey) return { userKey: null, error: jsonResponse({ error: '未登录或会话已失效' }, 401) }
  return { userKey, error: null }
}

/* -------------------------------------------------------------------------- */
/* 卡片序列化 / 反序列化                                                        */
/* -------------------------------------------------------------------------- */

function parseJsonArray(value) {
  if (Array.isArray(value)) return value.filter((item) => typeof item === 'string')
  if (typeof value !== 'string' || value.trim() === '') return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : []
  } catch {
    return []
  }
}

/** Markdown -> 纯文本，供 LIKE 搜索（与前端 stripMarkdown 的意图一致，够用即可）。 */
function stripToText(markdown) {
  if (typeof markdown !== 'string') return ''
  let text = markdown
  text = text.replace(/<!--[\s\S]*?-->/g, ' ')
  text = text.replace(/```[\s\S]*?```/g, (block) => block.replace(/```[^\n]*\n?/g, ' '))
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, ' $1 ')
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, ' $1 ')
  text = text.replace(/<\/?[A-Za-z][^>]*>/g, ' ')
  text = text.replace(/[#>*_`~|]/g, ' ')
  return text.replace(/\s+/g, ' ').trim()
}

function rowToCard(row, tags) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    question: row.question,
    answer: row.answer,
    category: row.category,
    subcategory: row.subcategory ?? null,
    difficulty: row.difficulty ?? null,
    status: row.status,
    theme: row.theme ?? null,
    tags: tags ?? [],
    aliases: parseJsonArray(row.aliases),
    related: parseJsonArray(row.related),
    sort_order: row.sort_order ?? 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function splitTagNames(raw) {
  if (typeof raw !== 'string' || raw === '') return []
  return raw.split(TAG_SEP).filter((name) => name !== '')
}

async function fetchCard(env, id) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM cards WHERE id = ? AND deleted_at IS NULL',
  )
    .bind(id)
    .all()
  if (!results || results.length === 0) return null
  const { results: tagRows } = await env.DB.prepare(
    'SELECT t.name FROM tags t JOIN card_tags ct ON ct.tag_id = t.id WHERE ct.card_id = ? ORDER BY t.name',
  )
    .bind(id)
    .all()
  return rowToCard(results[0], (tagRows || []).map((row) => row.name))
}

/** 用给定标签集替换某张卡的标签（先删后插），并 upsert 标签注册表。 */
async function syncTags(env, cardId, tagNames) {
  const names = [...new Set((tagNames || []).map((name) => String(name).trim()).filter(Boolean))]
  await env.DB.prepare('DELETE FROM card_tags WHERE card_id = ?').bind(cardId).run()
  const ts = nowIso()
  for (const name of names) {
    await env.DB.prepare(
      'INSERT INTO tags (name, slug, created_at) VALUES (?, ?, ?) ON CONFLICT(name) DO NOTHING',
    )
      .bind(name, name, ts)
      .run()
    await env.DB.prepare(
      'INSERT OR IGNORE INTO card_tags (card_id, tag_id) SELECT ?, id FROM tags WHERE name = ?',
    )
      .bind(cardId, name)
      .run()
  }
}

function normalizeTagList(value) {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item).trim()).filter(Boolean)
}

/* -------------------------------------------------------------------------- */
/* FSRS 状态序列化                                                             */
/* -------------------------------------------------------------------------- */

/**
 * ts-fsrs `Card` → 可存进 TEXT/REAL 列的平面对象。
 * 只保留调度所需的字段，`Date` 一律转 ISO 字符串。
 */
function serializeSchedule(card) {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days ?? 0,
    scheduled_days: card.scheduled_days ?? 0,
    learning_steps: card.learning_steps ?? 0,
    reps: card.reps ?? 0,
    lapses: card.lapses ?? 0,
    state: card.state,
    last_review: card.last_review ? card.last_review.toISOString() : null,
  }
}

/** 卡片的四档下一次间隔（秒），供 UI 显示「5天后 / 10分钟后」的预览。 */
function previewIntervals(schedule, now) {
  const preview = scheduler.repeat(schedule ?? createEmptyCard(now), now)
  const out = { again: 0, hard: 0, good: 0, easy: 0 }
  for (const [key, rating] of Object.entries(RATING_BY_KEY)) {
    const due = preview[rating]?.card?.due
    out[key] = due ? Math.max(0, Math.round((due.getTime() - now.getTime()) / 1000)) : 0
  }
  return out
}

/** 读取 (card_id, user_key) 的调度状态；没有则返回 null（= 新卡）。 */
async function loadSchedule(env, cardId, userKey = REVIEW_USER) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM card_schedule WHERE card_id = ? AND user_key = ?',
  )
    .bind(cardId, userKey)
    .all()
  if (!results || results.length === 0) return null
  return scheduleFromRow(results[0])
}

/** 行 → ts-fsrs `Card`。Date 字段解析失败会被 `new Date` 变成 Invalid Date，故先兜底。 */
function scheduleFromRow(row) {
  const due = new Date(row.due)
  if (Number.isNaN(due.getTime())) return createEmptyCard()
  return {
    due,
    stability: Number(row.stability) || 0,
    difficulty: Number(row.difficulty) || 0,
    elapsed_days: Number(row.elapsed_days) || 0,
    scheduled_days: Number(row.scheduled_days) || 0,
    learning_steps: Number(row.learning_steps) || 0,
    reps: Number(row.reps) || 0,
    lapses: Number(row.lapses) || 0,
    state: Number(row.state) || 0,
    last_review: row.last_review ? new Date(row.last_review) : undefined,
  }
}

/** 把卡片连同调度状态写成 API 卡片形状。 */
function cardWithSchedule(card, schedule, now) {
  return {
    ...card,
    schedule: schedule ? serializeSchedule(schedule) : null,
    due: schedule ? schedule.due.toISOString() : null,
    overdue: schedule ? schedule.due.getTime() <= now.getTime() : true,
    // 新卡也给出四档预览（createEmptyCard），评分按钮下的间隔才有东西可显示。
    intervals: previewIntervals(schedule, now),
  }
}

/** 请求体里的评分：`{rating}` 优先，兼容旧的 `{verdict}`。 */
function resolveRating(body) {
  if (typeof body.rating === 'string' && body.rating in RATING_BY_KEY) {
    return RATING_BY_KEY[body.rating]
  }
  // 兼容 v1 的 known / unknown：记得 = good，忘了 = again。
  if (body.verdict === 'known') return Rating.Good
  if (body.verdict === 'unknown') return Rating.Again
  return null
}

/** 复习成功后同步 v1 的 known / unknown 计数（good/easy → known）。 */
async function syncReviewCounts(env, cardId, rating, userKey = REVIEW_USER) {
  const knownInc = rating === Rating.Good || rating === Rating.Easy ? 1 : 0
  const unknownInc = knownInc === 1 ? 0 : 1
  if (knownInc === 0 && unknownInc === 0) return
  await env.DB.prepare(
    `INSERT INTO card_reviews (card_id, user_key, known_count, unknown_count, last_verdict, last_reviewed_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(card_id, user_key) DO UPDATE SET
       known_count = known_count + excluded.known_count,
       unknown_count = unknown_count + excluded.unknown_count,
       last_verdict = excluded.last_verdict,
       last_reviewed_at = excluded.last_reviewed_at`,
  )
    .bind(cardId, userKey, knownInc, unknownInc, knownInc ? 'known' : 'unknown', nowIso())
    .run()
}

/** 让 `card_schedule` 成为用户视角下的单例：没有就新建，有就 upsert。 */
async function saveSchedule(env, cardId, schedule, userKey = REVIEW_USER) {
  await env.DB.prepare(
    `INSERT INTO card_schedule
       (card_id, user_key, due, stability, difficulty, elapsed_days, scheduled_days,
        learning_steps, reps, lapses, state, last_review, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(card_id, user_key) DO UPDATE SET
       due = excluded.due, stability = excluded.stability, difficulty = excluded.difficulty,
       elapsed_days = excluded.elapsed_days, scheduled_days = excluded.scheduled_days,
       learning_steps = excluded.learning_steps, reps = excluded.reps, lapses = excluded.lapses,
       state = excluded.state, last_review = excluded.last_review, updated_at = excluded.updated_at`,
  )
    .bind(
      cardId,
      userKey,
      schedule.due.toISOString(),
      schedule.stability,
      schedule.difficulty,
      schedule.elapsed_days ?? 0,
      schedule.scheduled_days ?? 0,
      schedule.learning_steps ?? 0,
      schedule.reps ?? 0,
      schedule.lapses ?? 0,
      schedule.state,
      schedule.last_review ? schedule.last_review.toISOString() : null,
      nowIso(),
    )
    .run()
}

/** group_concat 出的标签名 → 原有 string[]；并把整行变成 API 卡片。 */
async function rowToApiCard(row) {
  return rowToCard(row, splitTagNames(row.tag_names))
}

/* -------------------------------------------------------------------------- */
/* 认证路由                                                                     */
/* -------------------------------------------------------------------------- */

router.post('/api/login', async ({ request, env }) => {
  let body = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }
  const { password } = body
  if (!password || !env.APP_SECRET_KEY || !(await secureEqual(password, env.APP_SECRET_KEY))) {
    return jsonResponse({ error: '密码错误' }, 401)
  }
  const token = `kc_${crypto.randomUUID()}`
  await env.QUIZ_SESSIONS.put(token, 'default_user', { expirationTtl: 60 * 60 * 24 * 7 })
  return jsonResponse({ token })
})

router.post('/api/logout', async ({ request, env }) => {
  const header = request.headers.get('Authorization')
  if (header && header.startsWith('Bearer ')) {
    const token = header.slice(7)
    if (token) await env.QUIZ_SESSIONS.delete(token)
  }
  return new Response(null, { status: 204 })
})

/* -------------------------------------------------------------------------- */
/* 卡片 CRUD                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * GET /api/cards
 * 公开。查询参数：query / category / tag / status / difficulty。
 */
router.get('/api/cards', async ({ request, env }) => {
  const url = new URL(request.url)
  const query = (url.searchParams.get('query') || '').trim()
  const category = url.searchParams.get('category')
  const tag = url.searchParams.get('tag')
  const status = url.searchParams.get('status')
  const difficulty = url.searchParams.get('difficulty')

  const where = ['c.deleted_at IS NULL']
  const binds = []

  if (category) {
    where.push('c.category = ?')
    binds.push(category)
  }
  if (status) {
    where.push('c.status = ?')
    binds.push(status)
  }
  if (difficulty) {
    where.push('c.difficulty = ?')
    binds.push(difficulty)
  }
  if (tag) {
    where.push(
      'EXISTS (SELECT 1 FROM card_tags ct2 JOIN tags t2 ON t2.id = ct2.tag_id WHERE ct2.card_id = c.id AND (t2.slug = ? OR t2.name = ?))',
    )
    binds.push(tag, tag)
  }
  if (query) {
    const like = `%${query.toLowerCase()}%`
    where.push('(LOWER(c.search_text) LIKE ? OR LOWER(c.title) LIKE ? OR LOWER(c.id) LIKE ?)')
    binds.push(like, like, like)
  }

  const sql = `SELECT c.*, (
      SELECT group_concat(t.name, char(31))
      FROM card_tags ct JOIN tags t ON t.id = ct.tag_id
      WHERE ct.card_id = c.id
    ) AS tag_names
    FROM cards c
    WHERE ${where.join(' AND ')}
    ORDER BY c.sort_order ASC, c.updated_at DESC
    LIMIT 1000`

  const { results } = await env.DB.prepare(sql).bind(...binds).all()
  const cards = (results || []).map((row) => rowToCard(row, splitTagNames(row.tag_names)))
  return jsonResponse({ total: cards.length, cards })
})

/** GET /api/cards/:id —— 公开。 */
router.get('/api/cards/:id', async ({ env, params }) => {
  const card = await fetchCard(env, params.id)
  if (!card) return jsonResponse({ error: '卡片不存在' }, 404)
  return jsonResponse(card)
})

/** POST /api/cards —— 需要密码。 */
router.post('/api/cards', async ({ request, env }) => {
  const auth = await authGuard(request, env)
  if (auth.error) return auth.error

  let body = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const category = typeof body.category === 'string' ? body.category.trim() : ''
  if (!title) return jsonResponse({ error: '标题不能为空' }, 400)
  if (!category) return jsonResponse({ error: '分类不能为空' }, 400)

  const status = body.status ?? 'published'
  if (!STATUSES.includes(status)) return jsonResponse({ error: '无效的状态值' }, 400)

  const difficulty = body.difficulty ?? null
  if (difficulty !== null && !DIFFICULTIES.includes(difficulty)) {
    return jsonResponse({ error: '无效的难度值' }, 400)
  }

  const id =
    typeof body.id === 'string' && body.id.trim() !== '' ? body.id.trim() : crypto.randomUUID()

  const duplicate = await env.DB.prepare('SELECT id FROM cards WHERE id = ?').bind(id).all()
  if (duplicate.results && duplicate.results.length > 0) {
    return jsonResponse({ error: `id 已存在：${id}` }, 409)
  }

  const question = typeof body.question === 'string' ? body.question : ''
  const answer = typeof body.answer === 'string' ? body.answer : ''
  const subcategory = body.subcategory ? String(body.subcategory) : null
  const theme = body.theme ? String(body.theme) : null
  const aliases = Array.isArray(body.aliases) ? body.aliases.map(String) : []
  const related = Array.isArray(body.related) ? body.related.map(String) : []
  const sortOrder = Number.isFinite(body.sort_order) ? body.sort_order : 0
  const searchText = stripToText(`${title}\n${question}\n${answer}`)
  const ts = nowIso()

  await env.DB.prepare(
    `INSERT INTO cards
      (id, type, title, question, answer, category, subcategory, difficulty, status, theme,
       aliases, related, search_text, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      'qa',
      title,
      question,
      answer,
      category,
      subcategory,
      difficulty,
      status,
      theme,
      JSON.stringify(aliases),
      JSON.stringify(related),
      searchText,
      sortOrder,
      ts,
      ts,
    )
    .run()

  await syncTags(env, id, normalizeTagList(body.tags) || [])

  const card = await fetchCard(env, id)
  return jsonResponse(card, 201)
})

/** PUT /api/cards/:id —— 需要密码。 */
router.put('/api/cards/:id', async ({ request, env, params }) => {
  const auth = await authGuard(request, env)
  if (auth.error) return auth.error

  const existing = await fetchCard(env, params.id)
  if (!existing) return jsonResponse({ error: '卡片不存在' }, 404)

  let body = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const next = {
    title: body.title !== undefined ? String(body.title).trim() : existing.title,
    question: body.question !== undefined ? String(body.question) : existing.question,
    answer: body.answer !== undefined ? String(body.answer) : existing.answer,
    category: body.category !== undefined ? String(body.category).trim() : existing.category,
    subcategory:
      body.subcategory !== undefined
        ? body.subcategory
          ? String(body.subcategory)
          : null
        : existing.subcategory,
    difficulty: body.difficulty !== undefined ? body.difficulty : existing.difficulty,
    status: body.status !== undefined ? body.status : existing.status,
    theme: body.theme !== undefined ? (body.theme ? String(body.theme) : null) : existing.theme,
    aliases:
      body.aliases !== undefined
        ? Array.isArray(body.aliases)
          ? body.aliases.map(String)
          : []
        : existing.aliases,
    related:
      body.related !== undefined
        ? Array.isArray(body.related)
          ? body.related.map(String)
          : []
        : existing.related,
    sort_order:
      body.sort_order !== undefined && Number.isFinite(body.sort_order)
        ? body.sort_order
        : existing.sort_order,
  };

  if (!next.title) return jsonResponse({ error: '标题不能为空' }, 400)
  if (!next.category) return jsonResponse({ error: '分类不能为空' }, 400)
  if (!STATUSES.includes(next.status)) return jsonResponse({ error: '无效的状态值' }, 400)
  if (next.difficulty !== null && !DIFFICULTIES.includes(next.difficulty)) {
    return jsonResponse({ error: '无效的难度值' }, 400)
  }

  const searchText = stripToText(`${next.title}\n${next.question}\n${next.answer}`)

  await env.DB.prepare(
    `UPDATE cards SET title = ?, question = ?, answer = ?, category = ?, subcategory = ?,
       difficulty = ?, status = ?, theme = ?, aliases = ?, related = ?, search_text = ?,
       sort_order = ?, updated_at = ?
     WHERE id = ?`,
  )
    .bind(
      next.title,
      next.question,
      next.answer,
      next.category,
      next.subcategory,
      next.difficulty,
      next.status,
      next.theme,
      JSON.stringify(next.aliases),
      JSON.stringify(next.related),
      searchText,
      next.sort_order,
      nowIso(),
      params.id,
    )
    .run()

  const tags = normalizeTagList(body.tags)
  if (tags !== undefined) await syncTags(env, params.id, tags)

  const card = await fetchCard(env, params.id)
  return jsonResponse(card)
})

/** DELETE /api/cards/:id —— 需要密码，软删除。 */
router.delete('/api/cards/:id', async ({ request, env, params }) => {
  const auth = await authGuard(request, env)
  if (auth.error) return auth.error
  await env.DB.prepare('UPDATE cards SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL')
    .bind(nowIso(), params.id)
    .run()
  return new Response(null, { status: 204 })
})

/**
 * POST /api/cards/bulk —— 需要密码，闪卡管理器的批量操作。
 * body: `{ ids: string[], action: 'delete' }`，保持软删除语义（AGENTS.md §16）。
 */
router.post('/api/cards/bulk', async ({ request, env }) => {
  const auth = await authGuard(request, env)
  if (auth.error) return auth.error

  let body = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const ids = Array.isArray(body.ids)
    ? body.ids.map((id) => String(id).trim()).filter(Boolean)
    : []
  if (ids.length === 0) return jsonResponse({ error: '没有要操作的卡片' }, 400)
  if (ids.length > 500) return jsonResponse({ error: '一次最多操作 500 张卡片' }, 400)

  const action = typeof body.action === 'string' ? body.action : ''
  if (action === 'delete') {
    const ts = nowIso()
    const placeholders = ids.map(() => '?').join(',')
    const { meta } = await env.DB.prepare(
      `UPDATE cards SET deleted_at = ? WHERE deleted_at IS NULL AND id IN (${placeholders})`,
    )
      .bind(ts, ...ids)
      .run()
    return jsonResponse({ deleted: meta?.changes ?? 0 })
  }

  return jsonResponse({ error: `不支持的操作：${action}` }, 400)
})

/* -------------------------------------------------------------------------- */
/* 标签 / 分类（聚类 facet）                                                    */
/* -------------------------------------------------------------------------- */

/** GET /api/tags —— 公开，带计数。 */
router.get('/api/tags', async ({ env }) => {
  const { results } = await env.DB.prepare(
    `SELECT t.id AS id, t.name AS name, t.slug AS slug, COUNT(ct.card_id) AS count
     FROM tags t
     JOIN card_tags ct ON ct.tag_id = t.id
     JOIN cards c ON c.id = ct.card_id AND c.deleted_at IS NULL
     GROUP BY t.id
     ORDER BY count DESC, t.name ASC`,
  ).all()
  return jsonResponse({ tags: results || [] })
})

/** GET /api/categories —— 公开，仅统计已发布卡片。 */
router.get('/api/categories', async ({ env }) => {
  const { results } = await env.DB.prepare(
    `SELECT category AS name, COUNT(*) AS count
     FROM cards
     WHERE deleted_at IS NULL AND status = 'published'
     GROUP BY category
     ORDER BY category ASC`,
  ).all()
  return jsonResponse({ categories: results || [] })
})

/* -------------------------------------------------------------------------- */
/* 复习进度                                                                     */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/* 间隔复习（AGENTS.md 新增：间隔复习系统）                                      */
/* -------------------------------------------------------------------------- */

/** 复习/管理共用的卡片查询：已发布 + 有答案 + 未删除，附带调度状态。 */
const SESSION_CARDS_SQL = `SELECT c.*, cs.due AS sched_due, cs.state AS sched_state,
    cs.stability AS sched_stability, cs.difficulty AS sched_difficulty, cs.reps AS sched_reps,
    cs.lapses AS sched_lapses, cs.last_review AS sched_last_review,
    cs.elapsed_days AS sched_elapsed_days, cs.scheduled_days AS sched_scheduled_days,
    cs.learning_steps AS sched_learning_steps,
    (SELECT group_concat(t.name, char(31))
     FROM card_tags ct JOIN tags t ON t.id = ct.tag_id
     WHERE ct.card_id = c.id) AS tag_names
  FROM cards c
  LEFT JOIN card_schedule cs ON cs.card_id = c.id AND cs.user_key = ?
  WHERE c.deleted_at IS NULL AND c.status = 'published' AND TRIM(c.answer) <> ''
  ORDER BY cs.due IS NULL, cs.due ASC, c.updated_at DESC`

/** 复习会话：到期卡优先（按到期时间升序），其后补新卡；未到期的卡不打扰。 */
router.get('/api/review/session', async ({ request, env }) => {
  const auth = await authGuard(request, env)
  if (auth.error) return auth.error

  const now = new Date()
  const { results } = await env.DB.prepare(SESSION_CARDS_SQL).bind(REVIEW_USER).all()
  const due = []
  const fresh = []

  for (const row of results || []) {
    const card = await rowToApiCard(row)
    if (row.sched_due) {
      const schedule = scheduleFromRow(row)
      // 已调度但还没到期 → 今天不进队列。
      if (schedule.due.getTime() > now.getTime()) continue
      due.push(cardWithSchedule(card, schedule, now))
    } else {
      fresh.push(cardWithSchedule(card, null, now))
    }
  }

  return jsonResponse({
    now: now.toISOString(),
    dueCount: due.length,
    newCount: fresh.length,
    total: due.length + fresh.length,
    cards: [...due, ...fresh].slice(0, SCHEDULE_LIMIT),
  })
})

/** 闪卡管理器：全部已发布卡片 + 调度状态 + 逾期与否。 */
router.get('/api/review/manage', async ({ request, env }) => {
  const auth = await authGuard(request, env)
  if (auth.error) return auth.error

  const now = new Date()
  const { results } = await env.DB.prepare(SESSION_CARDS_SQL).bind(REVIEW_USER).all()
  const cards = []
  for (const row of results || []) {
    cards.push(cardWithSchedule(await rowToApiCard(row), row.sched_due ? scheduleFromRow(row) : null, now))
  }
  return jsonResponse({ now: now.toISOString(), total: cards.length, cards })
})

/**
 * POST /api/cards/:id/review —— 需要密码。
 *
 * body: `{ rating: 'again' | 'hard' | 'good' | 'easy' }`
 * 兼容 v1 的 `{ verdict: 'known' | 'unknown' }`（分别映射 good / again）。
 * 服务端算 FSRS 并落库：card_schedule + review_log，同时回写 card_reviews。
 */
router.post('/api/cards/:id/review', async ({ request, env, params }) => {
  const auth = await authGuard(request, env)
  if (auth.error) return auth.error

  let body = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const rating = resolveRating(body)
  if (rating === null) return jsonResponse({ error: '无效的评分（again / hard / good / easy）' }, 400)

  const card = await fetchCard(env, params.id)
  if (!card) return jsonResponse({ error: '卡片不存在' }, 404)

  const now = new Date()
  const schedule = (await loadSchedule(env, params.id)) ?? createEmptyCard(now)
  const { card: next, log } = scheduler.next(schedule, now, rating)

  await saveSchedule(env, params.id, next)

  await env.DB.prepare(
    `INSERT INTO review_log
       (card_id, user_key, rating, state, stability, difficulty, scheduled_days, reviewed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      params.id,
      REVIEW_USER,
      log.rating,
      log.state,
      log.stability ?? 0,
      log.difficulty ?? 0,
      log.scheduled_days ?? 0,
      now.toISOString(),
    )
    .run()

  await syncReviewCounts(env, params.id, rating)

  return jsonResponse({
    id: params.id,
    rating: log.rating,
    schedule: serializeSchedule(next),
    intervals: previewIntervals(next, now),
  })
})

/** 成长看板：全年热力图、连击、状态分布、未来 30 天到期预测、记忆留存。 */
router.get('/api/review/stats', async ({ request, env }) => {
  const auth = await authGuard(request, env)
  if (auth.error) return auth.error

  const now = new Date()
  const yearAgo = new Date(now)
  yearAgo.setUTCDate(yearAgo.getUTCDate() - 364)
  const horizon = new Date(now)
  horizon.setUTCDate(horizon.getUTCDate() + 30)
  const day = (date) => date.toISOString().slice(0, 10)

  /* --- 复习流水 → 每日计数 ------------------------------------------------ */
  const { results: logRows } = await env.DB.prepare(
    `SELECT substr(reviewed_at, 1, 10) AS d, COUNT(*) AS n, AVG(CASE WHEN rating >= 3 THEN 1 ELSE 0 END) AS ok
     FROM review_log WHERE user_key = ? AND reviewed_at >= ?
     GROUP BY substr(reviewed_at, 1, 10)`,
  )
    .bind(REVIEW_USER, yearAgo.toISOString())
    .all()

  const byDay = new Map()
  for (const row of logRows || []) {
    byDay.set(row.d, { count: Number(row.n) || 0, ok: Number(row.ok) || 0 })
  }

  const heatmap = []
  for (let i = 364; i >= 0; i -= 1) {
    const date = new Date(now)
    date.setUTCDate(date.getUTCDate() - i)
    const key = day(date)
    const entry = byDay.get(key)
    heatmap.push({ date: key, count: entry ? entry.count : 0, ok: entry ? entry.ok : null })
  }

  /* --- 当前状态分布 -------------------------------------------------------- */
  const { results: stateRows } = await env.DB.prepare(
    `SELECT cs.state AS state, COUNT(*) AS n
     FROM card_schedule cs JOIN cards c ON c.id = cs.card_id
     WHERE cs.user_key = ? AND c.deleted_at IS NULL
     GROUP BY cs.state`,
  )
    .bind(REVIEW_USER)
    .all()

  const byState = { new: 0, learning: 0, review: 0, relearning: 0 }
  const STATE_KEY = ['new', 'learning', 'review', 'relearning']
  for (const row of stateRows || []) {
    byState[STATE_KEY[Number(row.state)] ?? 'review'] = Number(row.n) || 0
  }

  /* --- 未来 30 天到期预测 -------------------------------------------------- */
  const { results: forecastRows } = await env.DB.prepare(
    `SELECT substr(cs.due, 1, 10) AS d, COUNT(*) AS n
     FROM card_schedule cs JOIN cards c ON c.id = cs.card_id
     WHERE cs.user_key = ? AND c.deleted_at IS NULL AND c.status = 'published'
       AND cs.due >= ? AND cs.due < ?
     GROUP BY substr(cs.due, 1, 10)`,
  )
    .bind(REVIEW_USER, now.toISOString(), horizon.toISOString())
    .all()

  const dueByDay = new Map()
  for (const row of forecastRows || []) dueByDay.set(row.d, Number(row.n) || 0)

  const forecast = []
  for (let i = 0; i < 30; i += 1) {
    const date = new Date(now)
    date.setUTCDate(date.getUTCDate() + i)
    const key = day(date)
    forecast.push({ date: key, count: dueByDay.get(key) ?? 0 })
  }

  /* --- 连击（今天往前数连续的复习日；今天还没复习不断） ---------------------- */
  let streak = 0
  for (let i = 0; i < 365; i += 1) {
    if (i > 0 && (byDay.get(day(new Date(now.getTime() - i * 86400000)))?.count ?? 0) === 0) break
    streak += 1
  }

  /* --- 汇总 ---------------------------------------------------------------- */
  const totalReviews = heatmap.reduce((sum, entry) => sum + entry.count, 0)
  const todayKey = day(now)
  const todayCount = heatmap.find((entry) => entry.date === todayKey)?.count ?? 0
  const weekCount = heatmap.slice(-7).reduce((sum, entry) => sum + entry.count, 0)
  const okTotal = heatmap.reduce((sum, entry) => sum + entry.count * (entry.ok ?? 0), 0)

  const { results: publishRows } = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM cards
     WHERE deleted_at IS NULL AND status = 'published' AND TRIM(answer) <> ''`,
  ).all()
  const published = Number(publishRows?.[0]?.n) || 0
  const learnt = byState.learning + byState.review + byState.relearning
  const never = Math.max(0, published - learnt)
  // 「未学」不是 card_schedule 里的一行 state，而是「已发布但没有任何调度记录」。
  byState.new = never

  /* --- 记忆留存：已调度卡片 get_retrievability 的均值 ----------------------- */
  const { results: schedRows } = await env.DB.prepare(
    `SELECT cs.* FROM card_schedule cs JOIN cards c ON c.id = cs.card_id
     WHERE cs.user_key = ? AND c.deleted_at IS NULL AND c.status = 'published'
     ORDER BY cs.due ASC LIMIT 1000`,
  )
    .bind(REVIEW_USER)
    .all()

  let covered = 0
  let retrievability = 0
  for (const row of schedRows || []) {
    const schedule = scheduleFromRow(row)
    if (schedule.state === 0) continue // New 卡没有 retention 可言
    covered += 1
    retrievability += scheduler.get_retrievability(schedule, now, false)
  }

  return jsonResponse({
    now: now.toISOString(),
    heatmap,
    forecast,
    states: byState,
    streak,
    today: todayCount,
    week: weekCount,
    total: totalReviews,
    accuracy: totalReviews > 0 ? okTotal / totalReviews : 0,
    retention: covered > 0 ? retrievability / covered : 0,
    published,
    newCount: never,
  })
})

/** GET /api/reviews —— 需要密码。v1 兼容接口，继续返回 known / unknown 计数。 */
router.get('/api/reviews', async ({ request, env }) => {
  const auth = await authGuard(request, env)
  if (auth.error) return auth.error
  const { results } = await env.DB.prepare(
    `SELECT card_id, known_count, unknown_count, last_verdict, last_reviewed_at
     FROM card_reviews WHERE user_key = ?`,
  )
    .bind(REVIEW_USER)
    .all()
  return jsonResponse({ reviews: results || [] })
})

/* -------------------------------------------------------------------------- */
/* 入口                                                                         */
/* -------------------------------------------------------------------------- */

export async function onRequest(context) {
  return await router.handler(context.request, context.env, context)
}
