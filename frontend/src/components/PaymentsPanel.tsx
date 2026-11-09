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

export interface PaymentState {
  total: number
  paid: number
  due: number
  status: PaymentStatus
  legacyPaid: boolean
}

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'CASH', label: 'Қолма-қол' },
  { value: 'CARD', label: 'Карта' },
  { value: 'TRANSFER', label: 'Аударым' },
]

/** Payments on a saved invoice: status, what is left to pay, the list, and taking a payment. */
export function PaymentsPanel({ invoiceId, state, dirty, onChanged }: {
  invoiceId: number
  state: PaymentState
  /** Unsaved line changes: the total may change, so taking money waits until they are saved. */
  dirty: boolean
  onChanged: () => void
}) {
  const isAdmin = useIsAdmin()
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
      toast.show('Төлем жойылды')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  if (state.legacyPaid) {
    return (
      <div className="panel payments">
        <div className="panel__head">
          <h2 className="card__title">Төлем</h2>
          <PaymentBadge status="PAID" />
        </div>
        <p className="muted">Бұл жүкқұжат төлемдер жүйеге енгізілгенге дейін жасалған, сондықтан төленген деп саналады.</p>
      </div>
    )
  }

  return (
    <div className="panel payments">
      <div className="panel__head">
        <h2 className="card__title">Төлем</h2>
        <PaymentBadge status={state.status} />
      </div>
      <div className="payments__summary">
        <div><span>Сомасы</span><b>{fmtMoney(state.total)} ₸</b></div>
        <div><span>Төленді</span><b>{fmtMoney(state.paid)} ₸</b></div>
        <div className={state.due > 0 ? 'is-due' : ''}><span>Қалды</span><b>{fmtMoney(state.due)} ₸</b></div>
        {state.due > 0 && (
          <button className="btn btn--primary payments__add" onClick={() => setAdding(true)} disabled={dirty}
            title={dirty ? 'Алдымен жүкқұжатты сақтаңыз' : undefined}>
            <Icon name="wallet" />Төлем қабылдау
          </button>
        )}
      </div>
      {dirty && state.due > 0 && <p className="muted payments__hint">Төлем қабылдау үшін алдымен өзгерістерді сақтаңыз.</p>}
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
                    <button className="icon-btn icon-btn--danger" title="Жою" aria-label={`${fmtDate(p.paidOn)} төлемін жою`}
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
            toast.show(`${fmtMoney(p.amount)} ₸ төлем қабылданды`)
          }}
        />
      )}
      {deleting && (
        <ConfirmModal
          title="Төлемді жою"
          text={`${fmtDate(deleting.paidOn)} күнгі ${fmtMoney(deleting.amount)} ₸ төлем жойылсын ба?`}
          confirmLabel="Жою"
          cancelLabel="Болдырмау"
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
  const [amount, setAmount] = useState(String(due))
  const [paidOn, setPaidOn] = useState(today)
  const [method, setMethod] = useState<PaymentMethod>('CASH')
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  const save = async () => {
    const a = parseNum(amount)
    if (a === null || a <= 0) return setErrors({ amount: 'Соманы енгізіңіз' })
    if (a > due) return setErrors({ amount: `Қалған қарыздан (${fmtMoney(due)} ₸) аспауы керек` })
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
      title="Төлем қабылдау"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn--primary" onClick={save} disabled={busy}>Қабылдау</button>
          <button className="btn btn--ghost" onClick={onClose}>Болдырмау</button>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); save() }}>
        <Field label="Сомасы, ₸" required error={errors.amount}>
          <input className="input num-input" inputMode="decimal" autoFocus value={amount}
            onChange={(e) => setAmount(e.target.value)} onFocus={(e) => e.target.select()} />
          <span className="field__hint">Қалған қарыз: {fmtMoney(due)} ₸</span>
        </Field>
        <Field label="Күні">
          <DateInput value={paidOn} max={today} clearable={false} ariaLabel="Төлем күні" onChange={(v) => v && setPaidOn(v)} />
        </Field>
        <Field label="Төлем тәсілі">
          <div className="chips" role="radiogroup" aria-label="Төлем тәсілі">
            {METHODS.map((m) => (
              <button key={m.value} type="button" role="radio" aria-checked={method === m.value}
                className={`chip ${method === m.value ? 'is-active' : ''}`} onClick={() => setMethod(m.value)}>
                {m.label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Ескертпе" error={errors.note}>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {errors._ && <Alert>{errors._}</Alert>}
        <button hidden />
      </form>
    </Modal>
  )
}
