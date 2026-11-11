import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

export function Field({ label, required, error, children }: {
  label: string
  required?: boolean
  error?: string
  children: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <span className="field__control">
        {children}
        {required && <span className="field__req" title={t('common.requiredField')}>*</span>}
        {error && <span className="field__error">{error}</span>}
      </span>
    </label>
  )
}
