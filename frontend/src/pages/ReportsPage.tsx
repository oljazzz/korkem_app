import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api'
import type { SalesReport } from '../api/types'
import { AsyncSelect, type Option } from '../components/AsyncSelect'
import { DateInput } from '../components/DateInput'
import { Alert } from '../components/Alert'
import { Icon } from '../components/Icon'
import { PageHeader } from '../components/Layout'
import { SkeletonRows } from '../components/Skeleton'
import { fmtDate, fmtMoney, isoDay } from '../lib/format'
import { useSettings } from '../lib/settings'

type SortKey = 'total' | 'quantity' | 'productName'

/**
 * "Sold products" report, as in the legacy system: total quantity and amount per product,
 * for a period / client or for invoices ticked on the invoices page.
 */
export function ReportsPage() {
  const [params, setParams] = useSearchParams()
  const invoiceIds = params.get('invoiceIds') ?? ''
  const today = isoDay(new Date())
  const [from, setFrom] = useState(params.get('from') ?? `${today.slice(0, 8)}01`)
  const [to, setTo] = useState(params.get('to') ?? today)
  const [client, setClient] = useState<Option | null>(null)
  const [report, setReport] = useState<SalesReport | null>(null)
  const { company, vatRate } = useSettings()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<SortKey>('total')
  const [q, setQ] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const req = invoiceIds ? { invoiceIds } : { from, to, clientId: client?.id ?? null }
    api.reports
      .sales(req)
      .then((r) => {
        if (!cancelled) {
          setReport(r)
          setError(null)
        }
      })
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [from, to, client, invoiceIds])

  const rows = useMemo(() => {
    const list = (report?.rows ?? []).filter((r) => !q || r.productName.toLowerCase().includes(q.toLowerCase()))
    return [...list].sort((a, b) =>
      sort === 'productName' ? a.productName.localeCompare(b.productName, 'kk') : b[sort] - a[sort],
    )
  }, [report, sort, q])

  const subtitle = invoiceIds
    ? `Белгіленген жүкқұжаттар бойынша: ${report?.invoiceCount ?? '…'}`
    : `Кезең: ${fmtDate(from)} — ${fmtDate(to)}${client ? ` · ${client.label}` : ''}`

  const quick = (days: number | 'month' | 'year') => {
    if (days === 'month') setFrom(`${today.slice(0, 8)}01`)
    else if (days === 'year') setFrom(`${today.slice(0, 5)}01-01`)
    else setFrom(isoDay(new Date(Date.now() - (days - 1) * 86400000)))
    setTo(today)
  }

  const downloadCsv = () => {
    if (!report) return
    const esc = (v: string | number | null) => {
      let s = v === null ? '' : typeof v === 'number' ? String(v).replace('.', ',') : v
      // Neutralize spreadsheet formulas in text cells (CSV injection)
      if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const lines = [
      ['Сатылған тауарлар есебі'],
      [company.name],
      [subtitle],
      [],
      ['№', 'Тауар атауы', 'Санат', 'Бірлік бағасы', 'Саны', 'Барлығы', 'оның ішінде ҚҚС', 'Жүкқұжаттар'],
      ...rows.map((r, i) => [i + 1, r.productName, r.categoryName ?? '', r.avgPrice, r.quantity, r.total, r.vat, r.invoices]),
      [],
      ['', 'Жалпы саны мен сомасы', '', '', report.totalQuantity, report.total, report.vat, report.invoiceCount],
    ]
    const csv = '﻿' + lines.map((l) => l.map((c) => esc(c as string | number)).join(';')).join('\r\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    a.download = `Сатылған тауарлар ${invoiceIds ? 'таңдау' : `${from}_${to}`}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <section className="page report">
      <PageHeader eyebrow="Есептер" title="Тауарлар бойынша сатылым">
        <button className="btn btn--ghost" onClick={downloadCsv} disabled={!report || rows.length === 0}
          title="Excel-де ашылатын CSV файлы">
          <Icon name="download" />
          CSV жүктеу
        </button>
        <button className="btn btn--primary" onClick={() => window.print()} disabled={!report}>
          <Icon name="print" />
          Басып шығару
        </button>
      </PageHeader>

      <div className="filters no-print">
        {invoiceIds ? (
          <div className="selection-bar">
            Белгіленген жүкқұжаттар бойынша есеп ({report?.invoiceCount ?? '…'})
            <button className="link-btn" onClick={() => setParams({})}>Кезең есебіне өту</button>
          </div>
        ) : (
          <>
            <div className="chips">
              <button className="chip" onClick={() => quick(1)}>Бүгін</button>
              <button className="chip" onClick={() => quick(7)}>7 күн</button>
              <button className="chip" onClick={() => quick('month')}>Осы ай</button>
              <button className="chip" onClick={() => quick('year')}>Осы жыл</button>
            </div>
            <div className="daterange">
              <DateInput value={from} max={to} clearable={false} ariaLabel="Басталу күні" onChange={(v) => v && setFrom(v)} />
              <span aria-hidden="true">—</span>
              <DateInput value={to} min={from} clearable={false} ariaLabel="Аяқталу күні" onChange={(v) => v && setTo(v)} />
            </div>
            <div className="filters__client">
              <AsyncSelect
                value={client}
                placeholder="Барлық клиенттер"
                onChange={setClient}
                load={(text) => api.clients.list({ q: text, size: 30 }).then((p) => p.items.map((c) => ({ id: c.id, label: c.displayName })))}
              />
            </div>
          </>
        )}
      </div>

      {error && <Alert onClose={() => setError(null)}>{error}</Alert>}

      {/* Print header, as in the legacy report template */}
      <div className="print-only report__print-head">
        <h1>Сатылған тауарлар есебі</h1>
        <div>{company.name}</div>
        <div>{subtitle}</div>
      </div>

      <div className={`summary ${loading ? 'is-loading' : ''}`}>
        <div className="summary__item">
          <span>Барлығы сатылды</span>
          <b>{fmtMoney(report?.total)} ₸</b>
        </div>
        <div className="summary__item">
          <span>оның ішінде ҚҚС {vatRate}%</span>
          <b>{fmtMoney(report?.vat)} ₸</b>
        </div>
        <div className="summary__item">
          <span>Саны</span>
          <b>{fmtMoney(report?.totalQuantity)} дана</b>
        </div>
        <div className="summary__item">
          <span>Жүкқұжат · позиция</span>
          <b>
            {report?.invoiceCount ?? 0} · {report?.rows.length ?? 0}
          </b>
        </div>
      </div>

      <div className="toolbar no-print">
        <label className="search toolbar__search">
          <Icon name="search" />
          <input type="search" placeholder="Есептен тауар іздеу" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <span className="muted">{subtitle}</span>
      </div>

      <div className={`table-wrap ${loading ? 'is-loading' : ''}`} aria-busy={loading}>
        <table className="table table--report">
          <thead>
            <tr>
              <th style={{ width: 48 }}>№</th>
              <SortTh k="productName" sort={sort} setSort={setSort}>Тауар атауы</SortTh>
              <th>Санат</th>
              <th className="num">Бірлік бағасы</th>
              <SortTh k="quantity" sort={sort} setSort={setSort} num>Саны</SortTh>
              <SortTh k="total" sort={sort} setSort={setSort} num>Барлығы, ₸</SortTh>
              <th className="num">оның ішінде ҚҚС</th>
              <th className="num">Жүкқ.</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 && <SkeletonRows cols={8} />}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={8} className="table__msg">Таңдалған кезеңде сатылым жоқ</td></tr>
            )}
            {rows.map((r, i) => (
              <tr key={r.productName}>
                <td className="muted-cell mono">{i + 1}</td>
                <td className="strong">{r.productName}</td>
                <td className="muted-cell">{r.categoryName}</td>
                <td className="num">{fmtMoney(r.avgPrice)}</td>
                <td className="num">{fmtMoney(r.quantity)}</td>
                <td className="num strong">{fmtMoney(r.total)}</td>
                <td className="num muted-cell">{fmtMoney(r.vat)}</td>
                <td className="num muted-cell">{r.invoices}</td>
              </tr>
            ))}
          </tbody>
          {report && rows.length > 0 && (
            <tfoot>
              <tr>
                <td />
                <td colSpan={3}>Жалпы саны мен сомасы</td>
                <td className="num">{fmtMoney(report.totalQuantity)}</td>
                <td className="num">{fmtMoney(report.total)}</td>
                <td className="num">{fmtMoney(report.vat)}</td>
                <td className="num">{report.invoiceCount}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="muted report__note no-print">
        «Бірлік бағасы» — жеңілдікті ескергендегі орташа нақты сату бағасы (барлығы ÷ саны).{' '}
        {report && `${report.rows.length} позиция.`}
      </p>
    </section>
  )
}

function SortTh({ k, sort, setSort, num, children }: {
  k: SortKey
  sort: SortKey
  setSort: (k: SortKey) => void
  num?: boolean
  children: ReactNode
}) {
  return (
    <th className={num ? 'num' : ''} aria-sort={sort === k ? (k === 'productName' ? 'ascending' : 'descending') : 'none'}>
      <button className={`th-sort ${sort === k ? 'is-active' : ''}`} onClick={() => setSort(k)}>
        {children}
        {sort === k && <Icon name={k === 'productName' ? 'arrowUp' : 'arrowDown'} size={12} />}
      </button>
    </th>
  )
}
