import { createContext, useContext, useEffect, useState } from 'react'

import { api } from '../lib/api'

const TOKEN_KEY = 'playwise-token'
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function restoreSession() {
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
      } catch (_) {
        localStorage.removeItem(TOKEN_KEY)
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

  async function handleAuthRequest(action, payload) {
    const response = await action(payload)
    localStorage.setItem(TOKEN_KEY, response.token)
    setToken(response.token)
    setUser(response.user)
    return response.user
  }

  async function login(payload) {
    return handleAuthRequest(api.login, payload)
  }

  async function register(payload) {
    return handleAuthRequest(api.register, payload)
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isLoading,
        login,
        register,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }

  return context
}
