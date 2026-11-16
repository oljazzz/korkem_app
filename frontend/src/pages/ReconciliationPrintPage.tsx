import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { api } from '../api'
import type { Reconciliation, ReconciliationEntry } from '../api/types'
import { Alert } from '../components/Alert'
import { DateInput } from '../components/DateInput'
import { Icon } from '../components/Icon'
import { fmtDate, fmtMoney } from '../lib/format'
import { useSettings } from '../lib/settings'
import { SHEET_WIDTH, useFitScale } from '../lib/useFitScale'

/**
 * Reconciliation statement (акт сверки, A4 portrait): the balance at the start of the period, every
 * invoice and payment, and the balance at the end, with empty columns for the client's own figures.
 * The client signs it and returns it; "Print / PDF" also saves it as a PDF to send.
 * The period lives in the URL (?from=&to=), so the page can be reopened as it was.
 */
export function ReconciliationPrintPage() {
  const { id } = useParams()
  const { t } = useTranslation()
  const { company } = useSettings()
  const [params, setParams] = useSearchParams()
  const [act, setAct] = useState<Reconciliation | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [zoom, attachSheet] = useFitScale(SHEET_WIDTH)
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''

  useEffect(() => {
    let alive = true
    api.clients.reconciliation(Number(id), from || null, to || null)
      .then((a) => {
        if (!alive) return
        setAct(a)
        setError(null)
      })
      .catch((e: Error) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [id, from, to])

  const setPeriod = (key: 'from' | 'to', value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const shownFrom = from || act?.from || ''
  const shownTo = to || act?.to || ''
  const clientName = act?.client.name ?? ''

  return (
    <section className="page">
      <div className="print-actions no-print">
        <Link className="btn btn--ghost" to={`/clients/${id}`}>
          <Icon name="back" />
          {t('act.back')}
        </Link>
        <div className="daterange" role="group" aria-label={t('period.group')}>
          <DateInput value={shownFrom} max={shownTo || undefined} ariaLabel={t('period.from')} onChange={(v) => setPeriod('from', v)} />
          <span aria-hidden="true">—</span>
          <DateInput value={shownTo} min={shownFrom || undefined} ariaLabel={t('period.to')} onChange={(v) => setPeriod('to', v)} />
        </div>
        <button className="btn btn--primary" onClick={() => window.print()} disabled={!act}>
          <Icon name="print" />
          {t('invoicePrint.print')}
        </button>
        <span className="muted">{t('invoicePrint.paper')}</span>
      </div>

      {error && <Alert onClose={() => setError(null)}>{error}</Alert>}
      {!act && !error && <p className="muted">{t('common.loading')}</p>}

      <style>{'@media print { @page { size: A4 portrait; margin: 10mm; } }'}</style>
      {act && (
        <div className="nak-scroll" ref={attachSheet}>
          <article className="nak act" style={{ zoom }} lang="kk">
            <h1 className="nak__title act__title">{t('act.title')}</h1>
            <p className="act__period">{t('act.period', { from: fmtDate(act.from), to: fmtDate(act.to) })}</p>
            <p className="act__parties">
              {t('act.parties', { company: companyLabel(company.name, company.bin), client: clientName })}
            </p>

            <table className="nak__table act__table">
              <colgroup>
                <col style={{ width: 78 }} />
                <col />
                <col style={{ width: 96 }} />
                <col style={{ width: 96 }} />
                <col style={{ width: 84 }} />
                <col style={{ width: 84 }} />
              </colgroup>
              <thead>
                <tr>
                  <th colSpan={4}>{t('act.ourSide', { name: company.name })}</th>
                  <th colSpan={2}>{t('act.theirSide', { name: clientName })}</th>
                </tr>
                <tr>
                  <th>{t('act.date')}</th>
                  <th>{t('act.document')}</th>
                  <th>{t('act.debit')}</th>
                  <th>{t('act.credit')}</th>
                  <th>{t('act.debit')}</th>
                  <th>{t('act.credit')}</th>
                </tr>
              </thead>
              <tbody>
                <BalanceRow label={t('act.opening', { date: fmtDate(act.from) })} amount={act.opening} />
                {act.entries.length === 0 && (
                  <tr><td colSpan={6} className="c act__empty">{t('act.noEntries')}</td></tr>
                )}
                {act.entries.map((e, i) => (
                  <tr key={`${e.kind}-${e.invoiceId}-${i}`}>
                    <td className="c">{fmtDate(e.date)}</td>
                    <td>{entryText(e, t)}</td>
                    <td className="n">{e.debit ? fmtMoney(e.debit) : ''}</td>
                    <td className="n">{e.credit ? fmtMoney(e.credit) : ''}</td>
                    <td />
                    <td />
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>{t('act.turnover')}</td>
                  <td className="n">{fmtMoney(act.debit)}</td>
                  <td className="n">{fmtMoney(act.credit)}</td>
                  <td />
                  <td />
                </tr>
                <BalanceRow label={t('act.closing', { date: fmtDate(act.to) })} amount={act.closing} />
              </tfoot>
            </table>

            <p className="act__result">
              {act.closing > 0 ? t('act.resultClientOwes', { date: fmtDate(act.to), client: clientName, company: company.name, amount: fmtMoney(act.closing) })
                : act.closing < 0 ? t('act.resultWeOwe', { date: fmtDate(act.to), client: clientName, company: company.name, amount: fmtMoney(-act.closing) })
                  : t('act.resultSettled', { date: fmtDate(act.to) })}
            </p>

            <div className="act__signs">
              <div>
                <p className="act__side">{t('act.from', { name: company.name })}</p>
                <Sign role={t('act.chiefAccountant')} name={company.chiefAccountant} />
                <p className="act__stamp">{t('act.stamp')}</p>
              </div>
              <div>
                <p className="act__side">{t('act.from', { name: clientName })}</p>
                <Sign role={t('act.signature')} />
                <p className="act__stamp">{t('act.stamp')}</p>
              </div>
            </div>
          </article>
        </div>
      )}
    </section>
  )
}

/** A balance goes to the debit side when the client owes (zero too), to the credit side when we do. */
function BalanceRow({ label, amount }: { label: string; amount: number }) {
  return (
    <tr className="act__balance">
      <td colSpan={2}>{label}</td>
      <td className="n">{amount >= 0 ? fmtMoney(amount) : ''}</td>
      <td className="n">{amount < 0 ? fmtMoney(-amount) : ''}</td>
      <td />
      <td />
    </tr>
  )
}

function entryText(e: ReconciliationEntry, t: TFunction) {
  if (e.kind === 'INVOICE' && e.legacyPaid) return t('act.legacyInvoice', { number: e.invoiceNumber })
  return e.kind === 'INVOICE'
    ? t('act.invoice', { number: e.invoiceNumber })
    : t('act.payment', { number: e.invoiceNumber, method: e.method ? t(`paymentMethod.${e.method}`) : '' })
}

function companyLabel(name: string, bin: string | null) {
  return bin ? `${name} (БСН ${bin})` : name
}

function Sign({ role, name }: { role: string; name?: string | null }) {
  return (
    <div className="nak__sign">
      <span>{role}:</span>
      <span className="nak__line">{name}</span>
    </div>
  )
}
