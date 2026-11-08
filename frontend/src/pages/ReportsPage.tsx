import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api'
import type { Company, SalesReport } from '../api/types'
import { AsyncSelect, type Option } from '../components/AsyncSelect'
import { Icon } from '../components/Icon'
import { PageHeader } from '../components/Layout'
import { fmtDate, fmtMoney, isoDay } from '../lib/format'
import { plural } from '../lib/words'

type SortKey = 'total' | 'quantity' | 'productName'

/**
 * «Отчет по проданным товарам» — ескі жүйедегідей: тауар бойынша жалпы саны мен сомасы.
 * Кезең/клиент бойынша немесе «Накладные» бетінде белгіленген накладнойлар бойынша.
 */
export function ReportsPage() {
  const [params, setParams] = useSearchParams()
  const invoiceIds = params.get('invoiceIds') ?? ''
  const today = isoDay(new Date())
  const [from, setFrom] = useState(params.get('from') ?? `${today.slice(0, 8)}01`)
  const [to, setTo] = useState(params.get('to') ?? today)
  const [client, setClient] = useState<Option | null>(null)
  const [report, setReport] = useState<SalesReport | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<SortKey>('total')
  const [q, setQ] = useState('')

  useEffect(() => {
    api.reports.company().then(setCompany).catch(() => undefined)
  }, [])

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
      sort === 'productName' ? a.productName.localeCompare(b.productName, 'ru') : b[sort] - a[sort],
    )
  }, [report, sort, q])

  const subtitle = invoiceIds
    ? `По отмеченным накладным: ${report?.invoiceCount ?? '…'}`
    : `За период ${fmtDate(from)} — ${fmtDate(to)}${client ? ` · ${client.label}` : ''}`

  const quick = (days: number | 'month' | 'year') => {
    if (days === 'month') setFrom(`${today.slice(0, 8)}01`)
    else if (days === 'year') setFrom(`${today.slice(0, 5)}01-01`)
    else setFrom(isoDay(new Date(Date.now() - (days - 1) * 86400000)))
    setTo(today)
  }

  const downloadCsv = () => {
    if (!report) return
    const esc = (v: string | number | null) => {
      const s = v === null ? '' : typeof v === 'number' ? String(v).replace('.', ',') : v
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const lines = [
      ['Отчет по проданным товарам'],
      [company?.name ?? ''],
      [subtitle],
      [],
      ['№', 'Наименование товара', 'Категория', 'Цена за 1 ед', 'Кол-во', 'Итого', 'в т.ч. НДС', 'Накладных'],
      ...rows.map((r, i) => [i + 1, r.productName, r.categoryName ?? '', r.avgPrice, r.quantity, r.total, r.vat, r.invoices]),
      [],
      ['', 'Общее кол-во и сумма', '', '', report.totalQuantity, report.total, report.vat, report.invoiceCount],
    ]
    const csv = '﻿' + lines.map((l) => l.map((c) => esc(c as string | number)).join(';')).join('\r\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    a.download = `Отчет по проданным товарам ${invoiceIds ? 'выборка' : `${from}_${to}`}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <section className="page report">
      <PageHeader eyebrow="Отчёты" title="Продажи по товарам">
        <button className="btn btn--ghost" onClick={downloadCsv} disabled={!report || rows.length === 0}>
          <Icon name="download" />
          Excel
        </button>
        <button className="btn btn--primary" onClick={() => window.print()} disabled={!report}>
          <Icon name="print" />
          Печать
        </button>
      </PageHeader>

      <div className="filters no-print">
        {invoiceIds ? (
          <div className="selection-bar">
            Отчёт по отмеченным накладным ({report?.invoiceCount ?? '…'})
            <button className="link-btn" onClick={() => setParams({})}>Перейти к отчёту за период</button>
          </div>
        ) : (
          <>
            <div className="chips">
              <button className="chip" onClick={() => quick(1)}>Сегодня</button>
              <button className="chip" onClick={() => quick(7)}>7 дней</button>
              <button className="chip" onClick={() => quick('month')}>Этот месяц</button>
              <button className="chip" onClick={() => quick('year')}>Этот год</button>
            </div>
            <div className="daterange">
              <input type="date" className="input" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} aria-label="С даты" />
              <span>—</span>
              <input type="date" className="input" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} aria-label="По дату" />
            </div>
            <div className="filters__client">
              <AsyncSelect
                value={client}
                placeholder="Все клиенты"
                onChange={setClient}
                load={(text) => api.clients.list({ q: text, size: 30 }).then((p) => p.items.map((c) => ({ id: c.id, label: c.displayName })))}
              />
            </div>
          </>
        )}
      </div>

      {error && <div className="alert">{error}</div>}

      {/* Печатная шапка — как в шаблоне старой системы */}
      <div className="print-only report__print-head">
        <h1>Отчет по проданным товарам</h1>
        <div>{company?.name}</div>
        <div>{subtitle}</div>
      </div>

      <div className={`summary ${loading ? 'is-loading' : ''}`}>
        <div className="summary__item">
          <span>Итого продано</span>
          <b>{fmtMoney(report?.total)} ₸</b>
        </div>
        <div className="summary__item">
          <span>в т.ч. НДС 12%</span>
          <b>{fmtMoney(report?.vat)} ₸</b>
        </div>
        <div className="summary__item">
          <span>Количество</span>
          <b>{fmtMoney(report?.totalQuantity)} шт</b>
        </div>
        <div className="summary__item">
          <span>Накладных · позиций</span>
          <b>
            {report?.invoiceCount ?? 0} · {report?.rows.length ?? 0}
          </b>
        </div>
      </div>

      <div className="toolbar no-print">
        <label className="search toolbar__search">
          <Icon name="search" />
          <input type="search" placeholder="Найти товар в отчёте" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <span className="muted">{subtitle}</span>
      </div>

      <div className="table-wrap">
        <table className="table table--report">
          <thead>
            <tr>
              <th style={{ width: 48 }}>№</th>
              <SortTh k="productName" sort={sort} setSort={setSort}>Наименование товара</SortTh>
              <th>Категория</th>
              <th className="num">Цена за 1 ед</th>
              <SortTh k="quantity" sort={sort} setSort={setSort} num>Кол-во</SortTh>
              <SortTh k="total" sort={sort} setSort={setSort} num>Итого, ₸</SortTh>
              <th className="num">в т.ч. НДС</th>
              <th className="num">Накл.</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 && (
              <tr><td colSpan={8} className="table__msg">Считаем…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={8} className="table__msg">За выбранный период продаж нет</td></tr>
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
                <td colSpan={3}>Общее кол-во и сумма</td>
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
        «Цена за 1 ед» — средняя фактическая цена продажи (итого ÷ количество) с учётом скидок.{' '}
        {report && `${report.rows.length} ${plural(report.rows.length, ['позиция', 'позиции', 'позиций'])}.`}
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
