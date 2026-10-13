import { useCallback, useEffect, useState } from 'react'

/**
 * Reader preferences kept in localStorage: the app chrome appearance and the
 * default card theme.
 *
 * These are *preferences*, not data. Knowledge content always comes from the
 * D1-backed API via `src/lib/content.ts`.
 */

const APPEARANCE_KEY = 'kc:appearance'
const CARD_THEME_KEY = 'kc:card-theme'

export type Appearance = 'light' | 'dark'

function read(key: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* private mode — preferences simply do not persist */
  }
}

function systemAppearance(): Appearance {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

/** App chrome appearance, defaulting to the OS preference. */
export function useAppearance(): [Appearance, (next: Appearance) => void] {
  const [appearance, setAppearance] = useState<Appearance>(() => {
    const stored = read(APPEARANCE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : systemAppearance()
  })

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', appearance === 'dark')
    root.style.colorScheme = appearance
    const meta = document.querySelector('meta[name="theme-color"]')
    meta?.setAttribute('content', appearance === 'dark' ? '#070a12' : '#f4f6fb')
  }, [appearance])

  const set = useCallback((next: Appearance) => {
    setAppearance(next)
    write(APPEARANCE_KEY, next)
  }, [])

  return [appearance, set]
}

/** The reader's default card theme; individual cards may override it. */
export function useCardThemePreference(): [string | null, (next: string | null) => void] {
  const [themeId, setThemeId] = useState<string | null>(() => read(CARD_THEME_KEY))

  const set = useCallback((next: string | null) => {
    setThemeId(next)
    if (next === null) write(CARD_THEME_KEY, '')
    else write(CARD_THEME_KEY, next)
  }, [])

  return [themeId || null, set]
}
