const money = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
const money2 = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const fmt = (v: number | null | undefined) => (v === null || v === undefined ? '' : money.format(v))
export const fmt2 = (v: number | null | undefined) => (v === null || v === undefined ? '' : money2.format(v))

export const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''

/** Бос жолды null-ға, қалғанын санға айналдырады ("1 234,5" те қабылданады). */
export function parseNum(v: string): number | null {
  const s = v.replace(/\s/g, '').replace(',', '.')
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/** Бэкендтегі InvoiceCalculator-дың көшірмесі (тек алдын ала көрсету үшін; сервер қайта есептейді). */
export function calcLine(price: number, quantity: number, discount: number | null) {
  let total = price * quantity
  if (discount && discount > 0) total = (total * (100 - discount)) / 100
  total = Math.round(total * 100) / 100
  const vat = Math.round(((total * 12) / 112) * 100) / 100
  return { total, vat }
}

/** Ақша: 1 234 567 (тиын болса — 1 234 567,50). */
export const fmtMoney = (v: number | null | undefined) =>
  v === null || v === undefined ? '' : Number.isInteger(v) ? money.format(v) : money2.format(v)

const compact = new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 })
/** Ықшам: 19,3 млн. */
export const fmtCompact = (v: number) => compact.format(v)

/** Күн: YYYY-MM-DD (Алматы уақыты бойынша). */
export function isoDay(d: Date) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty', year: 'numeric', month: '2-digit', day: '2-digit' })
  return p.format(d)
}

export function fmtDayLong(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}
