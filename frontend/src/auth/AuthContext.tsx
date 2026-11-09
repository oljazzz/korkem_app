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

/** Tells the app's other tabs about sign-in and sign-out; they share the session cookie. */
type AuthMessage = 'login' | 'logout'
const CHANNEL = 'korkem-auth'

function openChannel(): BroadcastChannel | null {
  return typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL)
}

function broadcast(message: AuthMessage) {
  const channel = openChannel()
  channel?.postMessage(message)
  channel?.close()
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // The httpOnly session cookie is invisible to scripts, so ask the server who we are
  const loadMe = useCallback(
    () =>
      http
        .get<User>('/api/auth/me')
        .then(setUser)
        .catch(() => setUser(null))
        .finally(() => setLoading(false)),
    [],
  )

  useEffect(() => {
    loadMe()
  }, [loadMe])

  // Session expired (401): sign out here and in the other tabs
  useEffect(() => {
    const onLogout = () => {
      setUser(null)
      broadcast('logout')
    }
    window.addEventListener(LOGOUT_EVENT, onLogout)
    return () => window.removeEventListener(LOGOUT_EVENT, onLogout)
  }, [])

  // Another tab signed in or out: follow it
  useEffect(() => {
    const channel = openChannel()
    if (!channel) return
    channel.onmessage = (e: MessageEvent<AuthMessage>) => {
      if (e.data === 'logout') setUser(null)
      else if (e.data === 'login') loadMe()
    }
    return () => channel.close()
  }, [loadMe])

  const login = useCallback(async (username: string, password: string, remember: boolean) => {
    const res = await http.post<{ user: User }>('/api/auth/login', { username, password, remember })
    setUser(res.user)
    broadcast('login')
  }, [])

  const logout = useCallback(async () => {
    await http.post('/api/auth/logout', {}).catch(() => undefined)
    setUser(null)
    broadcast('logout')
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
