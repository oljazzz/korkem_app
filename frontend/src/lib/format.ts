// Browsers often ship without kk-KZ locale data, so format numbers by hand in the Kazakh
// convention: a space between thousands and a comma before decimals (1 234 567,50).
function makeFormat(min: number, max: number) {
  const f = new Intl.NumberFormat('en-US', { minimumFractionDigits: min, maximumFractionDigits: max, useGrouping: true })
  return { format: (v: number) => f.format(v).replace(/,/g, '\u00a0').replace('.', ',') }
}
const money = makeFormat(0, 2)
const money2 = makeFormat(2, 2)
const short = makeFormat(0, 1)

export const fmt = (v: number | null | undefined) => (v === null || v === undefined ? '' : money.format(v))
export const fmt2 = (v: number | null | undefined) => (v === null || v === undefined ? '' : money2.format(v))

/** Money: 1 234 567, or 1 234 567,50 when there are tiyn. */
export const fmtMoney = (v: number | null | undefined) =>
  v === null || v === undefined ? '' : Number.isInteger(v) ? money.format(v) : money2.format(v)

const amount3 = makeFormat(0, 3)

export type PackUnit = 'KG' | 'L'

/** Pack size for display: 20 кг, 2,7 кг, 800 г, 5 л, 500 мл (small packs in grams/millilitres). */
export function fmtPack(amount: number | null | undefined, unit: PackUnit | null | undefined) {
  if (amount === null || amount === undefined || !unit) return ''
  if (amount < 1) return `${Math.round(amount * 1000)} ${unit === 'KG' ? 'г' : 'мл'}`
  return `${amount3.format(amount)} ${unit === 'KG' ? 'кг' : 'л'}`
}

/** Price of one kilogram or litre: "900 ₸/кг". */
export function fmtPricePerBase(price: number, amount: number | null | undefined, unit: PackUnit | null | undefined) {
  if (!amount || !unit || price <= 0) return ''
  return `${fmtMoney(Math.round((price / amount) * 100) / 100)} ₸/${unit === 'KG' ? 'кг' : 'л'}`
}

/** The single size written in a product name ("20кг", "800гр", "5Л", "500мл"), in a base unit. */
export function packFromName(name: string): { amount: number; unit: PackUnit } | null {
  const found = [...name.matchAll(/(\d+(?:[.,]\d+)?)\s*(кг|kg|гр|г|g|мл|ml|л|l)(?![\p{L}])/giu)].map((m) => {
    const v = Number(m[1].replace(',', '.'))
    const u = m[2].toLowerCase()
    const small = /^(г|g|м|ml)/.test(u)
    const volume = /^(л|l|м|ml)/.test(u)
    return { amount: small ? v / 1000 : v, unit: (volume ? 'L' : 'KG') as PackUnit }
  })
  return found.length === 1 && found[0].amount > 0 ? found[0] : null
}

/** Compact number with Kazakh unit words: 145,4 мың · 19,3 млн · 1,2 млрд. */
export function fmtCompact(v: number) {
  const a = Math.abs(v)
  if (a >= 1e9) return `${short.format(v / 1e9)} млрд`
  if (a >= 1e6) return `${short.format(v / 1e6)} млн`
  if (a >= 1e4) return `${short.format(v / 1e3)} мың`
  return short.format(v)
}

const dayFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Almaty', day: '2-digit', month: '2-digit', year: 'numeric' })

/** Date as dd.MM.yyyy in the Almaty time zone. */
export const fmtDate = (iso: string | null | undefined) => (iso ? dayFormat.format(new Date(iso)).replace(/\//g, '.') : '')

/** Calendar day YYYY-MM-DD in the Almaty time zone. */
export function isoDay(d: Date) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty', year: 'numeric', month: '2-digit', day: '2-digit' })
  return p.format(d)
}

const MONTHS_GEN = ['қаңтар', 'ақпан', 'наурыз', 'сәуір', 'мамыр', 'маусым', 'шілде', 'тамыз', 'қыркүйек', 'қазан', 'қараша', 'желтоқсан']
export const MONTHS_SHORT = ['қаң', 'ақп', 'нау', 'сәу', 'мам', 'мау', 'шіл', 'там', 'қыр', 'қаз', 'қар', 'жел']

/** Long date in Kazakh order: 2026 жылғы 8 қараша. */
export function fmtDayLong(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return `${y} жылғы ${d} ${MONTHS_GEN[m - 1]}`
}

/** Parses user input into a number; blank → null; accepts "1 234,5". */
export function parseNum(v: string): number | null {
  const s = v.replace(/\s/g, '').replace(',', '.')
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/** Mirror of the backend InvoiceCalculator, for live preview only (the server recalculates). */
export function calcLine(price: number, quantity: number, discount: number | null) {
  let total = price * quantity
  if (discount && discount > 0) total = (total * (100 - discount)) / 100
  total = Math.round(total * 100) / 100
  return { total }
}

/**
 * What a number field keeps while typing: digits and a single decimal separator (, or .).
 * Letters, spaces and a second separator are dropped as they are typed or pasted.
 */
export function numericInput(v: string): string {
  const cleaned = v.replace(/[^\d.,]/g, '')
  const sep = cleaned.search(/[.,]/)
  return sep < 0 ? cleaned : cleaned.slice(0, sep + 1) + cleaned.slice(sep + 1).replace(/[.,]/g, '')
}
