import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { Alert } from './Alert'
import { Modal } from './Modal'
import { PasswordChangeForm } from './PasswordChangeForm'
import { useToast } from './Toast'

/** The signed-in user's own security: their password and their sessions on other devices. */
export function AccountModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const { user, logoutAll } = useAuth()
  const toast = useToast()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const endAll = async () => {
    try {
      await logoutAll()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <Modal title={t('account.title', { name: user?.username ?? '' })} onClose={onClose}>
      <h3 className="account__heading">{t('account.password')}</h3>
      <PasswordChangeForm autoFocus onDone={() => { onClose(); toast.show(t('password.changed')) }} />

      <h3 className="account__heading account__sessions">{t('account.sessions')}</h3>
      <p className="muted">{t('account.sessionsText')}</p>
      {error && <Alert onClose={() => setError(null)}>{error}</Alert>}
      {confirming ? (
        <div className="account__confirm">
          <button className="btn btn--danger-solid" onClick={endAll}>{t('account.endAllConfirm')}</button>
          <button className="btn btn--ghost" onClick={() => setConfirming(false)}>{t('common.cancel')}</button>
        </div>
      ) : (
        <button className="btn btn--outline" onClick={() => setConfirming(true)}>{t('account.endAll')}</button>
      )}
    </Modal>
  )
}
