import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import type { Category, Product } from '../api/types'
import { Alert } from '../components/Alert'
import { Icon } from '../components/Icon'
import { fmtDayLong, fmtMoney, isoDay } from '../lib/format'
import { useSettings } from '../lib/settings'

/** Customer-facing price list, grouped by category; printed or saved as PDF from the browser (A4 portrait). */
export function PriceListPrintPage() {
  const [params, setParams] = useSearchParams()
  const categoryId = Number(params.get('category')) || null
  const { company } = useSettings()
  const [loaded, setLoaded] = useState<{ categoryId: number | null; items: Product[] } | null>(null)
  const products = loaded && loaded.categoryId === categoryId ? loaded.items : null
  const [categories, setCategories] = useState<Category[]>([])
  const [error, setError] = useState<string | null>(null)
  const [today] = useState(() => isoDay(new Date()))

  useEffect(() => {
    api.categories.all().then(setCategories).catch(() => undefined)
  }, [])

  useEffect(() => {
    let alive = true
    api.products.list({ categoryId, size: 200, page: 0 }).then(async (first) => {
      // Fetch the remaining pages so the list is complete
      const pages = Math.ceil(first.total / first.size)
      const rest = await Promise.all(
        Array.from({ length: Math.max(0, pages - 1) }, (_, i) => api.products.list({ categoryId, size: 200, page: i + 1 })),
      )
      if (alive) setLoaded({ categoryId, items: [first, ...rest].flatMap((p) => p.items) })
    }).catch((e: Error) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [categoryId])

  const groups = useMemo(() => {
    const map = new Map<string, Product[]>()
    ;(products ?? []).forEach((p) => {
      const key = p.categoryName ?? 'Басқа тауарлар'
      map.set(key, [...(map.get(key) ?? []), p])
    })
    return [...map.entries()]
  }, [products])

  const contacts = [company.address, company.phone].filter(Boolean).join(' · ')
  const selected = categories.find((c) => c.id === categoryId)

  return (
    <section className="page">
      <div className="print-actions no-print">
        <Link className="btn btn--ghost" to="/products"><Icon name="back" />Баға тізіміне оралу</Link>
        <select
          className="input toolbar__select"
          aria-label="Санат"
          value={categoryId ?? ''}
          onChange={(e) => setParams(e.target.value ? { category: e.target.value } : {})}
        >
          <option value="">Барлық санаттар</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button className="btn btn--primary" onClick={() => window.print()} disabled={!products}>
          <Icon name="print" />Басып шығару / PDF
        </button>
        <span className="muted">PDF ретінде сақтап, клиентке жіберуге болады</span>
      </div>
      {error && <Alert>{error}</Alert>}
      {/* The app's default print page is landscape (form Q-2); a price list reads better in portrait */}
      <style>{'@media print { @page { size: A4 portrait; margin: 12mm; } }'}</style>

      <article className="pricelist" lang="kk">
        <header className="pricelist__head">
          <div>
            <div className="pricelist__company">{company.name}</div>
            {contacts && <div className="pricelist__contacts">{contacts}</div>}
            {company.bin && <div className="pricelist__contacts">БСН {company.bin}</div>}
          </div>
          <div className="pricelist__title">
            <h1>Баға тізімі</h1>
            <div>{fmtDayLong(today)} жағдай бойынша{selected ? ` · ${selected.name}` : ''}</div>
          </div>
        </header>

        {!products ? <p className="muted">Жүктелуде…</p> : (
          <table className="pricelist__table">
            <thead>
              <tr><th className="c">№</th><th>Атауы</th><th className="n">Бағасы, ₸</th></tr>
            </thead>
            {groups.map(([name, items]) => (
              <tbody key={name}>
                <tr className="pricelist__group"><td colSpan={3}>{name}</td></tr>
                {items.map((p, i) => (
                  <tr key={p.id}>
                    <td className="c">{i + 1}</td>
                    <td>{p.name}</td>
                    <td className="n">{fmtMoney(p.price)}</td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        )}
        <footer className="pricelist__foot">Бағаларға ҚҚС кіреді. Бағалар алдын ала ескертусіз өзгеруі мүмкін.</footer>
      </article>
    </section>
  )
}
