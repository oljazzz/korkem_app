import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { http, LOGOUT_EVENT } from '../api/http'
import type { User } from '../api/types'

interface AuthState {
  user: User | null
  loading: boolean
  login: (username: string, password: string, remember: boolean) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // The httpOnly session cookie is invisible to scripts, so ask the server who we are
  useEffect(() => {
    http
      .get<User>('/api/auth/me')
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const onLogout = () => setUser(null)
    window.addEventListener(LOGOUT_EVENT, onLogout)
    return () => window.removeEventListener(LOGOUT_EVENT, onLogout)
  }, [])

  const login = useCallback(async (username: string, password: string, remember: boolean) => {
    const res = await http.post<{ user: User }>('/api/auth/login', { username, password, remember })
    setUser(res.user)
  }, [])

  const logout = useCallback(async () => {
    await http.post('/api/auth/logout', {}).catch(() => undefined)
    setUser(null)
  }, [])

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useIsAdmin() {
  return useAuth().user?.role === 'ADMIN'
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
