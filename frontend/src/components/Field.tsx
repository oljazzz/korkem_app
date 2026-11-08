import type { ReactNode } from 'react'

export function Field({ label, required, error, children }: {
  label: string
  required?: boolean
  error?: string
  children: ReactNode
}) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <span className="field__control">
        {children}
        {required && <span className="field__req" title="Міндетті өріс">*</span>}
        {error && <span className="field__error">{error}</span>}
      </span>
    </label>
  )
}
