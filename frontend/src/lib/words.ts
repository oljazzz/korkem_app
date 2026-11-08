// Сомманы орыс тілінде жазбаша беру (З-2 нысаны үшін): 15200 → «Пятнадцать тысяч двести тенге 00 тиын»

const ONES_M = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять']
const ONES_F = ['', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять']
const TEENS = ['десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать',
  'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать']
const TENS = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто']
const HUNDREDS = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот']

// [один, два-четыре, пять+], род
const SCALES: [string[], boolean][] = [
  [['', '', ''], false],
  [['тысяча', 'тысячи', 'тысяч'], true],
  [['миллион', 'миллиона', 'миллионов'], false],
  [['миллиард', 'миллиарда', 'миллиардов'], false],
]

export function plural(n: number, forms: [string, string, string] | string[]) {
  const a = Math.abs(n) % 100
  const b = a % 10
  if (a > 10 && a < 20) return forms[2]
  if (b > 1 && b < 5) return forms[1]
  if (b === 1) return forms[0]
  return forms[2]
}

function triad(n: number, feminine: boolean): string[] {
  const words: string[] = []
  words.push(HUNDREDS[Math.floor(n / 100)])
  const rest = n % 100
  if (rest >= 10 && rest < 20) words.push(TEENS[rest - 10])
  else {
    words.push(TENS[Math.floor(rest / 10)])
    words.push((feminine ? ONES_F : ONES_M)[rest % 10])
  }
  return words.filter(Boolean)
}

/** Бүтін санды сөзбен (еркек тегі): 1234 → «одна тысяча двести тридцать четыре». */
export function numberToWords(value: number): string {
  let n = Math.floor(Math.abs(value))
  if (n === 0) return 'ноль'
  const parts: string[] = []
  let scale = 0
  while (n > 0 && scale < SCALES.length) {
    const t = n % 1000
    if (t > 0) {
      const [forms, fem] = SCALES[scale]
      const w = triad(t, fem)
      if (scale > 0) w.push(plural(t, forms))
      parts.unshift(w.join(' '))
    }
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
  return `${cap(numberToWords(tenge))} тенге ${String(tiyn).padStart(2, '0')} тиын`
}

export function quantityToWords(qty: number): string {
  return Number.isInteger(qty) ? cap(numberToWords(qty)) : String(qty).replace('.', ',')
}
