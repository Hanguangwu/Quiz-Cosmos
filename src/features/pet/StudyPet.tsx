import { useMemo } from 'react'
import { buildPet } from './pet'
import { cn } from '@/lib/cn'

/**
 * 学习宠物 —— 由复习统计**纯派生**，不写入任何存储。
 *
 * 形态判定见 `pet.ts`；这里只负责把它画出来。蛋 → 幼鸟 → 成鸟用同一个
 * 头像区域随阶段放大，不引入任何外部素材。
 */

export interface StudyPetProps {
  /** 全库累计复习次数。 */
  totalReviews: number
  /** 连续复习天数。 */
  streak: number
  /** 今天的复习次数。 */
  today: number
  /** 已学卡片的平均可回忆概率（0-1）。 */
  retention: number
  className?: string
}

export function StudyPet({ totalReviews, streak, today, retention, className }: StudyPetProps) {
  const pet = useMemo(
    () => buildPet({ totalReviews, streak, today, retention }),
    [totalReviews, streak, today, retention],
  )

  const stageLabel = pet.stage === 'egg' ? '孵化中' : pet.stage === 'chick' ? '成长中' : '成熟'
  const barClass =
    pet.plumage === 'ok'
      ? 'bg-[var(--color-ok)]'
      : pet.plumage === 'warn'
        ? 'bg-[var(--color-warn)]'
        : 'bg-[var(--color-accent)]'

  return (
    <section
      className={cn(
        'flex items-center gap-4 rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface)] p-4',
        className,
      )}
      aria-label="学习宠物"
    >
      <div
        aria-hidden
        className={cn(
          'flex size-14 shrink-0 items-center justify-center rounded-full border border-[var(--color-line-strong)] bg-[var(--color-surface-3)]',
          pet.stage !== 'egg' && 'transition-transform duration-500',
        )}
      >
        <span className="text-2xl leading-none select-none">{pet.emoji}</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-medium text-[var(--color-ink)]">{pet.name}</h2>
          <span className="rounded-[var(--radius-pill)] bg-[var(--color-surface-3)] px-2 py-0.5 text-[0.6875rem] text-[var(--color-ink-2)]">
            {stageLabel}
          </span>
          {streak > 0 ? (
            <span className="text-[0.6875rem] text-[var(--color-ink-3)]">连击 {streak} 天</span>
          ) : null}
        </div>

        <p className="mt-1 text-xs leading-relaxed text-[var(--color-ink-2)]">{pet.bubble}</p>

        {pet.nextIn !== null ? (
          <div className="mt-2">
            <div className="h-1.5 overflow-hidden rounded-[var(--radius-pill)] bg-[var(--color-surface-3)]">
              <div
                className={cn('h-full rounded-[var(--radius-pill)] transition-[width] duration-500', barClass)}
                style={{ width: `${pet.progress}%` }}
              />
            </div>
            <p className="mt-1 text-[0.6875rem] text-[var(--color-ink-3)]">
              再复习 {pet.nextIn} 次进入下一形态
            </p>
          </div>
        ) : (
          <p className="mt-1 text-[0.6875rem] text-[var(--color-ink-3)]">
            记忆留存 {Math.round(retention * 100)}% · 已满级，保持手感就好
          </p>
        )}
      </div>
    </section>
  )
}
