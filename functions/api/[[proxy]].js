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

/** POST /api/cards/:id/review —— 需要密码，记录 记得 / 忘了。 */
router.post('/api/cards/:id/review', async ({ request, env, params }) => {
  const auth = await authGuard(request, env)
  if (auth.error) return auth.error

  let body = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }
  const verdict = body.verdict
  if (verdict !== 'known' && verdict !== 'unknown') {
    return jsonResponse({ error: '无效的判定值' }, 400)
  }

  const exists = await env.DB.prepare(
    'SELECT id FROM cards WHERE id = ? AND deleted_at IS NULL',
  )
    .bind(params.id)
    .all()
  if (!exists.results || exists.results.length === 0) {
    return jsonResponse({ error: '卡片不存在' }, 404)
  }

  const knownInc = verdict === 'known' ? 1 : 0
  const unknownInc = verdict === 'unknown' ? 1 : 0

  await env.DB.prepare(
    `INSERT INTO card_reviews (card_id, user_key, known_count, unknown_count, last_verdict, last_reviewed_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(card_id, user_key) DO UPDATE SET
       known_count = known_count + excluded.known_count,
       unknown_count = unknown_count + excluded.unknown_count,
       last_verdict = excluded.last_verdict,
       last_reviewed_at = excluded.last_reviewed_at`,
  )
    .bind(params.id, auth.userKey, knownInc, unknownInc, verdict, nowIso())
    .run()

  return new Response(null, { status: 204 })
})

/** GET /api/reviews —— 需要密码。 */
router.get('/api/reviews', async ({ request, env }) => {
  const auth = await authGuard(request, env)
  if (auth.error) return auth.error
  const { results } = await env.DB.prepare(
    `SELECT card_id, known_count, unknown_count, last_verdict, last_reviewed_at
     FROM card_reviews WHERE user_key = ?`,
  )
    .bind(auth.userKey)
    .all()
  return jsonResponse({ reviews: results || [] })
})

/* -------------------------------------------------------------------------- */
/* 入口                                                                         */
/* -------------------------------------------------------------------------- */

export async function onRequest(context) {
  return await router.handler(context.request, context.env, context)
}
