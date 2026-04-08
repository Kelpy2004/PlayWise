import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { api } from '../lib/api'
import type { SessionUser } from '../types/api'

const TOKEN_KEY = 'playwise-token'

interface AuthContextValue {
  token: string | null
  user: SessionUser | null
  isLoading: boolean
  login: (payload: { usernameOrEmail: string; password: string }) => Promise<SessionUser>
  register: (payload: { username: string; email: string; password: string; adminSetupCode?: string }) => Promise<SessionUser>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(TOKEN_KEY)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getStoredToken())
  const [user, setUser] = useState<SessionUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function restoreSession(): Promise<void> {
      if (!token) {
        if (isMounted) {
          setUser(null)
          setIsLoading(false)
        }
        return
      }

      try {
        const response = await api.getSession(token)
        if (!isMounted) return
        setUser(response.user)
      } catch {
        window.localStorage.removeItem(TOKEN_KEY)
        if (!isMounted) return
        setToken(null)
        setUser(null)
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    restoreSession()

    return () => {
      isMounted = false
    }
  }, [token])

  async function handleAuthResponse(
    responsePromise: Promise<{ token: string; user: SessionUser }>
  ): Promise<SessionUser> {
    const response = await responsePromise
    window.localStorage.setItem(TOKEN_KEY, response.token)
    setToken(response.token)
    setUser(response.user)
    return response.user
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      isLoading,
      login: (payload) => handleAuthResponse(api.login(payload)),
      register: (payload) => handleAuthResponse(api.register(payload)),
      logout: () => {
        window.localStorage.removeItem(TOKEN_KEY)
        setToken(null)
        setUser(null)
      }
    }),
    [isLoading, token, user]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }

  return context
}
