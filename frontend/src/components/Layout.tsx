import { useEffect, useRef, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { Icon, type IconName } from './Icon'
import { Logo } from './Ornament'
import { useTranslation } from 'react-i18next'

type Theme = 'light' | 'dark'

function readTheme(): Theme {
  try {
    return localStorage.getItem('korkem_theme') === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

type NavItem = { to: string; label: NavKey; short?: NavKey; icon: IconName; end?: boolean; adminOnly?: boolean; tab?: boolean }

type NavKey = 'nav.home' | 'nav.homeShort' | 'nav.invoices' | 'nav.invoicesShort' | 'nav.reports' | 'nav.products' | 'nav.clients' | 'nav.users' | 'nav.settings'

// `tab` items sit in the phone tab bar; the rest go under «Тағы». Labels are kk.json keys.
const NAV: NavItem[] = [
  { to: '/', label: 'nav.home', short: 'nav.homeShort', icon: 'home', end: true, tab: true },
  { to: '/invoices', label: 'nav.invoices', short: 'nav.invoicesShort', icon: 'invoice', tab: true },
  { to: '/reports', label: 'nav.reports', icon: 'report', tab: true },
  { to: '/products', label: 'nav.products', icon: 'tag' },
  { to: '/clients', label: 'nav.clients', icon: 'client', tab: true },
  { to: '/users', label: 'nav.users', icon: 'users', adminOnly: true },
  { to: '/settings', label: 'nav.settings', icon: 'settings', adminOnly: true },
]


export function Layout() {
  const { user, logout } = useAuth()
  const { t } = useTranslation()
  const [theme, setTheme] = useState<Theme>(readTheme)
  const nav = NAV.filter((n) => !n.adminOnly || user?.role === 'ADMIN')
  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light')

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
        <NavLink to="/" className="rail__brand" aria-label={t('app.homeLink')}>
          <Logo size={38} />
          <span className="rail__name">
            {t('app.name')}
            <small>{t('app.tagline')}</small>
          </span>
        </NavLink>

        <nav className="rail__nav" aria-label={t('nav.sections')}>
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) => `rail__link ${isActive ? 'is-active' : ''}`}
            >
              <Icon name={n.icon} />
              <span>{t(n.label)}</span>
            </NavLink>
          ))}
        </nav>

        <div className="rail__foot">
          <div className="rail__user">
            <span className="avatar">{user?.username.slice(0, 1).toUpperCase()}</span>
            <span className="rail__who">
              {user?.firstName || user?.username}
              <small>{user ? t(`role.${user.role}`) : ''} · {t('app.city')}</small>
            </span>
          </div>
          <div className="rail__actions">
            <button
              className="icon-btn"
              title={theme === 'light' ? t('theme.dark') : t('theme.light')}
              aria-label={t('theme.toggle')}
              onClick={toggleTheme}
            >
              <Icon name={theme === 'light' ? 'moon' : 'sun'} />
            </button>
            <button className="icon-btn" title={t('auth.logout')} aria-label={t('auth.logout')} onClick={logout}>
              <Icon name="logout" />
            </button>
          </div>
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>

      <TabBar items={nav} theme={theme} onToggleTheme={toggleTheme} onLogout={logout} />
    </div>
  )
}

/** Phone navigation: four main sections at the bottom, the rest (and account actions) under «Тағы». */
function TabBar({ items, theme, onToggleTheme, onLogout }: {
  items: NavItem[]
  theme: Theme
  onToggleTheme: () => void
  onLogout: () => void
}) {
  const [open, setOpen] = useState(false)
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const sheetRef = useRef<HTMLDivElement>(null)
  const more = items.filter((n) => !n.tab)
  const moreActive = more.some((n) => pathname.startsWith(n.to))

  // Close the sheet on Escape or a tap outside it (links close it themselves)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onDown = (e: PointerEvent) => {
      if (!sheetRef.current?.contains(e.target as Node) && !(e.target as Element).closest('.tabbar__more')) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [open])

  return (
    <>
      {open && (
        <div ref={sheetRef} className="tabbar__sheet" id="tabbar-more" role="menu" aria-label={t('nav.moreSections')}>
          {more.map((n) => (
            <NavLink key={n.to} to={n.to} role="menuitem" onClick={() => setOpen(false)} className={({ isActive }) => `tabbar__sheet-link ${isActive ? 'is-active' : ''}`}>
              <Icon name={n.icon} />
              {t(n.label)}
            </NavLink>
          ))}
          <button type="button" role="menuitem" className="tabbar__sheet-link" onClick={onToggleTheme}>
            <Icon name={theme === 'light' ? 'moon' : 'sun'} />
            {theme === 'light' ? t('theme.dark') : t('theme.light')}
          </button>
          <button type="button" role="menuitem" className="tabbar__sheet-link" onClick={() => { setOpen(false); onLogout() }}>
            <Icon name="logout" />
            {t('auth.logout')}
          </button>
        </div>
      )}
      <nav className="tabbar" aria-label={t('nav.sections')}>
        {items.filter((n) => n.tab).map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setOpen(false)} className={({ isActive }) => `tabbar__link ${isActive ? 'is-active' : ''}`}>
            <Icon name={n.icon} size={22} />
            <span>{t(n.short ?? n.label)}</span>
          </NavLink>
        ))}
        <button
          type="button"
          className={`tabbar__link tabbar__more ${moreActive || open ? 'is-active' : ''}`}
          aria-expanded={open}
          aria-controls="tabbar-more"
          onClick={() => setOpen((v) => !v)}
        >
          <Icon name="more" size={22} />
          <span>{t('nav.more')}</span>
        </button>
      </nav>
    </>
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
