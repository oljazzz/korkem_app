import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import type { InvoiceListItem } from '../api/types'
import { Icon } from '../components/Icon'
import { PageHeader } from '../components/Layout'
import { ConfirmModal } from '../components/Modal'
import { Pagination } from '../components/Pagination'
import { TableState, Toolbar } from '../components/Toolbar'
import { fmtDate, fmtMoney } from '../lib/format'
import { useList } from '../lib/useList'

export function InvoicesPage() {
  const navigate = useNavigate()
  const list = useList<InvoiceListItem>((p) => api.invoices.list(p))
  const [checked, setChecked] = useState<Map<number, number>>(new Map()) // id -> number
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    setConfirm(false)
    if (!list.selected) return
    try {
      await api.invoices.remove(list.selected.id)
      list.setSelectedId(null)
      list.reload()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <section className="page">
      <PageHeader eyebrow="Продажи" title="Накладные">
        <button
          className="btn btn--outline"
          disabled={checked.size === 0}
          title="Отчет по проданным товарам по отмеченным накладным"
          onClick={() => navigate(`/reports?invoiceIds=${[...checked.keys()].join(',')}`)}
        >
          <Icon name="report" />
          Отчёт по товарам{checked.size > 0 ? ` · ${checked.size}` : ''}
        </button>
      </PageHeader>

      <Toolbar
        onCreate={() => navigate('/invoices/new')}
        onEdit={() => list.selected && navigate(`/invoices/${list.selected.id}`)}
        onDelete={() => setConfirm(true)}
        hasSelection={!!list.selected}
        search={list.q}
        onSearch={list.search}
        searchPlaceholder="Номер или клиент"
      >
        <button
          className="btn btn--ghost"
          disabled={!list.selected}
          onClick={() => list.selected && navigate(`/invoices/${list.selected.id}/print`)}
        >
          <Icon name="print" />
          Печать З-2
        </button>
      </Toolbar>

      {checked.size > 0 && (
        <div className="selection-bar">
          Отмечено накладных: <b>{checked.size}</b>
          <span className="selection-bar__nums">
            {[...checked.values()].sort((a, b) => b - a).slice(0, 12).map((n) => `№${n}`).join(', ')}
            {checked.size > 12 ? '…' : ''}
          </span>
          <button className="link-btn" onClick={() => setChecked(new Map())}>Снять отметки</button>
        </div>
      )}
      {error && <div className="alert" onClick={() => setError(null)}>{error}</div>}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th className="check">
                <input type="checkbox" aria-label="Отметить все на странице" checked={allOnPage} onChange={toggleAll} />
              </th>
              <th style={{ width: 120 }}>№</th>
              <th style={{ width: 130 }}>Дата</th>
              <th>Клиент</th>
              <th className="num" style={{ width: 170 }}>Сумма, ₸</th>
            </tr>
          </thead>
          <tbody>
            <TableState loading={list.loading} error={list.error} empty={list.data.items.length === 0} colSpan={5} />
            {list.data.items.map((i) => (
              <tr
                key={i.id}
                className={list.selected?.id === i.id ? 'is-selected' : ''}
                onClick={() => list.setSelectedId(i.id)}
                onDoubleClick={() => navigate(`/invoices/${i.id}`)}
              >
                <td className="check" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" aria-label={`Отметить №${i.number}`} checked={checked.has(i.id)} onChange={() => toggle(i)} />
                </td>
                <td className="mono strong">{i.number}</td>
                <td className="muted-cell">{fmtDate(i.createdAt)}</td>
                <td>{i.clientName}</td>
                <td className="num strong">{fmtMoney(i.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-foot">
        <Pagination page={list.page} size={list.data.size} total={list.data.total} onChange={list.setPage} />
      </div>

      {confirm && list.selected && (
        <ConfirmModal
          text={`Удалить накладную № ${list.selected.number}?`}
          onConfirm={remove}
          onClose={() => setConfirm(false)}
        />
      )}
    </section>
  )
}
