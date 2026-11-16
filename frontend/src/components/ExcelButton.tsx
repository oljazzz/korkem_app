import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from './Icon'
import { useToast } from './Toast'

/** Downloads an Excel file built by the server; shows progress, and the error if there is one. */
export function ExcelButton({ onExport, className = 'btn btn--ghost', disabled, title }: {
  onExport: () => Promise<void>
  className?: string
  disabled?: boolean
  title?: string
}) {
  const { t } = useTranslation()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const run = async () => {
    setBusy(true)
    try {
      await onExport()
    } catch (e) {
      toast.show((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <button type="button" className={className} onClick={run} disabled={disabled || busy} aria-busy={busy}
      title={title ?? t('excel.hint')}>
      <Icon name="download" />{busy ? t('excel.busy') : t('excel.label')}
    </button>
  )
}
