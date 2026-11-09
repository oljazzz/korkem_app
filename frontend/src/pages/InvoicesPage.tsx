import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import type { InvoiceListItem } from '../api/types'
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
import { fmtDate, fmtMoney } from '../lib/format'
import { useList } from '../lib/useList'

export function InvoicesPage() {
  const navigate = useNavigate()
  const isAdmin = useIsAdmin()
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const clientId = Number(searchParams.get('client')) || null
  const [clientName, setClientName] = useState<string | null>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [dueOnly, setDueOnly] = useState(false)
  const list = useList<InvoiceListItem>((p) =>
    api.invoices.list({ ...p, from: from || null, to: to || null, clientId, dueOnly: dueOnly ? 'true' : null }),
  )

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
      toast.show(`№ ${inv.number} жүкқұжат жойылды`)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <section className="page">
      <PageHeader eyebrow="Сатылым" title="Жүкқұжаттар">
        <button
          className="btn btn--outline"
          disabled={checked.size === 0}
          title="Белгіленген жүкқұжаттар бойынша сатылған тауарлар есебі"
          onClick={() => navigate(`/reports?invoiceIds=${[...checked.keys()].join(',')}`)}
        >
          <Icon name="report" />
          Тауарлар есебі{checked.size > 0 ? ` · ${checked.size}` : ''}
        </button>
      </PageHeader>

      <Toolbar
        onCreate={() => navigate('/invoices/new')}
        createLabel="Жаңа жүкқұжат"
        search={list.q}
        onSearch={list.search}
        searchPlaceholder="Нөмір немесе клиент"
      >
        <div className="daterange" role="group" aria-label="Кезең">
          <DateInput value={from} max={to || undefined} ariaLabel="Басталу күні" onChange={(v) => setPeriod(v, to)} />
          <span aria-hidden="true">—</span>
          <DateInput value={to} min={from || undefined} ariaLabel="Аяқталу күні" onChange={(v) => setPeriod(from, v)} />
          {(from || to) && (
            <button className="btn btn--ghost btn--s" onClick={() => setPeriod('', '')}>Тазалау</button>
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
          Тек төленбегендер
        </label>
      </Toolbar>

      {clientId && (
        <div className="filter-chip-row">
          <span className="filter-chip">
            Клиент: <b>{clientName ?? '…'}</b>
            <button className="icon-btn" aria-label="Клиент сүзгісін алу" onClick={clearClient}><Icon name="close" size={16} /></button>
          </span>
        </div>
      )}

      {checked.size > 0 && (
        <div className="selection-bar">
          Белгіленген жүкқұжаттар: <b>{checked.size}</b>
          <span className="selection-bar__nums">
            {[...checked.values()].sort((a, b) => b - a).slice(0, 12).map((n) => `№${n}`).join(', ')}
            {checked.size > 12 ? '…' : ''}
          </span>
          <button className="link-btn" onClick={() => setChecked(new Map())}>Белгілерді алу</button>
        </div>
      )}
      {error && <Alert onClose={() => setError(null)}>{error}</Alert>}

      <div className={`table-wrap ${list.loading ? 'is-loading' : ''}`} aria-busy={list.loading}>
        <table className="table table--cards">
          <thead>
            <tr>
              <th className="check">
                <label className="check__hit">
                  <input type="checkbox" aria-label="Беттегінің бәрін белгілеу" checked={allOnPage} onChange={toggleAll} />
                </label>
              </th>
              <th style={{ width: 120 }}>№</th>
              <th style={{ width: 130 }}>Күні</th>
              <th>Клиент</th>
              <th style={{ width: 130 }}>Төлем</th>
              <th className="num" style={{ width: 160 }}>Сомасы, ₸</th>
              <th aria-label="Әрекеттер" style={{ width: 136 }} />
            </tr>
          </thead>
          <tbody>
            <TableState loading={list.loading} error={list.error} empty={list.data.items.length === 0} colSpan={7} />
            {list.data.items.map((i) => (
              <tr key={i.id} {...rowProps(() => open(i), isAdmin ? () => setDeleting(i) : undefined)}>
                <td className="check">
                  <label className="check__hit">
                    <input type="checkbox" aria-label={`№${i.number} белгілеу`} checked={checked.has(i.id)} onChange={() => toggle(i)} />
                  </label>
                </td>
                <td className="mono strong" data-title>№ {i.number}</td>
                <td className="muted-cell" data-label="Күні">{fmtDate(i.createdAt)}</td>
                <td data-label="Клиент">{i.clientName}</td>
                <td className="cell-status">
                  <PaymentBadge status={i.status} />
                  {i.status === 'PARTIAL' && <span className="cell-sub">қалды {fmtMoney(i.due)} ₸</span>}
                </td>
                <td className="num strong cell-amount">{fmtMoney(i.total)} ₸</td>
                <RowActions
                  name={`№ ${i.number}`}
                  onEdit={() => open(i)}
                  onDelete={isAdmin ? () => setDeleting(i) : undefined}
                >
                  <button className="icon-btn" title="Қ-2 басып шығару" aria-label={`№ ${i.number} — Қ-2 басып шығару`}
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
          title="Жүкқұжатты жою"
          text={`№ ${deleting.number} жүкқұжатты жою керек пе? Бұл әрекетті қайтару мүмкін емес.`}
          confirmLabel="Жою"
          cancelLabel="Болдырмау"
          danger
          onConfirm={remove}
          onClose={() => setDeleting(null)}
        />
      )}
    </section>
  )
}
