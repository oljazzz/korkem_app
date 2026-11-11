import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import type { ApiError } from '../api/http'
import type { Payment, PaymentMethod, PaymentStatus } from '../api/types'
import { useIsAdmin } from '../auth/AuthContext'
import { fmtDate, fmtMoney, isoDay, parseNum } from '../lib/format'
import { Alert } from './Alert'
import { DateInput } from './DateInput'
import { Field } from './Field'
import { Icon } from './Icon'
import { ConfirmModal, Modal } from './Modal'
import { PaymentBadge } from './PaymentBadge'
import { useToast } from './Toast'
import { useTranslation } from 'react-i18next'

export interface PaymentState {
  total: number
  paid: number
  due: number
  status: PaymentStatus
  legacyPaid: boolean
}

/** Labels are in kk.json under paymentMethod.<value>. */
const METHODS: PaymentMethod[] = ['CASH', 'CARD', 'TRANSFER']

/** Payments on a saved invoice: status, what is left to pay, the list, and taking a payment. */
export function PaymentsPanel({ invoiceId, state, dirty, onChanged }: {
  invoiceId: number
  state: PaymentState
  /** Unsaved line changes: the total may change, so taking money waits until they are saved. */
  dirty: boolean
  onChanged: () => void
}) {
  const isAdmin = useIsAdmin()
  const { t } = useTranslation()
  const toast = useToast()
  const [payments, setPayments] = useState<Payment[] | null>(null)
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<Payment | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    api.payments.list(invoiceId).then(setPayments).catch((e: Error) => setError(e.message))
  }, [invoiceId])

  useEffect(() => {
    if (!state.legacyPaid) load()
  }, [load, state.legacyPaid])

  const remove = async () => {
    const p = deleting
    setDeleting(null)
    if (!p) return
    try {
      await api.payments.remove(p.id)
      load()
      onChanged()
      toast.show(t('payments.deleted'))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  if (state.legacyPaid) {
    return (
      <div className="panel payments">
        <div className="panel__head">
          <h2 className="card__title">{t('payments.title')}</h2>
          <PaymentBadge status="PAID" />
        </div>
        <p className="muted">{t('payments.legacy')}</p>
      </div>
    )
  }

  return (
    <div className="panel payments">
      <div className="panel__head">
        <h2 className="card__title">{t('payments.title')}</h2>
        <PaymentBadge status={state.status} />
      </div>
      <div className="payments__summary">
        <div><span>{t('payments.total')}</span><b>{fmtMoney(state.total)} ₸</b></div>
        <div><span>{t('payments.paid')}</span><b>{fmtMoney(state.paid)} ₸</b></div>
        <div className={state.due > 0 ? 'is-due' : ''}><span>{t('payments.due')}</span><b>{fmtMoney(state.due)} ₸</b></div>
        {state.due > 0 && (
          <button className="btn btn--primary payments__add" onClick={() => setAdding(true)} disabled={dirty}
            title={dirty ? t('payments.saveFirst') : undefined}>
            <Icon name="wallet" />{t('payments.take')}
          </button>
        )}
      </div>
      {dirty && state.due > 0 && <p className="muted payments__hint">{t('payments.saveFirstHint')}</p>}
      {error && <Alert onClose={() => setError(null)}>{error}</Alert>}
      {payments && payments.length > 0 && (
        <table className="table table--compact payments__list">
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <td>
                  <span className="strong nowrap">{fmtDate(p.paidOn)}</span>
                  <span className="cell-sub">{p.methodLabel}{p.note ? ` · ${p.note}` : ''}</span>
                </td>
                <td className="muted-cell hide-phone">{p.createdBy}</td>
                <td className="num strong">{fmtMoney(p.amount)} ₸</td>
                <td className="row-actions">
                  {isAdmin && (
                    <button className="icon-btn icon-btn--danger" title={t('common.delete')} aria-label={t('payments.deleteLabel', { date: fmtDate(p.paidOn) })}
                      onClick={() => setDeleting(p)}>
                      <Icon name="trash" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {adding && (
        <PaymentForm
          invoiceId={invoiceId}
          due={state.due}
          onClose={() => setAdding(false)}
          onSaved={(p) => {
            setAdding(false)
            load()
            onChanged()
            toast.show(t('payments.received', { amount: fmtMoney(p.amount) }))
          }}
        />
      )}
      {deleting && (
        <ConfirmModal
          title={t('payments.deleteTitle')}
          text={t('payments.deleteText', { date: fmtDate(deleting.paidOn), amount: fmtMoney(deleting.amount) })}
          confirmLabel={t('common.delete')}
          cancelLabel={t('common.cancel')}
          danger
          onConfirm={remove}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  )
}

function PaymentForm({ invoiceId, due, onClose, onSaved }: {
  invoiceId: number
  due: number
  onClose: () => void
  onSaved: (p: Payment) => void
}) {
  const [today] = useState(() => isoDay(new Date()))
  const { t } = useTranslation()
  const [amount, setAmount] = useState(String(due))
  const [paidOn, setPaidOn] = useState(today)
  const [method, setMethod] = useState<PaymentMethod>('CASH')
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  const save = async () => {
    const a = parseNum(amount)
    if (a === null || a <= 0) return setErrors({ amount: t('payments.amountRequired') })
    if (a > due) return setErrors({ amount: t('payments.amountTooBig', { due: fmtMoney(due) }) })
    setBusy(true)
    try {
      onSaved(await api.payments.add(invoiceId, { amount: a, paidOn, method, note: note || null }))
    } catch (e) {
      const err = e as ApiError
      setErrors({ ...err.fields, _: Object.keys(err.fields ?? {}).length ? '' : err.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={t('payments.take')}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn--primary" onClick={save} disabled={busy}>{t('payments.accept')}</button>
          <button className="btn btn--ghost" onClick={onClose}>{t('common.cancel')}</button>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); save() }}>
        <Field label={t('payments.amountLabel')} required error={errors.amount}>
          <input className="input num-input" inputMode="decimal" autoFocus value={amount}
            onChange={(e) => setAmount(e.target.value)} onFocus={(e) => e.target.select()} />
          <span className="field__hint">{t('payments.dueHint', { due: fmtMoney(due) })}</span>
        </Field>
        <Field label={t('payments.date')}>
          <DateInput value={paidOn} max={today} clearable={false} ariaLabel={t('payments.dateLabel')} onChange={(v) => v && setPaidOn(v)} />
        </Field>
        <Field label={t('payments.method')}>
          <div className="chips" role="radiogroup" aria-label={t('payments.method')}>
            {METHODS.map((m) => (
              <button key={m} type="button" role="radio" aria-checked={method === m}
                className={`chip ${method === m ? 'is-active' : ''}`} onClick={() => setMethod(m)}>
                {t(`paymentMethod.${m}`)}
              </button>
            ))}
          </div>
        </Field>
        <Field label={t('payments.note')} error={errors.note}>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {errors._ && <Alert>{errors._}</Alert>}
        <button hidden />
      </form>
    </Modal>
  )
}
