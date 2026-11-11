import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api'
import type { CityCount, SalesReport, SalesRow } from '../api/types'
import { AsyncSelect, type Option } from '../components/AsyncSelect'
import { PeriodPicker } from '../components/PeriodPicker'
import { Alert } from '../components/Alert'
import { Icon } from '../components/Icon'
import { PageHeader } from '../components/Layout'
import { SkeletonRows } from '../components/Skeleton'
import { fmt, fmtDate, fmtMoney, isoDay } from '../lib/format'
import { useSettings } from '../lib/settings'
import { useTranslation } from 'react-i18next'

type SortKey = 'total' | 'quantity' | 'productName'

/**
 * "Sold products" report, as in the legacy system: total quantity and amount per product,
 * for a period / client or for invoices ticked on the invoices page.
 */
export function ReportsPage() {
  const [params, setParams] = useSearchParams()
  const invoiceIds = params.get('invoiceIds') ?? ''
  const { t } = useTranslation()
  const today = isoDay(new Date())
  const [from, setFrom] = useState(params.get('from') ?? `${today.slice(0, 8)}01`)
  const [to, setTo] = useState(params.get('to') ?? today)
  const [client, setClient] = useState<Option | null>(null)
  const [city, setCity] = useState('')
  const [cities, setCities] = useState<CityCount[]>([])
  const [report, setReport] = useState<SalesReport | null>(null)
  const { company } = useSettings()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<SortKey>('total')
  const [q, setQ] = useState('')

  useEffect(() => {
    api.clients.cities().then(setCities).catch(() => setCities([]))
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const req = invoiceIds ? { invoiceIds } : { from, to, clientId: client?.id ?? null, city: city || null }
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
  }, [from, to, client, city, invoiceIds])

  const rows = useMemo(() => {
    const needle = q.toLowerCase()
    const list = (report?.rows ?? []).filter((r) => !q || r.productName.toLowerCase().includes(needle) || r.groupName.toLowerCase().includes(needle))
    return [...list].sort((a, b) =>
      sort === 'productName' ? a.productName.localeCompare(b.productName, 'kk') : b[sort] - a[sort],
    )
  }, [report, sort, q])

  // Colours of one product fold into a single row with the per-colour rows under it
  const items = useMemo(() => {
    const groups = new Map<string, SalesRow[]>()
    rows.forEach((r) => groups.set(r.groupName, [...(groups.get(r.groupName) ?? []), r]))
    const list = [...groups.entries()].map(([name, rs]) => {
      const quantity = rs.reduce((s, r) => s + r.quantity, 0)
      const total = rs.reduce((s, r) => s + r.total, 0)
      return {
        name,
        rows: rs,
        colours: rs.length > 1 || rs[0].productName !== name,
        categoryName: rs[0].categoryName,
        quantity,
        total,
        avgPrice: quantity ? total / quantity : 0,
        invoices: Math.max(...rs.map((r) => r.invoices)),
      }
    })
    return list.sort((a, b) => (sort === 'productName' ? a.name.localeCompare(b.name, 'kk') : b[sort] - a[sort]))
  }, [rows, sort])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const toggle = (name: string) =>
    setExpanded((s) => {
      const n = new Set(s)
      if (n.has(name)) n.delete(name)
      else n.add(name)
      return n
    })

  const subtitle = invoiceIds
    ? t('reports.selectedSubtitle', { count: report?.invoiceCount ?? '…' })
    : `${t('reports.periodSubtitle', { from: fmtDate(from), to: fmtDate(to) })}${client ? ` · ${client.label}` : ''}${city ? ` · ${city}` : ''}`

  const downloadCsv = () => {
    if (!report) return
    const esc = (v: string | number | null) => {
      let s = v === null ? '' : typeof v === 'number' ? String(v).replace('.', ',') : v
      // Neutralize spreadsheet formulas in text cells (CSV injection)
      if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const lines = [
      [t('reports.csvTitle')],
      [company.name],
      [subtitle],
      [],
      [t('reports.colNo'), t('reports.colName'), t('reports.colCategory'), t('reports.colUnitPrice'), t('reports.colQuantity'), t('reports.colTotal'), t('reports.colInvoices')],
      ...rows.map((r, i) => [i + 1, r.productName, r.categoryName ?? '', r.avgPrice, r.quantity, r.total, r.invoices]),
      [],
      ['', t('reports.totalRow'), '', '', report.totalQuantity, report.total, report.invoiceCount],
    ]
    const csv = '﻿' + lines.map((l) => l.map((c) => esc(c as string | number)).join(';')).join('\r\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    a.download = t('reports.csvFile', { suffix: invoiceIds ? t('reports.csvSelection') : `${from}_${to}` })
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <section className="page report">
      <PageHeader eyebrow={t('reports.eyebrow')} title={t('reports.title')}>
        <button className="btn btn--ghost" onClick={downloadCsv} disabled={!report || rows.length === 0}
          title={t('reports.csvHint')}>
          <Icon name="download" />
          {t('reports.csv')}
        </button>
        <button className="btn btn--primary" onClick={() => window.print()} disabled={!report}>
          <Icon name="print" />
          {t('reports.print')}
        </button>
      </PageHeader>

      <div className="filters no-print">
        {invoiceIds ? (
          <div className="selection-bar">
            {t('reports.selectedBar', { count: report?.invoiceCount ?? '…' })}
            <button className="link-btn" onClick={() => setParams({})}>{t('reports.toPeriod')}</button>
          </div>
        ) : (
          <>
            <PeriodPicker from={from} to={to} onChange={(f, until) => { setFrom(f); setTo(until) }} />
            <div className="filters__client">
              <AsyncSelect
                value={client}
                placeholder={t('reports.allClients')}
                onChange={setClient}
                load={(text) => api.clients.list({ q: text, size: 30 }).then((p) =>
                  p.items.map((c) => ({ id: c.id, label: c.label, hint: c.place ?? c.phone ?? undefined })))}
              />
            </div>
            <select
              className="input toolbar__select"
              aria-label={t('reports.city')}
              value={city}
              onChange={(e) => setCity(e.target.value)}
              disabled={cities.length === 0}
              title={cities.length === 0 ? t('reports.cityDisabled') : undefined}
            >
              <option value="">{cities.length === 0 ? t('reports.noCities') : t('reports.allCities')}</option>
              {cities.map((c) => <option key={c.city} value={c.city}>{c.city} ({c.clients})</option>)}
            </select>
          </>
        )}
      </div>

      {error && <Alert onClose={() => setError(null)}>{error}</Alert>}

      {/* Print header, as in the legacy report template */}
      <div className="print-only report__print-head">
        <h1>{t('reports.csvTitle')}</h1>
        <div>{company.name}</div>
        <div>{subtitle}</div>
      </div>

      <div className={`summary summary--three ${loading ? 'is-loading' : ''}`}>
        <div className="summary__item">
          <span>{t('reports.sold')}</span>
          <b>{fmtMoney(report?.total)} ₸</b>
        </div>
        <div className="summary__item">
          <span>{t('reports.quantity')}</span>
          <b>{t('reports.pieces', { count: fmtMoney(report?.totalQuantity) })}</b>
        </div>
        <div className="summary__item">
          <span>{t('reports.invoices')}</span>
          <b>{fmt(report?.invoiceCount ?? 0)}</b>
          <small className="summary__sub">{t('reports.kinds', { count: fmt(report?.rows.length ?? 0) })}</small>
        </div>
      </div>

      <div className="toolbar no-print">
        <label className="search toolbar__search">
          <Icon name="search" />
          <input type="search" placeholder={t('reports.searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <span className="muted">{subtitle}</span>
      </div>

      <div className={`table-wrap ${loading ? 'is-loading' : ''}`} aria-busy={loading}>
        <table className="table table--report">
          <thead>
            <tr>
              <th style={{ width: 48 }}>№</th>
              <SortTh k="productName" sort={sort} setSort={setSort}>{t('reports.colName')}</SortTh>
              <th>{t('reports.colCategory')}</th>
              <th className="num">{t('reports.colUnitPrice')}</th>
              <SortTh k="quantity" sort={sort} setSort={setSort} num>{t('reports.colQuantity')}</SortTh>
              <SortTh k="total" sort={sort} setSort={setSort} num>{t('reports.colTotalTenge')}</SortTh>
              <th className="num">{t('reports.colInvoicesShort')}</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 && <SkeletonRows cols={7} />}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={7} className="table__msg">{t('reports.empty')}</td></tr>
            )}
            {items.map((it, i) => (
              <Fragment key={it.name}>
                <tr className={it.colours ? 'report-group' : undefined}>
                  <td className="muted-cell mono">{i + 1}</td>
                  <td className="strong">
                    {it.colours ? (
                      <button className="group-row__toggle" aria-expanded={expanded.has(it.name)} onClick={() => toggle(it.name)}>
                        <span className="group-row__icon" aria-hidden="true">{expanded.has(it.name) ? '▾' : '▸'}</span>
                        {it.name}
                        <span className="report-group__count">{t('reports.colours', { count: it.rows.length })}</span>
                      </button>
                    ) : it.name}
                  </td>
                  <td className="muted-cell">{it.categoryName}</td>
                  <td className="num">{fmtMoney(Math.round(it.avgPrice * 100) / 100)}</td>
                  <td className="num">{fmtMoney(it.quantity)}</td>
                  <td className="num strong">{fmtMoney(it.total)}</td>
                  <td className="num muted-cell">{it.colours ? '' : it.invoices}</td>
                </tr>
                {it.colours && it.rows.map((r) => (
                  <tr key={r.productName} className={`report-colour ${expanded.has(it.name) ? '' : 'is-collapsed'}`}>
                    <td />
                    <td className="report-colour__name">{r.productName.startsWith(`${it.name} — `) ? r.productName.slice(it.name.length + 3) : r.productName}</td>
                    <td />
                    <td className="num">{fmtMoney(r.avgPrice)}</td>
                    <td className="num">{fmtMoney(r.quantity)}</td>
                    <td className="num">{fmtMoney(r.total)}</td>
                    <td className="num muted-cell">{r.invoices}</td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
          {report && rows.length > 0 && (
            <tfoot>
              <tr>
                <td />
                <td colSpan={3}>{t('reports.totalRow')}</td>
                <td className="num">{fmtMoney(report.totalQuantity)}</td>
                <td className="num">{fmtMoney(report.total)}</td>
                <td className="num">{report.invoiceCount}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="muted report__note no-print">
        {t('reports.note')}
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
