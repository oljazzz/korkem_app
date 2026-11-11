import { isoDay } from './format'

/** The one set of period shortcuts used everywhere (dashboard, reports). */
export type PeriodKey = 'today' | '7d' | '30d' | 'month' | 'year' | '12m' | 'all'

/** Labels are in kk.json under period.preset.<key>. */
export const PERIODS: { key: PeriodKey }[] = [
  { key: 'today' }, { key: '7d' }, { key: '30d' }, { key: 'month' }, { key: 'year' }, { key: '12m' }, { key: 'all' },
]

/** First day with data in this system (legacy invoices start in 2022). */
const EARLIEST = '2022-01-01'

/** [from, to] as YYYY-MM-DD in Almaty time, both inclusive. */
export function periodRange(key: PeriodKey, now = new Date()): [string, string] {
  const today = isoDay(now)
  const [y, m] = today.split('-').map(Number)
  const daysAgo = (n: number) => isoDay(new Date(now.getTime() - n * 86400000))
  switch (key) {
    case 'today':
      return [today, today]
    case '7d':
      return [daysAgo(6), today]
    case '30d':
      return [daysAgo(29), today]
    case 'month':
      return [`${today.slice(0, 8)}01`, today]
    case 'year':
      return [`${y}-01-01`, today]
    case '12m':
      return [isoDay(new Date(Date.UTC(y, m - 12, 1))), today]
    case 'all':
      return [EARLIEST, today]
  }
}

/** The shortcut that produces exactly this range, if any. */
export function matchPeriod(from: string, to: string): PeriodKey | null {
  return PERIODS.find((p) => {
    const [f, t] = periodRange(p.key)
    return f === from && t === to
  })?.key ?? null
}
