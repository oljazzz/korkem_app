import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import type { Client, Invoice, InvoiceLine } from '../api/types'
import { Alert } from '../components/Alert'
import { Icon } from '../components/Icon'
import { fmt, fmtDate, fmtMoney } from '../lib/format'
import { useSettings } from '../lib/settings'
import { useTranslation } from 'react-i18next'

/**
 * Printed invoice (A4 portrait), laid out like the paper invoices the business already uses:
 * who it is for, the manager, and one table with weight, quantity, price and sum.
 * On screen the sheet is scaled down to fit the available width.
 */
export function InvoicePrintPage() {
  const { id } = useParams()
  const { company } = useSettings()
  const { t } = useTranslation()
  const [inv, setInv] = useState<Invoice | null>(null)
  const [client, setClient] = useState<Client | null>(null)
  const [error, setError] = useState<string | null>(null)
  const scale = useFitScale(SHEET_WIDTH)

  useEffect(() => {
    api.invoices.get(Number(id))
      .then((i) => {
        setInv(i)
        if (i.clientId) api.clients.get(i.clientId).then(setClient).catch(() => undefined)
      })
      .catch((e: Error) => setError(e.message))
  }, [id])

  if (error) return <section className="page"><Alert>{error}</Alert></section>
  if (!inv) return <section className="page"><p className="muted">{t('common.loading')}</p></section>

  const qty = inv.lines.reduce((s, l) => s + l.quantity, 0)
  const weights = inv.lines.map(lineWeight)
  const totalKg = weights.reduce((s, w) => s + (w?.unit === 'KG' ? w.value : 0), 0)
  const totalL = weights.reduce((s, w) => s + (w?.unit === 'L' ? w.value : 0), 0)
  const totalWeight = [totalKg && `${fmtWeight(totalKg)} ${t('unit.kg')}`, totalL && `${fmtWeight(totalL)} ${t('unit.l')}`].filter(Boolean).join(' + ')

  return (
    <section className="page">
      <div className="print-actions no-print">
        <Link className="btn btn--ghost" to={`/invoices/${inv.id}`}>
          <Icon name="back" />
          {t('invoicePrint.back')}
        </Link>
        <button className="btn btn--primary" onClick={() => window.print()}>
          <Icon name="print" />
          {t('invoicePrint.print')}
        </button>
        <span className="muted">{t('invoicePrint.paper')}</span>
      </div>

      <style>{'@media print { @page { size: A4 portrait; margin: 10mm; } }'}</style>
      <div className="nak-scroll" ref={scale.ref}>
        <article className="nak" style={{ zoom: scale.value }} lang="kk">
          <div className="nak__frame">
          <h1 className="nak__title">{t('invoicePrint.title', { number: inv.number, date: fmtDate(inv.createdAt) })}</h1>

          <div className="nak__info">
            <dl>
              <Info label={t('invoicePrint.to')} value={client?.name ?? inv.clientLabel ?? inv.clientName} />
              <Info label={t('invoicePrint.address')} value={client?.place ?? client?.city} />
              <Info label={t('invoicePrint.phone')} value={client?.phone} />
              <Info label={t('invoicePrint.contact')} />
            </dl>
            <dl>
              <Info label={t('invoicePrint.manager')} value={inv.createdBy} />
              <Info label={t('invoicePrint.phone')} value={company.phone} />
              <Info label={t('invoicePrint.forwarder')} />
            </dl>
          </div>

          <table className="nak__table">
            <colgroup>
              <col style={{ width: 36 }} />
              <col />
              <col style={{ width: 88 }} />
              <col style={{ width: 70 }} />
              <col style={{ width: 52 }} />
              <col style={{ width: 84 }} />
              <col style={{ width: 104 }} />
            </colgroup>
            <thead>
              <tr>
                <th>№</th>
                <th>{t('invoicePrint.name')}</th>
                <th>{t('invoicePrint.weight')}</th>
                <th>{t('invoicePrint.quantity')}</th>
                <th>{t('invoicePrint.unit')}</th>
                <th>{t('invoicePrint.price')}</th>
                <th>{t('invoicePrint.sum')}</th>
              </tr>
            </thead>
            <tbody>
              {inv.lines.map((l, i) => {
                const w = weights[i]
                return (
                  <tr key={l.id ?? i}>
                    <td className="c">{i + 1}</td>
                    <td>{l.productName}</td>
                    <td className="c">{w ? `${fmtWeight(w.value)} ${w.unit === 'KG' ? t('unit.kg') : t('unit.l')}` : ''}</td>
                    <td className="n">{fmt(l.quantity)}</td>
                    <td className="c">{l.unitLabel ?? t('invoicePrint.pieces')}</td>
                    <td className="n">{fmtMoney(l.quantity ? l.total / l.quantity : l.price)}</td>
                    <td className="n">{fmtMoney(l.total)}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td />
                <td>{t('invoicePrint.total')}</td>
                <td className="c">{totalWeight}</td>
                <td className="n">{fmt(qty)}</td>
                <td colSpan={3} className="n">{fmtMoney(inv.total)} ₸</td>
              </tr>
            </tfoot>
          </table>

          <div className="nak__signs">
            <Sign role={t('invoicePrint.released')} name={company.releaseAllowedBy} />
            <Sign role={t('invoicePrint.received')} />
          </div>
          </div>
        </article>
      </div>
    </section>
  )
}

/** A4 portrait at 96 dpi. */
const SHEET_WIDTH = 794

/**
 * Weight of a line: goods sold by the kilo or litre weigh their quantity; pieces weigh
 * their pack size times the quantity (24 × 0,1 л = 2,4 л). Unknown when the product has no pack size.
 */
function lineWeight(l: InvoiceLine): { value: number; unit: 'KG' | 'L' } | null {
  if (l.unit === 'KG') return { value: l.quantity, unit: 'KG' }
  if (l.unit === 'L') return { value: l.quantity, unit: 'L' }
  if (!l.packAmount || !l.packUnit) return null
  return { value: l.packAmount * l.quantity, unit: l.packUnit }
}

/** Weight with at most two decimals: 0,6 · 2,4 · 26,4 · 1 250. */
function fmtWeight(v: number) {
  return fmt(Math.round(v * 100) / 100)
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="nak__row">
      <dt>{label}:</dt>
      <dd>{value ?? ''}</dd>
    </div>
  )
}

function Sign({ role, name }: { role: string; name?: string | null }) {
  return (
    <div className="nak__sign">
      <span>{role}:</span>
      <span className="nak__line">{name}</span>
    </div>
  )
}

/** Zoom factor that fits a sheet of the given width into its container (never enlarges). */
function useFitScale(width: number) {
  // Callback ref: the container mounts only after the invoice has loaded
  const [el, ref] = useState<HTMLDivElement | null>(null)
  const [value, setValue] = useState(1)
  useEffect(() => {
    if (!el) return
    const update = () => setValue(Math.min(1, el.clientWidth / width))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [el, width])
  return { ref, value }
}
