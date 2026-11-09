import { matchPeriod, PERIODS, periodRange } from '../lib/periods'
import { DateInput } from './DateInput'

/** Period shortcuts plus a from–to range; the same control on the dashboard and in reports. */
export function PeriodPicker({ from, to, onChange }: {
  from: string
  to: string
  onChange: (from: string, to: string) => void
}) {
  const active = matchPeriod(from, to)
  return (
    <>
      <div className="chips" role="group" aria-label="Кезең">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            className={`chip ${active === p.key ? 'is-active' : ''}`}
            aria-pressed={active === p.key}
            onClick={() => onChange(...periodRange(p.key))}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="daterange">
        <DateInput value={from} max={to} clearable={false} ariaLabel="Басталу күні" onChange={(v) => v && onChange(v, to)} />
        <span aria-hidden="true">—</span>
        <DateInput value={to} min={from} clearable={false} ariaLabel="Аяқталу күні" onChange={(v) => v && onChange(from, v)} />
      </div>
    </>
  )
}
