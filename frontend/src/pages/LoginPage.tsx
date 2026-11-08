import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Alert } from '../components/Alert'
import { useAuth } from '../auth/AuthContext'
import { Horns, Logo } from '../components/Ornament'

export function LoginPage() {
  const { user, login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/" replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(username, password, remember)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <section className="login__art" aria-hidden="true">
        <div className="login__pattern" />
        <div className="login__brand">
          <Logo size={48} />
          <span>Көркем</span>
        </div>
        <div className="login__quote">
          <Horns width={88} strokeWidth={2.4} />
          <p>Жүкқұжаттар, баға тізімі және есептер&nbsp;— бір кітапта.</p>
        </div>
      </section>
      <form className="login__card" onSubmit={submit}>
        <div className="eyebrow">Жүйеге кіру</div>
        <h1 className="login__title">Қош келдіңіз!</h1>
        <p className="muted">Жалғастыру үшін логин мен құпиясөзді енгізіңіз.</p>
        <label className="stack">
          <span className="stack__label">Логин</span>
          <input className="input" autoComplete="username" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} />
        </label>
        <label className="stack">
          <span className="stack__label">Құпиясөз</span>
          <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Мені есте сақтау
        </label>
        {error && <Alert onClose={() => setError(null)}>{error}</Alert>}
        <button className="btn btn--primary btn--lg btn--block" disabled={busy || !username || !password}>
          {busy ? 'Кіру…' : 'Кіру'}
        </button>
      </form>
    </div>
  )
}
