import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import type { InvoiceListItem, InvoiceSummary } from '../api/types'
import { useIsAdmin } from '../auth/AuthContext'
import { Alert } from '../components/Alert'
import { DateInput } from '../components/DateInput'
import { Icon } from '../components/Icon'
import { PageHeader } from '../components/Layout'
import { ConfirmModal } from '../components/Modal'
import { Pagination } from '../components/Pagination'
import { PaymentBadge } from '../components/PaymentBadge'
import { RowActions, rowProps } from '../components/RowActions'
import { useToast } from '../components/Toast'
import { TableState, Toolbar } from '../components/Toolbar'
import { fmt, fmtDate, fmtMoney } from '../lib/format'
import { useList } from '../lib/useList'
import { useTranslation } from 'react-i18next'

export function InvoicesPage() {
  const navigate = useNavigate()
  const isAdmin = useIsAdmin()
  const toast = useToast()
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const clientId = Number(searchParams.get('client')) || null
  const [clientName, setClientName] = useState<string | null>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [dueOnly, setDueOnly] = useState(false)
  const [summary, setSummary] = useState<InvoiceSummary | null>(null)
  const list = useList<InvoiceListItem>((p) => {
    const filters = { q: p.q, from: from || null, to: to || null, clientId, dueOnly: dueOnly ? 'true' : null }
    // Totals for the whole filtered list, not just this page
    if (p.page === 0) api.invoices.summary(filters).then(setSummary).catch(() => setSummary(null))
    return api.invoices.list({ ...p, ...filters })
  })

  // Opened from a client card: show whose invoices these are
  useEffect(() => {
    if (!clientId) return
    let alive = true
    api.clients.get(clientId).then((c) => alive && setClientName(c.name)).catch(() => undefined)
    return () => {
      alive = false
    }
  }, [clientId])

  const clearClient = () => {
    setSearchParams({})
    setClientName(null)
    list.setPage(0)
    list.reload()
  }
  const [checked, setChecked] = useState<Map<number, number>>(new Map()) // id -> number
  const [deleting, setDeleting] = useState<InvoiceListItem | null>(null)
  const [error, setError] = useState<string | null>(null)

  const open = (i: InvoiceListItem) => navigate(`/invoices/${i.id}`)

  const setPeriod = (f: string, t: string) => {
    setFrom(f)
    setTo(t)
    list.setPage(0)
    list.reload()
  }

  const toggle = (i: InvoiceListItem) =>
    setChecked((m) => {
      const n = new Map(m)
      if (n.has(i.id)) n.delete(i.id)
      else n.set(i.id, i.number)
      return n
    })
  const pageIds = list.data.items.map((i) => i.id)
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => checked.has(id))
  const toggleAll = () =>
    setChecked((m) => {
      const n = new Map(m)
      list.data.items.forEach((i) => (allOnPage ? n.delete(i.id) : n.set(i.id, i.number)))
      return n
    })

  const remove = async () => {
    const inv = deleting
    setDeleting(null)
    if (!inv) return
    try {
      await api.invoices.remove(inv.id)
      setChecked((m) => {
        const n = new Map(m)
        n.delete(inv.id)
        return n
      })
      list.reload()
      toast.show(t('invoices.deleted', { number: inv.number }))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <section className="page">
      <PageHeader eyebrow={t('invoices.eyebrow')} title={t('invoices.title')} />

      <Toolbar
        onCreate={() => navigate('/invoices/new')}
        createLabel={t('invoices.new')}
        search={list.q}
        onSearch={list.search}
        searchPlaceholder={t('invoices.searchPlaceholder')}
      >
        <div className="daterange" role="group" aria-label={t('period.group')}>
          <DateInput value={from} max={to || undefined} ariaLabel={t('period.from')} onChange={(v) => setPeriod(v, to)} />
          <span aria-hidden="true">—</span>
          <DateInput value={to} min={from || undefined} ariaLabel={t('period.to')} onChange={(v) => setPeriod(from, v)} />
          {(from || to) && (
            <button className="btn btn--ghost btn--s" onClick={() => setPeriod('', '')}>{t('common.clear')}</button>
          )}
        </div>
        <label className="checkbox toolbar__toggle">
          <input
            type="checkbox"
            checked={dueOnly}
            onChange={(e) => {
              setDueOnly(e.target.checked)
              list.setPage(0)
              list.reload()
            }}
          />
          {t('invoices.unpaidOnly')}
        </label>
      </Toolbar>

      {clientId && (
        <div className="filter-chip-row">
          <span className="filter-chip">
            {t('invoices.clientFilter')} <b>{clientName ?? '…'}</b>
            <button className="icon-btn" aria-label={t('invoices.clearClient')} onClick={clearClient}><Icon name="close" size={16} /></button>
          </span>
        </div>
      )}

      {checked.size > 0 && (
        <div className="selection-bar">
          {t('invoices.selected')} <b>{checked.size}</b>
          <span className="selection-bar__nums">
            {[...checked.values()].sort((a, b) => b - a).slice(0, 12).map((n) => `№${n}`).join(', ')}
            {checked.size > 12 ? '…' : ''}
          </span>
          <button className="link-btn" onClick={() => setChecked(new Map())}>{t('invoices.clearSelection')}</button>
          <button
            className="btn btn--outline btn--s"
            title={t('invoices.reportTitle')}
            onClick={() => navigate(`/reports?invoiceIds=${[...checked.keys()].join(',')}`)}
          >
            <Icon name="report" />
            {t('invoices.report')}
          </button>
        </div>
      )}
      {summary && (
        <div className="list-summary" aria-live="polite">
          <span><b>{fmt(summary.count)}</b> {t('invoices.count')}</span>
          <span>{t('invoices.sum')} <b>{fmtMoney(summary.total)} ₸</b></span>
          {summary.due > 0 && <span className="list-summary__due">{t('invoices.unpaid')} <b>{fmtMoney(summary.due)} ₸</b></span>}
        </div>
      )}
      {error && <Alert onClose={() => setError(null)}>{error}</Alert>}

      <div className={`table-wrap ${list.loading ? 'is-loading' : ''}`} aria-busy={list.loading}>
        <table className="table table--cards">
          <thead>
            <tr>
              <th className="check">
                <label className="check__hit">
                  <input type="checkbox" aria-label={t('invoices.selectAll')} checked={allOnPage} onChange={toggleAll} />
                </label>
              </th>
              <th style={{ width: 120 }}>№</th>
              <th style={{ width: 130 }}>{t('invoices.colDate')}</th>
              <th>{t('invoices.colClient')}</th>
              <th style={{ width: 130 }}>{t('invoices.colPayment')}</th>
              <th className="num" style={{ width: 160 }}>{t('invoices.colSum')}</th>
              <th aria-label={t('invoices.colActions')} style={{ width: 136 }} />
            </tr>
          </thead>
          <tbody>
            <TableState loading={list.loading} error={list.error} empty={list.data.items.length === 0} colSpan={7} />
            {list.data.items.map((i) => (
              <tr key={i.id} {...rowProps(() => open(i), isAdmin ? () => setDeleting(i) : undefined)}>
                <td className="check">
                  <label className="check__hit">
                    <input type="checkbox" aria-label={t('invoices.selectOne', { number: i.number })} checked={checked.has(i.id)} onChange={() => toggle(i)} />
                  </label>
                </td>
                <td className="mono strong" data-title>№ {i.number}</td>
                <td className="muted-cell" data-label={t('invoices.colDate')}>{fmtDate(i.createdAt)}</td>
                <td data-label={t('invoices.colClient')}>
                  <span className="strong">{i.clientName}</span>
                  {i.clientPlace && <span className="cell-sub">{i.clientPlace}</span>}
                </td>
                <td className="cell-status">
                  <PaymentBadge status={i.status} />
                  {i.status === 'PARTIAL' && <span className="cell-sub">{t('invoices.due', { amount: fmtMoney(i.due) })}</span>}
                </td>
                <td className="num strong cell-amount">{fmtMoney(i.total)} ₸</td>
                <RowActions
                  name={`№ ${i.number}`}
                  onEdit={() => open(i)}
                  onDelete={isAdmin ? () => setDeleting(i) : undefined}
                >
                  <button className="icon-btn" title={t('invoices.print')} aria-label={t('invoices.printLabel', { number: i.number })}
                    onClick={() => navigate(`/invoices/${i.id}/print`)}>
                    <Icon name="print" />
                  </button>
                </RowActions>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-foot">
        <Pagination page={list.page} size={list.data.size} total={list.data.total} onChange={list.setPage} />
      </div>

      {deleting && (
        <ConfirmModal
          title={t('invoices.deleteTitle')}
          text={t('invoices.deleteText', { number: deleting.number })}
          confirmLabel={t('common.delete')}
          cancelLabel={t('common.cancel')}
          danger
          onConfirm={remove}
          onClose={() => setDeleting(null)}
        />
      )}
    </section>
  )
}
