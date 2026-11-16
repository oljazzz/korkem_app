import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { Alert } from './Alert'

/** The current password, then the new one twice. The server checks the rules; the hint lists them. */
export function PasswordChangeForm({ onDone, autoFocus, currentLabel }: {
  onDone: () => void
  autoFocus?: boolean
  /** Label of the first field, when it is not the user's own password (a temporary one). */
  currentLabel?: string
}) {
  const { t } = useTranslation()
  const { changePassword } = useAuth()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const mismatch = repeat !== '' && next !== repeat

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (mismatch) return
    setBusy(true)
    setError(null)
    try {
      await changePassword(current, next)
      onDone()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="password-form" onSubmit={submit}>
      <label className="stack">
        <span className="stack__label">{currentLabel ?? t('password.current')}</span>
        <input className="input" type="password" autoComplete="current-password" autoFocus={autoFocus}
          value={current} onChange={(e) => setCurrent(e.target.value)} />
      </label>
      <label className="stack">
        <span className="stack__label">{t('password.new')}</span>
        <input className="input" type="password" autoComplete="new-password" aria-describedby="password-rules"
          value={next} onChange={(e) => setNext(e.target.value)} />
        <span className="field__hint" id="password-rules">{t('password.rules')}</span>
      </label>
      <label className="stack">
        <span className="stack__label">{t('password.repeat')}</span>
        <input className="input" type="password" autoComplete="new-password" aria-invalid={mismatch}
          value={repeat} onChange={(e) => setRepeat(e.target.value)} />
        {mismatch && <span className="field__error" role="alert">{t('password.mismatch')}</span>}
      </label>
      {error && <Alert onClose={() => setError(null)}>{error}</Alert>}
      <button className="btn btn--primary" disabled={busy || !current || !next || mismatch || next !== repeat}>
        {busy ? t('password.saving') : t('password.submit')}
      </button>
    </form>
  )
}
