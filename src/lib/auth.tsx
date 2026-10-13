/**
 * Session / auth context.
 *
 * Only *editing* requires a password — public browsing stays open. The token is
 * kept in localStorage and sent as a Bearer header by `src/lib/api.ts`.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { TOKEN_KEY, login as apiLogin, logout as apiLogout } from './api'

export interface AuthValue {
  token: string | null
  isAuthed: boolean
  login: (password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

function readToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    setToken(readToken())
  }, [])

  const login = useCallback(async (password: string) => {
    const { token: next } = await apiLogin(password)
    try {
      window.localStorage.setItem(TOKEN_KEY, next)
    } catch {
      /* storage blocked — session stays in memory only */
    }
    setToken(next)
  }, [])

  const logout = useCallback(async () => {
    const current = token
    setToken(null)
    try {
      window.localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* ignore */
    }
    if (current) {
      try {
        await apiLogout(current)
      } catch {
        /* best effort */
      }
    }
  }, [token])

  const value = useMemo<AuthValue>(
    () => ({ token, isAuthed: token !== null, login, logout }),
    [token, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth 必须在 <AuthProvider> 内部使用。')
  return value
}
