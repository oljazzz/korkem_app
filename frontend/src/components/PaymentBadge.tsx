import type { PaymentStatus } from '../api/types'
import { useTranslation } from 'react-i18next'

/** Payment status pill; text plus colour, so it never relies on colour alone. */
export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const { t } = useTranslation()
  return <span className={`status status--${status.toLowerCase()}`}>{t(`paymentStatus.${status}`)}</span>
}
