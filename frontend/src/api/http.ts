import { t } from '../i18n'
const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? ''

export class ApiError extends Error {
  status: number
  fields: Record<string, string>

  constructor(status: number, message: string, fields: Record<string, string> = {}) {
    super(message)
    this.status = status
    this.fields = fields
  }
}

/** Fired on 401: AuthContext listens and returns the user to the login page. */
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

const AUTH_PATHS = ['/api/auth/login', '/api/auth/logout', '/api/auth/me']

// The session lives in an httpOnly cookie set by the server; page scripts never see the token.
async function request<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  let res: Response
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      headers,
      credentials: BASE ? 'include' : 'same-origin',
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, t('api.offline'))
  }

  if (res.status === 401 && !AUTH_PATHS.includes(path)) {
    window.dispatchEvent(new Event(LOGOUT_EVENT))
  }
  if (res.status === 204) return undefined as T

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new ApiError(res.status, data?.message ?? t('api.error', { status: res.status }), data?.fields ?? {})
  }
  return data as T
}

/** Name from Content-Disposition (filename*=UTF-8''… first, it keeps Kazakh letters). */
function fileName(header: string | null, fallback: string) {
  const star = header?.match(/filename\*=UTF-8''([^;]+)/i)
  if (star) return decodeURIComponent(star[1])
  const plain = header?.match(/filename="?([^";]+)"?/i)
  return plain ? plain[1] : fallback
}

/** Downloads a file the server builds (an Excel export) under the name the server gives it. */
async function download(path: string, query?: Query): Promise<void> {
  let res: Response
  try {
    res = await fetch(buildUrl(path, query), { credentials: BASE ? 'include' : 'same-origin' })
  } catch {
    throw new ApiError(0, t('api.offline'))
  }
  if (res.status === 401) window.dispatchEvent(new Event(LOGOUT_EVENT))
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new ApiError(res.status, data?.message ?? t('api.error', { status: res.status }))
  }
  const url = URL.createObjectURL(await res.blob())
  const a = document.createElement('a')
  a.href = url
  a.download = fileName(res.headers.get('Content-Disposition'), 'export.xlsx')
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export const http = {
  download,
  get: <T>(path: string, query?: Query) => request<T>('GET', path, undefined, query),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  delete: (path: string) => request<void>('DELETE', path),
}
