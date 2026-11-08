import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import type { Dashboard } from '../api/types'
import { Alert } from '../components/Alert'
import { useAuth } from '../auth/AuthContext'
import { BarList, ColumnChart } from '../components/Charts'
import { Icon } from '../components/Icon'
import { Horns } from '../components/Ornament'
import { fmtCompact, fmtDate, fmtDayLong, fmtMoney, isoDay, MONTHS_SHORT } from '../lib/format'

type PresetKey = '30d' | 'month' | 'year' | '12m' | 'all'

function presetRange(key: PresetKey): [string, string] {
  const now = new Date()
  const today = isoDay(now)
  const [y, m] = today.split('-').map(Number)
  switch (key) {
    case '30d':
      return [isoDay(new Date(now.getTime() - 29 * 86400000)), today]
    case 'month':
      return [`${y}-${String(m).padStart(2, '0')}-01`, today]
    case 'year':
      return [`${y}-01-01`, today]
    case '12m': {
      const d = new Date(Date.UTC(y, m - 12, 1))
      return [isoDay(d), today]
    }
    case 'all':
      return ['2022-01-01', today]
  }
}

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: '30d', label: '30 күн' },
  { key: 'month', label: 'Осы ай' },
  { key: 'year', label: 'Осы жыл' },
  { key: '12m', label: '12 ай' },
  { key: 'all', label: 'Барлық уақыт' },
]

function greeting() {
  const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Almaty', hour: 'numeric', hour12: false }).format(new Date()))
  if (h < 5) return 'Қайырлы түн'
  if (h < 12) return 'Қайырлы таң'
  if (h < 18) return 'Қайырлы күн'
  return 'Қайырлы кеш'
}

export function DashboardPage() {
  const { user } = useAuth()
  const [preset, setPreset] = useState<PresetKey | null>('12m')
  const [range, setRange] = useState<[string, string]>(() => presetRange('12m'))
  const [data, setData] = useState<Dashboard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

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
      (data?.series ?? []).map((p) => ({
        label: data?.granularity === 'month' ? monthLabel(p.start) : p.label,
        value: p.revenue,
        hint: `${p.invoices} жүкқұжат`,
      })),
    [data],
  )

  const choose = (key: PresetKey) => {
    setPreset(key)
    setRange(presetRange(key))
  }

  return (
    <section className="page dash">
      <header className="dash__hero">
        <div>
          <div className="eyebrow">{fmtDayLong(isoDay(new Date()))}</div>
          <h1 className="page-title">
            {greeting()}, {user?.firstName || user?.username}
          </h1>
          {data?.lastInvoiceAt && (
            <p className="muted">
              Соңғы жүкқұжат — {fmtDate(data.lastInvoiceAt)} ·{' '}
              <Link to="/invoices/new" className="text-link">жаңасын рәсімдеу</Link>
            </p>
          )}
        </div>
        <Horns width={120} className="dash__horns" strokeWidth={2} />
      </header>

      <div className="filters" role="group" aria-label="Кезең">
        <div className="chips">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              className={`chip ${preset === p.key ? 'is-active' : ''}`}
              aria-pressed={preset === p.key}
              onClick={() => choose(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="daterange">
          <input
            type="date"
            className="input"
            value={range[0]}
            max={range[1]}
            onChange={(e) => {
              setPreset(null)
              if (e.target.value) setRange([e.target.value, range[1]])
            }}
            aria-label="Басталу күні"
          />
          <span>—</span>
          <input
            type="date"
            className="input"
            value={range[1]}
            min={range[0]}
            onChange={(e) => {
              setPreset(null)
              if (e.target.value) setRange([range[0], e.target.value])
            }}
            aria-label="Аяқталу күні"
          />
        </div>
      </div>

      {error && <Alert onClose={() => setError(null)}>{error}</Alert>}

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
              {data?.granularity === 'month' ? 'айлар' : 'күндер'} бойынша, ₸ · оның ішінде ҚҚС {data ? fmtCompact(data.current.vat) : '—'}
            </p>
          </div>
          <Link className="btn btn--ghost" to={`/reports?from=${range[0]}&to=${range[1]}`}>
            <Icon name="report" />
            Кезең есебі
          </Link>
        </div>
        {data && <ColumnChart data={series} />}
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card__head">
            <h2 className="card__title">Көп сатылатын тауарлар</h2>
            <span className="card__sub">түсім бойынша, ₸</span>
          </div>
          <BarList
            items={(data?.topProducts ?? []).map((p) => ({
              name: p.name,
              value: p.revenue,
              hint: `${fmtMoney(p.quantity)} дана · ${p.invoices} жүкқұжат`,
            }))}
          />
        </div>
        <div className="card">
          <div className="card__head">
            <h2 className="card__title">Үздік сатып алушылар</h2>
            <span className="card__sub">түсім бойынша, ₸</span>
          </div>
          <BarList
            items={(data?.topClients ?? []).map((c) => ({
              name: c.name,
              value: c.revenue,
              hint: `${c.invoices} жүкқұжат`,
            }))}
          />
        </div>
      </div>

      <div className="card">
        <div className="card__head">
          <h2 className="card__title">Санаттар</h2>
          <span className="card__sub">кезеңдегі түсім үлесі</span>
        </div>
        <BarList items={foldCategories(data)} />
      </div>
    </section>
  )
}

function foldCategories(d: Dashboard | null) {
  if (!d) return []
  const total = d.categories.reduce((s, c) => s + c.revenue, 0) || 1
  const top = d.categories.slice(0, 9)
  const rest = d.categories.slice(9)
  const items = top.map((c) => ({ name: c.name, value: c.revenue, hint: `${((c.revenue / total) * 100).toFixed(1)}%` }))
  if (rest.length) {
    const v = rest.reduce((s, c) => s + c.revenue, 0)
    items.push({ name: `Басқалары (${rest.length})`, value: v, hint: `${((v / total) * 100).toFixed(1)}%` })
  }
  return items
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
          {Math.abs(delta).toFixed(1)}%<span>өткен кезеңмен салыстырғанда</span>
        </div>
      ) : (
        <div className="stat__delta">&nbsp;</div>
      )}
      {money && value !== undefined && <div className="stat__exact">{fmtMoney(value)} ₸</div>}
    </div>
  )
}
