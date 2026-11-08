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

const NAV: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/', label: 'Главная', icon: 'home', end: true },
  { to: '/invoices', label: 'Накладные', icon: 'invoice' },
  { to: '/reports', label: 'Отчёты', icon: 'report' },
  { to: '/products', label: 'Прайс-лист', icon: 'tag' },
  { to: '/categories', label: 'Категории', icon: 'folder' },
  { to: '/clients', label: 'Клиенты', icon: 'client' },
  { to: '/users', label: 'Пользователи', icon: 'users' },
]

export function Layout() {
  const { user, logout } = useAuth()
  const [theme, setTheme] = useState<Theme>(readTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('korkem_theme', theme)
    } catch {
      /* браузер сақтауға рұқсат бермесе — елемейміз */
    }
  }, [theme])

  return (
    <div className="shell">
      <aside className="rail">
        <NavLink to="/" className="rail__brand" aria-label="Көркем — главная">
          <Logo size={38} />
          <span className="rail__name">
            Көркем
            <small>учёт продаж</small>
          </span>
        </NavLink>

        <nav className="rail__nav" aria-label="Разделы">
          {NAV.map((n) => (
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
              <small>Алматы · GMT+6</small>
            </span>
          </div>
          <div className="rail__actions">
            <button
              className="icon-btn"
              title={theme === 'light' ? 'Тёмная тема' : 'Светлая тема'}
              aria-label="Сменить тему"
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            >
              <Icon name={theme === 'light' ? 'moon' : 'sun'} />
            </button>
            <button className="icon-btn" title="Выйти" aria-label="Выйти" onClick={logout}>
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
