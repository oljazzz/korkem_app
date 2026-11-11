import { matchPeriod, PERIODS, periodRange } from '../lib/periods'
import { DateInput } from './DateInput'
import { useTranslation } from 'react-i18next'

/** Period shortcuts plus a from–to range; the same control on the dashboard and in reports. */
export function PeriodPicker({ from, to, onChange }: {
  from: string
  to: string
  onChange: (from: string, to: string) => void
}) {
  const active = matchPeriod(from, to)
  const { t } = useTranslation()
  return (
    <>
      <div className="chips" role="group" aria-label={t('period.group')}>
        {PERIODS.map((p) => (
          <button
            key={p.key}
            className={`chip ${active === p.key ? 'is-active' : ''}`}
            aria-pressed={active === p.key}
            onClick={() => onChange(...periodRange(p.key))}
          >
            {t(`period.preset.${p.key}`)}
          </button>
        ))}
      </div>
      <div className="daterange">
        <DateInput value={from} max={to} clearable={false} ariaLabel={t('period.from')} onChange={(v) => v && onChange(v, to)} />
        <span aria-hidden="true">—</span>
        <DateInput value={to} min={from} clearable={false} ariaLabel={t('period.to')} onChange={(v) => v && onChange(from, v)} />
      </div>
    </>
  )
}
