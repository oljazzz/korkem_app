import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import type { Dashboard, Debts, InvoiceListItem } from '../api/types'
import { Alert } from '../components/Alert'
import { useAuth } from '../auth/AuthContext'
import { BarList, ColumnChart } from '../components/Charts'
import { Icon } from '../components/Icon'
import { Horns } from '../components/Ornament'
import { SkeletonList } from '../components/Skeleton'
import { PaymentBadge } from '../components/PaymentBadge'
import { PeriodPicker } from '../components/PeriodPicker'
import { rowProps } from '../components/RowActions'
import { periodRange } from '../lib/periods'
import { fmtCompact, fmtDate, fmtDayLong, fmtMoney, isoDay, MONTHS_SHORT } from '../lib/format'

function greeting() {
  const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Almaty', hour: 'numeric', hour12: false }).format(new Date()))
  if (h < 5) return 'Қайырлы түн'
  if (h < 12) return 'Қайырлы таң'
  if (h < 18) return 'Қайырлы күн'
  return 'Қайырлы кеш'
}

export function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [range, setRange] = useState<[string, string]>(() => periodRange('12m'))
  const [recent, setRecent] = useState<InvoiceListItem[] | null>(null)
  const [data, setData] = useState<Dashboard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [debts, setDebts] = useState<Debts | null>(null)

  // Receivables do not depend on the selected period
  useEffect(() => {
    api.clients.debtors(5).then(setDebts).catch(() => setDebts(null))
    api.invoices.list({ size: 5 }).then((p) => setRecent(p.items)).catch(() => setRecent([]))
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.reports
      .dashboard(range[0], range[1])
      .then((d) => {
        if (!cancelled) {
          setData(d)
          setError(null)
        }
      })
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [range])

  const series = useMemo(
    () =>
      (data?.series ?? []).map((p, i, all) => ({
        label: data?.granularity === 'month' ? monthLabel(p.start) : p.label,
        value: p.revenue,
        hint: `${p.invoices} жүкқұжат`,
        partial: data ? isPartial(p.start, i, all.length, data.granularity, range[0], range[1]) : false,
      })),
    [data, range],
  )

  return (
    <section className="page dash">
      <header className="dash__hero">
        <div>
          <div className="eyebrow">{fmtDayLong(isoDay(new Date()))}</div>
          <h1 className="page-title">
            {greeting()}, {user?.firstName || user?.username}
          </h1>
          {data?.lastInvoiceAt && <p className="muted">Соңғы жүкқұжат — {fmtDate(data.lastInvoiceAt)}</p>}
        </div>
        <Horns width={120} className="dash__horns" strokeWidth={2} />
        <Link to="/invoices/new" className="btn btn--primary btn--lg dash__create">
          <Icon name="plus" />
          Жаңа жүкқұжат
        </Link>
      </header>

      <div className="grid-2 dash__today">
        <div className="card">
          <div className="card__head">
            <h2 className="card__title">Соңғы жүкқұжаттар</h2>
            <Link className="text-link" to="/invoices">Барлығы</Link>
          </div>
          {!recent ? <SkeletonList rows={5} /> : recent.length === 0 ? <p className="muted">Жүкқұжаттар әлі жоқ</p> : (
            <table className="table table--compact">
              <tbody>
                {recent.map((i) => (
                  <tr key={i.id} {...rowProps(() => navigate(`/invoices/${i.id}`))}>
                    <td>
                      <span className="strong nowrap">№ {i.number}</span>
                      <span className="cell-sub">{fmtDate(i.createdAt)}</span>
                    </td>
                    <td className="dash__client">
                      <span className="strong">{i.clientName}</span>
                      {i.clientPlace && <span className="cell-sub">{i.clientPlace}</span>}
                    </td>
                    <td className="hide-phone"><PaymentBadge status={i.status} /></td>
                    <td className="num strong">{fmtMoney(i.total)} ₸</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="card debts">
          <div className="card__head">
            <div>
              <h2 className="card__title">Алынатын қарыз</h2>
              <p className="card__sub">клиенттердің төленбеген сомасы, қазіргі күйі</p>
            </div>
            {debts && debts.total > 0 && <Link className="text-link" to="/clients?view=debtors">Барлығы</Link>}
          </div>
          {!debts ? <SkeletonList rows={4} /> : debts.total === 0 ? <p className="muted">Қарыз жоқ — барлық жүкқұжат төленген.</p> : (
            <>
              <div className="debts__total">
                {fmtMoney(debts.total)}<span className="stat__unit">₸</span>
              </div>
              <ol className="debts__list">
                {debts.debtors.map((d) => (
                  <li key={d.client.id}>
                    <Link to={`/clients/${d.client.id}`} className="debts__name">{d.client.label}</Link>
                    <span className="debts__sum">{fmtMoney(d.debt)} ₸</span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      </div>

      <h2 className="section-title">Сатылым талдауы</h2>
      <div className="filters">
        <PeriodPicker from={range[0]} to={range[1]} onChange={(f, t) => setRange([f, t])} />
      </div>

      {error && <Alert onClose={() => setError(null)}>{error}</Alert>}

      {data && (
        <p className="kpis__note">
          Өзгерістер алдыңғы осындай кезеңмен салыстырылған: {previousRange(data.from, data.to)}
        </p>
      )}
      <div className={`kpis ${loading ? 'is-loading' : ''}`}>
        <Stat label="Түсім" value={data?.current.revenue} prev={data?.previous.revenue} money />
        <Stat label="Жүкқұжаттар" value={data?.current.invoices} prev={data?.previous.invoices} />
        <Stat label="Орташа чек" value={data?.current.avgCheck} prev={data?.previous.avgCheck} money />
        <Stat label="Сатып алушылар" value={data?.current.clients} prev={data?.previous.clients} />
      </div>

      <div className="card">
        <div className="card__head">
          <div>
            <h2 className="card__title">Түсім</h2>
            <p className="card__sub">
              {data?.granularity === 'month' ? 'айлар' : 'күндер'} бойынша, ₸
            </p>
          </div>
          <Link className="btn btn--ghost" to={`/reports?from=${range[0]}&to=${range[1]}`}>
            <Icon name="report" />
            Кезең есебі
          </Link>
        </div>
        {data ? <ColumnChart data={series} /> : <div className="skeleton skeleton--chart" aria-hidden="true" />}
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card__head">
            <h2 className="card__title">Көп сатылатын тауарлар</h2>
            <span className="card__sub">түсім бойынша, ₸</span>
          </div>
          {!data ? <SkeletonList /> : <BarList
            items={(data?.topProducts ?? []).map((p) => ({
              name: p.name,
              value: p.revenue,
              hint: `${fmtMoney(p.quantity)} дана · ${p.invoices} жүкқұжат`,
            }))}
          />}
        </div>
        <div className="card">
          <div className="card__head">
            <h2 className="card__title">Үздік сатып алушылар</h2>
            <span className="card__sub">түсім бойынша, ₸</span>
          </div>
          {!data ? <SkeletonList /> : <BarList
            items={(data?.topClients ?? []).map((c) => ({
              name: c.name,
              value: c.revenue,
              hint: `${c.invoices} жүкқұжат`,
              to: c.id ? `/clients/${c.id}` : undefined,
            }))}
          />}
        </div>
      </div>

      <div className="card">
        <div className="card__head">
          <h2 className="card__title">Санаттар</h2>
          <span className="card__sub">кезеңдегі түсім үлесі</span>
        </div>
        {!data ? <SkeletonList rows={8} /> : <CategoryShares data={data} />}
      </div>
    </section>
  )
}

/** Top categories scaled to the largest one; the long tail is summarised in one line, not drawn as a bar. */
function CategoryShares({ data }: { data: Dashboard }) {
  const total = data.categories.reduce((s, c) => s + c.revenue, 0) || 1
  const top = data.categories.slice(0, 8)
  const rest = data.categories.slice(8)
  const restSum = rest.reduce((s, c) => s + c.revenue, 0)
  const pct = (v: number) => `${((v / total) * 100).toFixed(1)}%`
  return (
    <>
      <BarList items={top.map((c) => ({ name: c.name, value: c.revenue, hint: `жалпы түсімнің ${pct(c.revenue)}` }))} />
      {rest.length > 0 && (
        <p className="barlist__rest">
          Басқа {rest.length} санат: {fmtMoney(Math.round(restSum))} ₸ · {pct(restSum)}
        </p>
      )}
    </>
  )
}

/** First/last bucket that the selected range cuts short (e.g. the current, unfinished month). */
function isPartial(start: string, index: number, count: number, granularity: string, from: string, to: string) {
  if (granularity !== 'month') return index === count - 1 && to >= isoDay(new Date())
  const [y, m] = start.split('-').map(Number)
  const monthEnd = isoDay(new Date(Date.UTC(y, m, 0)))
  return (index === 0 && from > start) || (index === count - 1 && to < monthEnd)
}

/** The equally long period right before [from, to], as the server compares against it. */
function previousRange(from: string, to: string) {
  const day = 86400000
  const f = Date.parse(from)
  const days = Math.round((Date.parse(to) - f) / day) + 1
  const prevFrom = new Date(f - days * day).toISOString().slice(0, 10)
  const prevTo = new Date(f - day).toISOString().slice(0, 10)
  return `${fmtDate(prevFrom)} — ${fmtDate(prevTo)}`
}

function monthLabel(iso: string) {
  const [y, m] = iso.split('-').map(Number)
  return m === 1 ? `${MONTHS_SHORT[0]} ${String(y).slice(2)}` : MONTHS_SHORT[m - 1]
}

function Stat({ label, value, prev, money }: { label: string; value?: number; prev?: number; money?: boolean }) {
  const delta = value !== undefined && prev ? ((value - prev) / prev) * 100 : null
  const up = delta !== null && delta >= 0
  return (
    <div className="stat">
      <div className="stat__label">{label}</div>
      <div className="stat__value">
        {value === undefined ? '—' : money ? fmtCompact(value) : fmtMoney(value)}
        {money && value !== undefined && <span className="stat__unit">₸</span>}
      </div>
      {delta !== null ? (
        <div className={`stat__delta ${up ? 'is-up' : 'is-down'}`}>
          <Icon name={up ? 'arrowUp' : 'arrowDown'} size={14} />
          {Math.abs(delta).toFixed(1)}%
        </div>
      ) : (
        <div className="stat__delta">&nbsp;</div>
      )}
      {money && value !== undefined && <div className="stat__exact">{fmtMoney(value)} ₸</div>}
    </div>
  )
}
