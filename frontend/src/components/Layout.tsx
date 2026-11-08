import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { Icon, type IconName } from './Icon'
import { Logo } from './Ornament'

type Theme = 'light' | 'dark'

function readTheme(): Theme {
  try {
    return localStorage.getItem('korkem_theme') === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

const NAV: { to: string; label: string; icon: IconName; end?: boolean; adminOnly?: boolean }[] = [
  { to: '/', label: 'Басты бет', icon: 'home', end: true },
  { to: '/invoices', label: 'Жүкқұжаттар', icon: 'invoice' },
  { to: '/reports', label: 'Есептер', icon: 'report' },
  { to: '/products', label: 'Баға тізімі', icon: 'tag' },
  { to: '/categories', label: 'Санаттар', icon: 'folder' },
  { to: '/clients', label: 'Клиенттер', icon: 'client' },
  { to: '/users', label: 'Пайдаланушылар', icon: 'users', adminOnly: true },
]

export const ROLE_LABEL = { ADMIN: 'Әкімші', MANAGER: 'Менеджер' } as const

export function Layout() {
  const { user, logout } = useAuth()
  const [theme, setTheme] = useState<Theme>(readTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('korkem_theme', theme)
    } catch {
      /* storage may be blocked; ignore */
    }
  }, [theme])

  return (
    <div className="shell">
      <aside className="rail">
        <NavLink to="/" className="rail__brand" aria-label="Көркем — басты бет">
          <Logo size={38} />
          <span className="rail__name">
            Көркем
            <small>сауда есебі</small>
          </span>
        </NavLink>

        <nav className="rail__nav" aria-label="Бөлімдер">
          {NAV.filter((n) => !n.adminOnly || user?.role === 'ADMIN').map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) => `rail__link ${isActive ? 'is-active' : ''}`}
            >
              <Icon name={n.icon} />
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="rail__foot">
          <div className="rail__user">
            <span className="avatar">{user?.username.slice(0, 1).toUpperCase()}</span>
            <span className="rail__who">
              {user?.firstName || user?.username}
              <small>{user ? ROLE_LABEL[user.role] : ''} · Алматы</small>
            </span>
          </div>
          <div className="rail__actions">
            <button
              className="icon-btn"
              title={theme === 'light' ? 'Қараңғы тақырып' : 'Ашық тақырып'}
              aria-label="Тақырыпты ауыстыру"
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            >
              <Icon name={theme === 'light' ? 'moon' : 'sun'} />
            </button>
            <button className="icon-btn" title="Шығу" aria-label="Шығу" onClick={logout}>
              <Icon name="logout" />
            </button>
          </div>
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}

export function PageHeader({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <header className="page-head">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1 className="page-title">{title}</h1>
      </div>
      {children && <div className="page-head__actions">{children}</div>}
    </header>
  )
}
