import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { fmtCompact, fmtMoney } from '../lib/format'
import { useTranslation } from 'react-i18next'

// Single-series charts: one color (--chart), thin marks, hairline grid, hover tooltip.

interface ColumnPoint {
  label: string
  value: number
  hint?: string
  /** The bucket covers only part of its day/month (e.g. the current month); drawn hatched. */
  partial?: boolean
}

/** Round step: 1, 2, 5 × 10ⁿ. */
function niceStep(v: number) {
  if (v <= 0) return 1
  const p = 10 ** Math.floor(Math.log10(v))
  const n = v / p
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p
}

/** Column chart (revenue over time). */
export function ColumnChart({ data, height = 240, unit = '₸' }: { data: ColumnPoint[]; height?: number; unit?: string }) {
  const [hover, setHover] = useState<number | null>(null)
  const { t } = useTranslation()
  const boxRef = useRef<HTMLDivElement>(null)
  const width = 720
  const pad = { l: 52, r: 8, t: 16, b: 28 }
  const innerW = width - pad.l - pad.r
  const innerH = height - pad.t - pad.b
  const dataMax = Math.max(0, ...data.map((d) => d.value))
  const step = niceStep(dataMax / 4)
  const max = Math.max(step, Math.ceil(dataMax / step) * step)
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step)
  const slot = innerW / Math.max(1, data.length)
  const barW = Math.max(2, Math.min(24, slot - 2))
  const peak = data.reduce((best, d, i) => (d.value > (data[best]?.value ?? -1) ? i : best), 0)
  const labelEvery = Math.ceil(data.length / 12)
  const y = (v: number) => pad.t + innerH - (v / max) * innerH

  const hasPartial = data.some((d) => d.partial)

  const bar = (x: number, v: number) => {
    const h = Math.max(0, (v / max) * innerH)
    if (h === 0) return ''
    const r = Math.min(4, h, barW / 2)
    const top = pad.t + innerH - h
    const base = pad.t + innerH
    return `M${x},${base}V${top + r}Q${x},${top} ${x + r},${top}H${x + barW - r}Q${x + barW},${top} ${x + barW},${top + r}V${base}Z`
  }

  const h = hover !== null ? data[hover] : null
  const hx = hover !== null ? pad.l + hover * slot + slot / 2 : 0

  return (
    <div className="chart" ref={boxRef} onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={t('chart.revenueByPeriod')} preserveAspectRatio="none">
        <defs>
          <pattern id="chart-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" className="chart__hatch-bg" />
            <line x1="0" y1="0" x2="0" y2="6" className="chart__hatch-line" />
          </pattern>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} className="chart__grid" />
            <text x={pad.l - 8} y={y(t) + 4} className="chart__tick" textAnchor="end">{fmtCompact(t)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = pad.l + i * slot + (slot - barW) / 2
          return (
            <g key={i}>
              <path
                d={bar(x, d.value)}
                className={`chart__bar ${d.partial ? 'is-partial' : ''} ${hover === i ? 'is-hover' : ''} ${hover !== null && hover !== i ? 'is-dim' : ''}`}
              />
              {i % labelEvery === 0 && (
                <text x={pad.l + i * slot + slot / 2} y={height - 8} className="chart__tick" textAnchor="middle">{d.label}</text>
              )}
              <rect
                x={pad.l + i * slot}
                y={pad.t}
                width={slot}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
              />
            </g>
          )
        })}
        {data[peak] && data[peak].value > 0 && hover === null && (
          <text
            x={pad.l + peak * slot + slot / 2}
            y={y(data[peak].value) - 6}
            className="chart__peak"
            textAnchor={peak > data.length * 0.85 ? 'end' : peak < data.length * 0.15 ? 'start' : 'middle'}
          >
            {fmtCompact(data[peak].value)}
          </text>
        )}
      </svg>
      {h && (
        <div className="chart__tip" style={{ left: `${(hx / width) * 100}%` }}>
          <div className="chart__tip-label">{h.label}</div>
          <div className="chart__tip-value">{fmtMoney(h.value)} {unit}</div>
          {h.hint && <div className="chart__tip-hint">{h.hint}</div>}
          {h.partial && <div className="chart__tip-hint">{t('chart.partial')}</div>}
        </div>
      )}
      {hasPartial && (
        <div className="chart__legend">
          <span className="chart__legend-swatch" aria-hidden="true" />
          {t('chart.partialLegend')}
        </div>
      )}
    </div>
  )
}

interface BarItem {
  name: string
  value: number
  hint?: string
  /** Makes the name a link (e.g. to the client card). */
  to?: string
}

/** Horizontal ranking: name, thin bar, value. */
export function BarList({ items, emptyText }: { items: BarItem[]; emptyText?: string }) {
  const { t } = useTranslation()
  const max = useMemo(() => Math.max(1, ...items.map((i) => i.value)), [items])
  if (items.length === 0) return <p className="muted">{emptyText ?? t('common.noData')}</p>
  return (
    <ol className="barlist">
      {items.map((it, i) => (
        <li key={it.name + i} className="barlist__row" title={it.hint ? `${it.name}\n${it.hint}` : it.name}>
          <span className="barlist__rank">{i + 1}</span>
          <span className="barlist__body">
            <span className="barlist__top">
              {it.to ? (
                <Link className="barlist__name barlist__link" to={it.to}>{it.name}</Link>
              ) : (
                <span className="barlist__name">{it.name}</span>
              )}
              <span className="barlist__value">{fmtMoney(Math.round(it.value))}</span>
            </span>
            <span className="barlist__track">
              <span className="barlist__fill" style={{ width: `${(it.value / max) * 100}%` }} />
            </span>
            {it.hint && <span className="barlist__hint">{it.hint}</span>}
          </span>
        </li>
      ))}
    </ol>
  )
}
