/**
 * 时长与间隔格式化（间隔复习系统共用）。
 *
 * FSRS 的学习步长是分钟级（默认 ['1m','10m']），间隔成长后又变成天/月/年，
 * 所以「距下次还有多久」必须在多个量级之间切换，而不是一律按天。
 */

const MINUTE = 60
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const MONTH = 30 * DAY
const YEAR = 365 * DAY

/**
 * 秒 → 「5 分钟后」「3 天后」「1 个月后」「100 年后」。
 * `now` 语义的时间点取整数分钟/天，避免显示「13 小时后」这种难读的数字。
 */
export function formatInterval(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  if (total < 1) return '马上'
  if (total < HOUR) {
    const minutes = Math.max(1, Math.round(total / MINUTE))
    return `${minutes} 分钟后`
  }
  if (total < DAY) return `${Math.round(total / HOUR)} 小时后`
  if (total < MONTH) return `${Math.round(total / DAY)} 天后`
  if (total < YEAR) return `${Math.round(total / MONTH)} 个月后`
  return `${Math.round(total / YEAR)} 年后`
}

/** ISO 时间 → 相对现在的「还有 x / 已过 x」。 */
export function formatRelative(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return '从未复习'
  const target = new Date(iso).getTime()
  if (Number.isNaN(target)) return '—'
  const delta = Math.round((target - now) / 1000)
  return delta >= 0 ? `还有 ${formatInterval(delta)}` : `已过 ${formatInterval(-delta)}`
}
