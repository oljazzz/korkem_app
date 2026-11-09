import type { PaymentStatus } from '../api/types'

const LABEL: Record<PaymentStatus, string> = { PAID: 'Төленді', PARTIAL: 'Ішінара', UNPAID: 'Төленбеген' }

/** Payment status pill; text plus colour, so it never relies on colour alone. */
export function PaymentBadge({ status }: { status: PaymentStatus }) {
  return <span className={`status status--${status.toLowerCase()}`}>{LABEL[status]}</span>
}
