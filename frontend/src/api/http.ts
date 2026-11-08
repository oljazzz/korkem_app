const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? ''
const TOKEN_KEY = 'korkem_token'

export class ApiError extends Error {
  status: number
  fields: Record<string, string>

  constructor(status: number, message: string, fields: Record<string, string> = {}) {
    super(message)
    this.status = status
    this.fields = fields
  }
}

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn()
  } catch {
    return fallback
  }
}

export const tokenStore = {
  get(): string | null {
    return safe(() => localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY), null)
  },
  set(token: string, remember: boolean) {
    safe(() => {
      this.clear()
      ;(remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token)
    }, undefined)
  },
  clear() {
    safe(() => {
      localStorage.removeItem(TOKEN_KEY)
      sessionStorage.removeItem(TOKEN_KEY)
    }, undefined)
  },
}

/** Токен ескірсе (401), AuthContext осы оқиғаны тыңдап, логин бетіне қайтарады. */
export const LOGOUT_EVENT = 'korkem:logout'

type Query = Record<string, string | number | null | undefined>

function buildUrl(path: string, query?: Query) {
  const params = new URLSearchParams()
  Object.entries(query ?? {}).forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== '') params.set(k, String(v))
  })
  const qs = params.toString()
  return `${BASE}${path}${qs ? `?${qs}` : ''}`
}

async function request<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
  const headers: Record<string, string> = {}
  const token = tokenStore.get()
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  let res: Response
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'Серверге қосылу мүмкін болмады')
  }

  if (res.status === 401 && path !== '/api/auth/login') {
    tokenStore.clear()
    window.dispatchEvent(new Event(LOGOUT_EVENT))
  }
  if (res.status === 204) return undefined as T

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new ApiError(res.status, data?.message ?? `Қате (${res.status})`, data?.fields ?? {})
  }
  return data as T
}

export const http = {
  get: <T>(path: string, query?: Query) => request<T>('GET', path, undefined, query),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  delete: (path: string) => request<void>('DELETE', path),
}
