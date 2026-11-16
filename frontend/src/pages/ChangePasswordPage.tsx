import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { Logo } from '../components/Ornament'
import { PasswordChangeForm } from '../components/PasswordChangeForm'

/**
 * Shown instead of the app while the password is one an admin set: only the user should know it.
 * The server refuses every other request until then.
 */
export function ChangePasswordPage() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  return (
    <div className="forced-password">
      <div className="login__card">
        <Logo size={40} />
        <div className="eyebrow">{t('password.forcedEyebrow', { name: user?.username ?? '' })}</div>
        <h1 className="login__title">{t('password.forcedTitle')}</h1>
        <p className="muted">{t('password.forcedIntro')}</p>
        {/* Keyed so the form starts empty for each user */}
        <PasswordChangeForm key={user?.id} autoFocus currentLabel={t('password.temporary')} onDone={() => undefined} />
        <button className="btn btn--ghost" onClick={logout}>{t('auth.logout')}</button>
      </div>
    </div>
  )
}
