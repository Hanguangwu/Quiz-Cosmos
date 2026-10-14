/**
 * 学习宠物的形态推导 —— 纯函数，与 UI 无关（AGENTS.md §24：业务逻辑与 UI 分离）。
 *
 * 三段成长，各由一个明确的量化阈值触发：
 *   · 蛋     累计复习 < 10 次
 *   · 幼鸟   累计复习 >= 10 次
 *   · 成鸟   累计复习 >= 200 次
 *
 * 羽色由「记忆留存率」决定；连击只影响气泡文案，不影响形态 —— 这样同一形态
 * 的含义是稳定的，换设备/多人共享进度时也自然一致。
 *
 * 因为完全由统计派生，所以不引入任何新的存储（AGENTS.md：不引入新存储）。
 */

export type PetStage = 'egg' | 'chick' | 'adult'
export type PetPlumage = 'accent' | 'ok' | 'warn'

export interface PetStats {
  /** 全库累计复习次数。 */
  totalReviews: number
  /** 连续复习天数。 */
  streak: number
  /** 今天的复习次数。 */
  today: number
  /** 已学卡片的平均可回忆概率（0-1）。 */
  retention: number
}

export interface PetForm {
  stage: PetStage
  plumage: PetPlumage
  name: string
  emoji: string
  /** 气泡里的话。 */
  bubble: string
  /** 距离下一阶段还差多少次复习；null = 已满级。 */
  nextIn: number | null
  /** 当前阶段内的进度百分比（0-100）。 */
  progress: number
}

const STAGE_THRESHOLD = { chick: 10, adult: 200 }

/** 形态判定：总量 → 阶段，留存率 → 羽色。 */
export function buildPet({ totalReviews, streak, today, retention }: PetStats): PetForm {
  const stage: PetStage =
    totalReviews >= STAGE_THRESHOLD.adult
      ? 'adult'
      : totalReviews >= STAGE_THRESHOLD.chick
        ? 'chick'
        : 'egg'

  const plumage: PetPlumage = retention >= 0.85 ? 'ok' : retention >= 0.65 ? 'accent' : 'warn'

  // 阶段内进度：从上一级阈值到现在的位置。
  const floor = stage === 'egg' ? 0 : stage === 'chick' ? STAGE_THRESHOLD.chick : STAGE_THRESHOLD.adult
  const ceiling =
    stage === 'egg' ? STAGE_THRESHOLD.chick : stage === 'chick' ? STAGE_THRESHOLD.adult : null
  const progress =
    ceiling === null
      ? 100
      : Math.max(0, Math.min(100, Math.round(((totalReviews - floor) / (ceiling - floor)) * 100)))

  if (stage === 'egg') {
    return {
      stage,
      plumage,
      name: '一颗蛋',
      emoji: '🥚',
      bubble: '它还没感受到你的复习。开始第一次复习，它就会裂开。',
      nextIn: Math.max(1, STAGE_THRESHOLD.chick - totalReviews),
      progress,
    }
  }

  if (stage === 'chick') {
    const bubble =
      streak >= 3
        ? `连续 ${streak} 天了！它开始跟着你的节奏叫。`
        : today > 0
          ? '今天已经见过它了，它精神不错。'
          : '它在等你。今天复习一次它就会更近一步。'
    return {
      stage,
      plumage,
      name: plumage === 'warn' ? '学步的幼鸟' : '幼鸟',
      emoji: '🐣',
      bubble,
      nextIn: Math.max(1, STAGE_THRESHOLD.adult - totalReviews),
      progress,
    }
  }

  const bubble =
    retention >= 0.85
      ? '这些卡片已经长在你身上了，它只是替你守着。'
      : retention >= 0.65
        ? '大部分都记得，少数几张还在门口徘徊。'
        : '最近忘得有点多，它提醒你多给「忘了」一次机会。'

  return {
    stage,
    plumage: plumage === 'warn' ? 'warn' : 'ok',
    name: plumage === 'warn' ? '羽毛未丰的鸟' : '羽翼丰满的鸟',
    emoji: plumage === 'warn' ? '🐤' : '🦅',
    bubble,
    nextIn: null,
    progress,
  }
}
