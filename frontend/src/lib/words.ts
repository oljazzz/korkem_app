// Amounts in words, in Kazakh, for form Z-2: 15200 → "Он бес мың екі жүз теңге 00 тиын".

const ONES = ['', 'бір', 'екі', 'үш', 'төрт', 'бес', 'алты', 'жеті', 'сегіз', 'тоғыз']
const TENS = ['', 'он', 'жиырма', 'отыз', 'қырық', 'елу', 'алпыс', 'жетпіс', 'сексен', 'тоқсан']
const SCALES = ['', 'мың', 'миллион', 'миллиард', 'триллион']

function triad(n: number): string[] {
  const words: string[] = []
  const h = Math.floor(n / 100)
  if (h > 0) words.push(...(h === 1 ? ['жүз'] : [ONES[h], 'жүз']))
  words.push(TENS[Math.floor((n % 100) / 10)], ONES[n % 10])
  return words.filter(Boolean)
}

/** Integer in words: 1234 → "бір мың екі жүз отыз төрт". */
export function numberToWords(value: number): string {
  let n = Math.floor(Math.abs(value))
  if (n === 0) return 'нөл'
  const parts: string[] = []
  let scale = 0
  while (n > 0 && scale < SCALES.length) {
    const t = n % 1000
    if (t > 0) parts.unshift([...triad(t), SCALES[scale]].filter(Boolean).join(' '))
    n = Math.floor(n / 1000)
    scale++
  }
  return parts.join(' ')
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function moneyToWords(amount: number): string {
  const rounded = Math.round(amount * 100) / 100
  const tenge = Math.floor(rounded)
  const tiyn = Math.round((rounded - tenge) * 100)
  return `${cap(numberToWords(tenge))} теңге ${String(tiyn).padStart(2, '0')} тиын`
}

export function quantityToWords(qty: number): string {
  return Number.isInteger(qty) ? cap(numberToWords(qty)) : String(qty).replace('.', ',')
}
