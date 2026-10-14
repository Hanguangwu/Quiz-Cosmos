/**
 * Backend API client.
 *
 * The app runs on Cloudflare Pages: reading is public, every write needs a
 * session token from `/api/login` (see functions/api/[[proxy]].js). Base URL
 * honours `import.meta.env.BASE_URL` so a sub-path deployment still works.
 */

import type { CardStatus, Difficulty } from '../types'

export const TOKEN_KEY = 'kc:token'

/** A card exactly as the D1 API returns it. */
export interface ApiCard {
  id: string
  type: string
  title: string
  question: string
  answer: string
  category: string
  subcategory: string | null
  difficulty: Difficulty | null
  status: CardStatus
  theme: string | null
  tags: string[]
  aliases: string[]
  related: string[]
  sort_order: number
  created_at: string
  updated_at: string
}

export interface CardInput {
  id?: string
  title: string
  question: string
  answer: string
  category: string
  subcategory?: string | null
  difficulty?: Difficulty | null
  status?: CardStatus
  theme?: string | null
  tags?: string[]
  aliases?: string[]
  related?: string[]
  sort_order?: number
}

export interface TagSummary {
  id: number
  name: string
  slug: string
  count: number
}

export interface CategorySummary {
  name: string
  count: number
}

export class ApiError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/** `<base>/api/<path>`, always with exactly one slash between parts. */
export function apiUrl(path: string): string {
  const env = import.meta.env as { BASE_URL?: string } | undefined
  const base = env?.BASE_URL ?? '/'
  const root = base.endsWith('/') ? base : `${base}/`
  return `${root}api${path.startsWith('/') ? path : `/${path}`}`
}

interface RequestOptions {
  method?: string
  body?: unknown
  token?: string | null
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = options
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  let response: Response
  try {
    response = await fetch(apiUrl(path), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError('网络请求失败，请检查网络后重试。', 0)
  }

  if (response.status === 204) return undefined as T

  const raw = await response.text()
  let payload: unknown = null
  if (raw) {
    try {
      payload = JSON.parse(raw)
    } catch {
      payload = null
    }
  }

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === 'object' &&
      'error' in payload &&
      typeof (payload as { error: unknown }).error === 'string'
        ? (payload as { error: string }).error
        : `请求失败：HTTP ${response.status}。`
    throw new ApiError(message, response.status)
  }

  return payload as T
}

export function login(password: string): Promise<{ token: string }> {
  return request('/login', { method: 'POST', body: { password } })
}

export function logout(token: string | null): Promise<void> {
  return request('/logout', { method: 'POST', token })
}

export interface ListCardsParams {
  query?: string
  category?: string
  tag?: string
  status?: CardStatus
  difficulty?: Difficulty
}

export function listCards(
  params: ListCardsParams = {},
): Promise<{ total: number; cards: ApiCard[] }> {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value)
  }
  const qs = search.toString()
  return request(`/cards${qs ? `?${qs}` : ''}`)
}

export function getCard(id: string): Promise<ApiCard> {
  return request(`/cards/${encodeURIComponent(id)}`)
}

export function createCard(input: CardInput, token: string): Promise<ApiCard> {
  return request('/cards', { method: 'POST', body: input, token })
}

export function updateCard(id: string, input: CardInput, token: string): Promise<ApiCard> {
  return request(`/cards/${encodeURIComponent(id)}`, { method: 'PUT', body: input, token })
}

export function deleteCard(id: string, token: string): Promise<void> {
  return request(`/cards/${encodeURIComponent(id)}`, { method: 'DELETE', token })
}

export function listTags(): Promise<{ tags: TagSummary[] }> {
  return request('/tags')
}

export function listCategories(): Promise<{ categories: CategorySummary[] }> {
  return request('/categories')
}

export interface ReviewRow {
  card_id: string
  known_count: number
  unknown_count: number
  last_verdict: 'known' | 'unknown' | null
  last_reviewed_at: string
}

export function listReviews(token: string): Promise<{ reviews: ReviewRow[] }> {
  return request('/reviews', { token })
}

/* -------------------------------------------------------------------------- */
/* 间隔复习（FSRS）                                                             */
/* -------------------------------------------------------------------------- */

export type ReviewRating = 'again' | 'hard' | 'good' | 'easy'

/** ts-fsrs `State`：0 New · 1 Learning · 2 Review · 3 Relearning。 */
export type ScheduleState = 'new' | 'learning' | 'review' | 'relearning'

export interface CardSchedule {
  due: string
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  learning_steps: number
  reps: number
  lapses: number
  state: number
  last_review: string | null
}

/** 四档下一次间隔，单位秒。学习步长是分钟级，所以不能按天格式化。 */
export type ReviewIntervals = Record<ReviewRating, number>

export interface ReviewCard extends ApiCard {
  schedule: CardSchedule | null
  due: string | null
  overdue: boolean
  /** 仅已调度卡片有：本次复习后四档间隔预览。 */
  intervals?: ReviewIntervals
}

export interface ReviewSession {
  now: string
  dueCount: number
  newCount: number
  total: number
  cards: ReviewCard[]
}

export interface ReviewStatsBucket {
  date: string
  count: number
  ok: number | null
}

export interface ReviewStats {
  now: string
  heatmap: ReviewStatsBucket[]
  forecast: ReviewStatsBucket[]
  states: Record<ScheduleState, number>
  streak: number
  today: number
  week: number
  total: number
  accuracy: number
  retention: number
  published: number
  newCount: number
}

export function getReviewSession(token: string): Promise<ReviewSession> {
  return request('/review/session', { token })
}

export function getReviewStats(token: string): Promise<ReviewStats> {
  return request('/review/stats', { token })
}

/** 闪卡管理器用的全量卡片 + 调度状态。 */
export function getManagedCards(token: string): Promise<{ now: string; total: number; cards: ReviewCard[] }> {
  return request('/review/manage', { token })
}

export function bulkCards(ids: string[], action: 'delete', token: string): Promise<{ deleted: number }> {
  return request('/cards/bulk', { method: 'POST', body: { ids, action }, token })
}

/** 记录一次复习。服务端据此跑 FSRS 并返回新的调度状态。 */
export function reviewCard(
  id: string,
  rating: ReviewRating | 'known' | 'unknown',
  token: string,
): Promise<{ id: string; rating: number; schedule: CardSchedule; intervals: ReviewIntervals }> {
  return request(`/cards/${encodeURIComponent(id)}/review`, {
    method: 'POST',
    body: { rating },
    token,
  })
}
