import { useCallback, useState } from 'react'
import { cn } from '@/lib/cn'
import { AlignJustify, Layers, type LucideIcon } from 'lucide-react'
import type { CardReadMode } from './KnowledgeCard'

/**
 * 阅读方式 — the 展开 / 翻面 switch (AGENTS.md §12).
 *
 * WHERE IT LIVES, AND WHY
 * -----------------------
 * This is PAGE CHROME, drawn in app tokens and placed above the card by the
 * single-card page — never inside the card. Two reasons, both of them the
 * reason the grid does not get this control at all:
 *
 *   1. A grid of six cards each carrying a two-button switch is a wall of
 *      toggles. Browsing surfaces (`/`, `/cards`, `/search`, tag and category
 *      pages) stay a plain 翻面 card, which is also the better affordance
 *      there: tap to reveal, keep scrolling. The single-card page is the one
 *      place a reader commits to a long answer, so that is where the choice
 *      belongs.
 *   2. It must stay clickable while the card is a flip target. Outside the
 *      card there is no handler to fight and no z-index race.
 *
 * Real `<button>`s with `aria-pressed`, so it is keyboard-operable and
 * announced as a two-state control rather than as a mystery tab strip.
 */

interface ModeOption {
  value: CardReadMode
  label: string
  icon: LucideIcon
  hint: string
}

const MODE_OPTIONS: readonly ModeOption[] = [
  {
    value: 'expand',
    label: '展开',
    icon: AlignJustify,
    hint: '问题与答案上下排在一起，连续往下读',
  },
  {
    value: 'flip',
    label: '翻面',
    icon: Layers,
    hint: '先看问题，点卡片或按按钮再显示答案',
  },
]

/** One plain line describing the current mode. Shown next to the switch. */
export const READ_MODE_HINT: Record<CardReadMode, string> = {
  expand: '问题与答案连续排在一起，适合长答案。',
  flip: '先看问题，点一下卡片或用 Tab 找到按钮再翻面。',
}

export interface ReadModeToggleProps {
  mode: CardReadMode
  onChange: (mode: CardReadMode) => void
  className?: string
}

/**
 * 展开 is the default because it is the only mode with nothing between the
 * reader and the text (design-plan: content readability > information
 * hierarchy > efficiency > decoration, AGENTS.md §28). The choice is
 * remembered as a *preference*, not data — the same treatment
 * `shell/preferences.ts` gives appearance and card theme.
 */
const READ_MODE_KEY = 'kc:read-mode'

function isReadMode(value: string | null): value is CardReadMode {
  return value === 'expand' || value === 'flip'
}

/**
 * The reader's preferred reading mode. 展开 on first visit, remembered after.
 * Lives here rather than in `shell/preferences.ts` so the control and the
 * thing it controls stay in one file.
 */
export function useReadModePreference(): [CardReadMode, (next: CardReadMode) => void] {
  const [mode, setMode] = useState<CardReadMode>(() => {
    if (typeof window === 'undefined') return 'expand'
    try {
      const stored = window.localStorage.getItem(READ_MODE_KEY)
      return isReadMode(stored) ? stored : 'expand'
    } catch {
      return 'expand'
    }
  })

  const set = useCallback((next: CardReadMode) => {
    setMode(next)
    try {
      window.localStorage.setItem(READ_MODE_KEY, next)
    } catch {
      /* private mode — the choice simply does not persist */
    }
  }, [])

  return [mode, set]
}

export function ReadModeToggle({ mode, onChange, className }: ReadModeToggleProps) {
  return (
    <div
      role="group"
      aria-label="阅读方式"
      className={cn(
        'inline-flex items-stretch rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface-2)] p-0.5',
        className,
      )}
    >
      {MODE_OPTIONS.map(({ value, label, icon: Icon, hint }) => {
        const selected = mode === value
        return (
          <button
            key={value}
            type="button"
            aria-pressed={selected}
            title={hint}
            onClick={() => onChange(value)}
            className={cn(
              'inline-flex h-9 items-center gap-1.5 rounded-[calc(var(--radius-panel)-2px)] px-3.5 text-sm transition-colors',
              selected
                ? 'bg-[var(--color-surface-3)] font-medium text-[var(--color-ink)] shadow-[var(--shadow-panel)]'
                : 'text-[var(--color-ink-2)] hover:text-[var(--color-ink)]',
            )}
          >
            <Icon aria-hidden className="size-3.5 opacity-75" />
            {label}
          </button>
        )
      })}
    </div>
  )
}
